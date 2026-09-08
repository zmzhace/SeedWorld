import 'server-only'

import { createHash } from 'node:crypto'
import type { ClaimScope, ImportStatus, WorldOntology } from '@/domain/novel-graph'
import { getDatabase } from './database'
import { generateOntology } from './ontology-generator'
import {
  createImport,
  createJob,
  getJob,
  getLatestOntology,
  saveOntology,
  updateJob,
  updateWorld,
  upsertEntity,
  upsertFact,
} from './novel-repository'
import { getSourceMaterial, sha256 } from './source-ingestion'
import { ensureGraph, readGraph, setGraphOntology, submitEpisodes, waitForEpisodes } from './zep-graph'
import { createPersonalAgent } from '@/domain/agents'
import type { WorldSlice } from '@/domain/world'

const stableId = (prefix: string, value: string) =>
  `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`

function updateImport(importId: string, status: string, patch: { graphId?: string } = {}) {
  getDatabase()
    .prepare(
      `UPDATE imports SET status=?,source_graph_id=COALESCE(?,source_graph_id),updated_at=? WHERE id=?`,
    )
    .run(status, patch.graphId || null, new Date().toISOString(), importId)
}

function latestJobForImport(importId: string) {
  return getDatabase().prepare('SELECT id FROM jobs WHERE import_id=? ORDER BY created_at DESC LIMIT 1').get(importId) as
    | { id: string }
    | undefined
}

export function startExtraction(worldId: string) {
  const material = getSourceMaterial(worldId)
  if (!material.chunks.length) throw new Error('请先上传或粘贴至少一份资料')
  const contentHash = sha256(material.sources.map((source) => source.sha256).sort().join(':'))
  const created = createImport(worldId, contentHash)
  if (created.duplicate) {
    const row = latestJobForImport(created.id)
    const previous = row ? getJob(row.id) : null
    // A failed run must not pin the import forever: start a fresh job so the
    // user can retry from the studio panel without touching the database.
    if (previous && previous.status !== 'failed' && previous.status !== 'rolled_back') return previous
  }
  const job = createJob(worldId, created.id)
  void runExtraction(job.id).catch((error) => {
    updateJob(job.id, {
      status: 'failed',
      stage: 'failed',
      message: '抽取失败',
      error: error instanceof Error ? error.message : String(error),
    })
    updateImport(created.id, 'failed')
    updateWorld(worldId, { graphSyncStatus: 'failed' })
  })
  return job
}

async function runExtraction(jobId: string) {
  const job = getJob(jobId)
  if (!job) return
  const report = (patch: { status: ImportStatus; stage: string; progress: number; message: string }) =>
    updateJob(jobId, patch)
  const material = getSourceMaterial(job.worldId)
  report({ status: 'ontology', stage: 'ontology', progress: 10, message: '正在分析资料并生成动态本体' })
  const previous = getLatestOntology(job.worldId)
  const ontology = await generateOntology(
    job.worldId,
    material.sources.map((item) => item.extracted_text),
    (previous?.version || 0) + 1,
  )
  saveOntology(ontology)

  const graphId = `seedworld_${job.worldId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_source`
  report({ status: 'submitting', stage: 'graph', progress: 25, message: '正在创建 Source Graph 并注册本体' })
  await ensureGraph(graphId, `SeedWorld ${job.worldId} Source`)
  await setGraphOntology(graphId, ontology)
  updateImport(job.importId, 'submitting', { graphId })
  updateWorld(job.worldId, { sourceGraphId: graphId, graphSyncStatus: 'processing', visibilityConfirmed: false })

  // Batch submit: 20% → 60% while uploading (mirrors MiroFish progress bands).
  const payload = material.chunks.map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    sourceId: chunk.source_id,
    ordinal: chunk.ordinal,
  }))
  report({
    status: 'processing',
    stage: 'zep',
    progress: 40,
    message: `正在提交 ${payload.length} 个文本块给 Zep`,
  })
  const { episodeUuids } = await submitEpisodes(graphId, payload, (_message, fraction) =>
    report({
      status: 'processing',
      stage: 'zep',
      progress: Math.round(40 + fraction * 20),
      message: `正在提交文本块给 Zep（${Math.round(fraction * 100)}%）`,
    }),
  )
  updateImport(job.importId, 'processing')
  const saveEpisode = getDatabase().prepare('UPDATE source_chunks SET episode_id=? WHERE id=?')
  material.chunks.forEach((chunk, index) => saveEpisode.run(episodeUuids[index] || null, chunk.id))

  // Wait for Zep ingestion: 60% → 90%.
  report({ status: 'syncing', stage: 'syncing', progress: 60, message: '正在等待 Zep 抽取实体和事实' })
  await waitForEpisodes(episodeUuids, (_message, fraction) =>
    report({
      status: 'syncing',
      stage: 'syncing',
      progress: Math.round(60 + fraction * 30),
      message: `Zep 正在抽取实体和事实（${Math.round(fraction * 100)}%）`,
    }),
  )

  report({ status: 'syncing', stage: 'syncing', progress: 90, message: '正在从 Zep 同步实体和事实' })
  const graph = await readGraph(graphId)
  persistGraph(job.worldId, job.importId, graph, ontology)
  updateImport(job.importId, 'completed')
  updateWorld(job.worldId, { sourceGraphId: graphId, graphSyncStatus: 'ready' })
  syncActionableAgents(job.worldId)
  report({
    status: 'completed',
    stage: 'completed',
    progress: 100,
    message: `已同步 ${graph.nodes.length} 个实体和 ${graph.edges.length} 条事实`,
  })
}

function syncActionableAgents(worldId: string) {
  const world = getDatabase().prepare('SELECT snapshot_json FROM worlds WHERE id=?').get(worldId) as
    | { snapshot_json?: string }
    | undefined
  if (!world?.snapshot_json) return
  const snapshot = JSON.parse(world.snapshot_json) as WorldSlice
  const rows = getDatabase()
    .prepare(
      `SELECT id,name,properties_json FROM graph_entities WHERE world_id=? AND actionable=1 AND status='active'`,
    )
    .all(worldId) as Array<{ id: string; name: string; properties_json: string }>
  const existing = new Set(snapshot.agents.npcs.map((agent) => agent.genetics.seed))
  for (const row of rows) {
    if (existing.has(row.id)) continue
    const props = JSON.parse(row.properties_json || '{}') as Record<string, unknown>
    const agent = createPersonalAgent(row.id)
    agent.identity.name = row.name
    agent.occupation =
      typeof props.occupation === 'string' ? props.occupation : typeof props.role === 'string' ? props.role : undefined
    agent.core_belief = typeof props.core_belief === 'string' ? props.core_belief : undefined
    agent.goals = Array.isArray(props.goals) ? props.goals.map(String) : []
    snapshot.agents.npcs.push(agent)
  }
  updateWorld(worldId, { snapshot })
}

function persistGraph(
  worldId: string,
  importId: string,
  graph: Awaited<ReturnType<typeof readGraph>>,
  ontology: WorldOntology,
) {
  const now = new Date().toISOString()
  const actionable = new Set(ontology.entityTypes.filter((type) => type.actionable).map((type) => type.name))
  for (const node of graph.nodes) {
    const type = node.labels?.find((label) => !['Entity', 'Node'].includes(label)) || 'Entity'
    const id = stableId('entity', `${worldId}:source:${node.uuid}`)
    upsertEntity(
      {
        id,
        worldId,
        graphLayer: 'source',
        externalId: node.uuid,
        type,
        name: node.name,
        aliases: Array.isArray(node.attributes?.aliases) ? node.attributes.aliases.map(String) : [],
        properties: { summary: node.summary, ...(node.attributes || {}) },
        status: 'active',
        actionable: actionable.has(type),
        provenance: {
          importId,
          episodeId: Array.isArray(node.attributes?.episodes) ? String(node.attributes.episodes[0] || '') : undefined,
        },
        createdAt: node.createdAt || now,
        updatedAt: now,
      },
      importId,
    )
  }
  for (const edge of graph.edges) {
    const scope = (['objective', 'public_narrative', 'character_belief'].includes(String(edge.attributes?.claim_scope))
      ? edge.attributes?.claim_scope
      : 'objective') as ClaimScope
    upsertFact(
      {
        id: stableId('fact', `${worldId}:source:${edge.uuid}`),
        worldId,
        graphLayer: 'source',
        externalId: edge.uuid,
        subjectId: stableId('entity', `${worldId}:source:${edge.sourceNodeUuid}`),
        predicate: edge.name,
        objectId: stableId('entity', `${worldId}:source:${edge.targetNodeUuid}`),
        value: edge.fact,
        scope,
        believerId: typeof edge.attributes?.believer_id === 'string' ? edge.attributes.believer_id : undefined,
        validFrom: edge.validAt,
        validUntil: edge.invalidAt,
        confidence: typeof edge.attributes?.confidence === 'number' ? edge.attributes.confidence : 1,
        provenance: { importId, episodeId: edge.episodes?.[0], excerpt: edge.fact },
        createdAt: edge.createdAt || now,
      },
      importId,
    )
  }
}
