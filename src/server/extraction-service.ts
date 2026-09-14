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
  saveKnowledgeState,
  upsertActorRuntime,
  updateJob,
  updateWorld,
  upsertEntity,
  upsertFact,
} from './novel-repository'
import { getSourceMaterial, sha256 } from './source-ingestion'
import { extractChunk, type ChunkExtraction } from './local-extract'
import { createPersonalAgent } from '@/domain/agents'
import type { WorldSlice } from '@/domain/world'
import { rebuildWiki } from './wiki-service'

const stableId = (prefix: string, value: string) =>
  `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`

function updateImport(importId: string, status: string) {
  getDatabase()
    .prepare(`UPDATE imports SET status=?,updated_at=? WHERE id=?`)
    .run(status, new Date().toISOString(), importId)
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
    updateWorld(worldId, { archiveStatus: 'error' })
  })
  return job
}

async function runExtraction(jobId: string) {
  const job = getJob(jobId)
  if (!job) return
  updateWorld(job.worldId, { archiveStatus: 'extracting' })
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

  report({ status: 'processing', stage: 'extract', progress: 40, message: `正在抽取 ${material.chunks.length} 个文本块的实体与事实` })
  const merged = new Map<string, { name: string; type: string; aliases: Set<string>; summary: string; attributes: Record<string, unknown>; chunkIds: string[] }>()
  const collectedFacts: Array<ChunkExtraction['facts'][number] & { chunkId: string }> = []
  for (let i = 0; i < material.chunks.length; i++) {
    const chunk = material.chunks[i]
    const result = await extractChunk(chunk.content, ontology)
    for (const entity of result.entities) {
      const key = entity.name.toLowerCase()
      const slot =
        merged.get(key) ||
        { name: entity.name, type: entity.type, aliases: new Set<string>(), summary: '', attributes: {}, chunkIds: [] as string[] }
      entity.aliases.forEach((a) => slot.aliases.add(a))
      if (!slot.summary && entity.summary) slot.summary = entity.summary
      Object.assign(slot.attributes, entity.attributes)
      if (!slot.chunkIds.includes(chunk.id)) slot.chunkIds.push(chunk.id)
      merged.set(key, slot)
    }
    for (const fact of result.facts) collectedFacts.push({ ...fact, chunkId: chunk.id })
    report({
      status: 'processing',
      stage: 'extract',
      progress: Math.round(40 + ((i + 1) / material.chunks.length) * 30),
      message: `正在抽取实体与事实（${i + 1}/${material.chunks.length}）`,
    })
  }
  updateImport(job.importId, 'processing')

  report({ status: 'syncing', stage: 'syncing', progress: 72, message: '正在写入本地事实账本' })
  const now = new Date().toISOString()
  const actionable = new Set(ontology.entityTypes.filter((type) => type.actionable).map((type) => type.name))
  let factCount = 0
  for (const slot of merged.values()) {
    const id = stableId('entity', `${job.worldId}:local:${slot.name.toLowerCase()}`)
    upsertEntity(
      {
        id,
        worldId: job.worldId,
        graphLayer: 'source',
        type: slot.type,
        name: slot.name,
        aliases: [...slot.aliases],
        properties: { summary: slot.summary, ...slot.attributes },
        status: 'active',
        actionable: actionable.has(slot.type),
        provenance: { importId: job.importId, chunkId: slot.chunkIds[0], episodeId: slot.chunkIds[0] },
        createdAt: now,
        updatedAt: now,
      },
      job.importId,
    )
  }
  const entityIdOf = (name: string) => stableId('entity', `${job.worldId}:local:${name.toLowerCase()}`)
  for (const fact of collectedFacts) {
    const subjectRow = merged.get(fact.subject.toLowerCase())
    const objectRow = fact.object ? merged.get(fact.object.toLowerCase()) : undefined
    const claimId = stableId('fact', `${job.worldId}:local:${fact.subject.toLowerCase()}:${fact.predicate}:${(fact.object || '').toLowerCase()}:${fact.chunkId}`)
    upsertFact(
      {
        id: claimId,
        worldId: job.worldId,
        graphLayer: 'source',
        subjectId: entityIdOf(fact.subject),
        predicate: fact.predicate,
        objectId: objectRow ? entityIdOf(fact.object as string) : undefined,
        value: objectRow ? undefined : (fact.value ?? (fact.object || '')),
        scope: fact.scope,
        believerId: fact.believer,
        confidence: fact.confidence,
        provenance: { importId: job.importId, chunkId: fact.chunkId, excerpt: typeof fact.value === 'string' ? fact.value : undefined },
        createdAt: now,
      },
      job.importId,
    )
    if (fact.scope === 'public_narrative') {
      saveKnowledgeState({ id: stableId('knowledge', `${job.worldId}:public:${claimId}`), worldId: job.worldId, holderType: 'public', claimId, stance: 'believed', confidence: fact.confidence, learnedAtTick: 0, secrecy: 0 })
    } else if (fact.scope === 'character_belief' && fact.believer) {
      const holderId = entityIdOf(fact.believer)
      saveKnowledgeState({ id: stableId('knowledge', `${job.worldId}:actor:${holderId}:${claimId}`), worldId: job.worldId, holderType: 'actor', holderId, claimId, stance: 'believed', confidence: fact.confidence, learnedAtTick: 0, secrecy: 0.5 })
    }
    void subjectRow
    factCount++
  }
  updateImport(job.importId, 'completed')
  updateWorld(job.worldId, { archiveStatus: 'ready' })
  await rebuildWiki(job.worldId)
  syncActionableAgents(job.worldId)
  report({
    status: 'completed',
    stage: 'completed',
    progress: 100,
    message: `已同步 ${merged.size} 个实体和 ${factCount} 条事实`,
  })
}

const COLLECTIVE_TYPE_PATTERN =
  /(organization|organisation|faction|group|collective|institution|company|corporation|movement|committee|council|army|team|guild|clan|nation|state|组织|阵营|群体|机构|企业|公司|运动|委员会|军队|小队|部落|国家|诸庭|群落)/i
const GENERIC_ACTOR_NAME_PATTERN =
  /^(部分|一些|若干|所有|各(?:类|方)?|一群|某些|认为.+的)|(?:群体|诸庭|群落|运动|共同体|联合企业|委员会|机构|体系|计划|小队|卫队|学者|成员|派)$/

function isPersonalAgentEntity(row: { type: string; name: string }, individualTypes: Set<string>) {
  return individualTypes.has(row.type) && !GENERIC_ACTOR_NAME_PATTERN.test(row.name)
}

export type ActionableAgentSyncResult = {
  added: number
  removed: number
  total: number
  candidateEntityCount: number
}

/**
 * Materialize individual, decision-capable archive entities as personal agents.
 * This is deliberately idempotent and also repairs earlier imports where the
 * ontology incorrectly marked an organization or a generic group as actionable.
 */
export function syncActionableAgents(worldId: string): ActionableAgentSyncResult {
  const world = getDatabase().prepare('SELECT snapshot_json FROM worlds WHERE id=?').get(worldId) as
    | { snapshot_json?: string }
    | undefined
  if (!world?.snapshot_json) return { added: 0, removed: 0, total: 0, candidateEntityCount: 0 }
  const snapshot = JSON.parse(world.snapshot_json) as WorldSlice
  const ontology = getLatestOntology(worldId)
  const typeDisplayNames = new Map((ontology?.entityTypes || []).map((type) => [type.name, type.displayName] as const))
  const individualTypes = new Set(
    (ontology?.entityTypes || [])
      .filter((type) => type.actionable && !COLLECTIVE_TYPE_PATTERN.test(`${type.name} ${type.displayName} ${type.description}`))
      .map((type) => type.name),
  )
  const allEntityRows = getDatabase()
    .prepare(
      `SELECT id,type,name,properties_json,actionable FROM entities WHERE world_id=? AND status='active'`,
    )
    .all(worldId) as Array<{ id: string; type: string; name: string; properties_json: string; actionable: number }>
  const rows = allEntityRows.filter((row) => {
    if (!isPersonalAgentEntity(row, individualTypes)) return false
    if (row.name === row.type || row.name === typeDisplayNames.get(row.type)) return false
    const props = JSON.parse(row.properties_json || '{}') as Record<string, unknown>
    const summary = typeof props.summary === 'string' ? props.summary : ''
    if (/^(?:一|两|三|四|五|六|七|八|九|十|数|多)[只名位个群]/.test(summary)) return false
    if (/(?:母本|文档|资料|项目).{0,8}(?:创作者|作者)|(?:创作者|作者).{0,8}(?:母本|文档|资料|项目)/.test(summary)) return false
    return true
  })
  const validIds = new Set(rows.map((row) => row.id))
  const entityIds = new Set(allEntityRows.map((row) => row.id))
  const before = snapshot.agents.npcs.length
  snapshot.agents.npcs = snapshot.agents.npcs.filter((agent) => {
    const seed = agent.genetics.seed
    return !entityIds.has(seed) || validIds.has(seed)
  })
  const removed = before - snapshot.agents.npcs.length
  const existing = new Set(snapshot.agents.npcs.map((agent) => agent.genetics.seed))
  let added = 0
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
    existing.add(row.id)
    added++
  }

  const invalidEntityIds = allEntityRows
    .filter((row) => row.actionable === 1 && !validIds.has(row.id))
    .map((row) => row.id)
  if (invalidEntityIds.length) {
    const placeholders = invalidEntityIds.map(() => '?').join(',')
    getDatabase().prepare(`UPDATE entities SET actionable=0 WHERE id IN (${placeholders})`).run(...invalidEntityIds)
    getDatabase().prepare(`DELETE FROM actor_runtime WHERE actor_id IN (${placeholders})`).run(...invalidEntityIds)
  }
  const restoredEntityIds = allEntityRows
    .filter((row) => row.actionable !== 1 && validIds.has(row.id))
    .map((row) => row.id)
  if (restoredEntityIds.length) {
    const placeholders = restoredEntityIds.map(() => '?').join(',')
    getDatabase().prepare(`UPDATE entities SET actionable=1 WHERE id IN (${placeholders})`).run(...restoredEntityIds)
  }

  const existingRuntime = new Set(
    (getDatabase().prepare('SELECT actor_id FROM actor_runtime WHERE world_id=?').all(worldId) as Array<{ actor_id: string }>).map(
      (runtime) => runtime.actor_id,
    ),
  )
  for (const row of rows) {
    if (existingRuntime.has(row.id)) continue
    upsertActorRuntime({
      actorId: row.id,
      worldId,
      lifecycle: 'candidate',
      agencyScore: 0.6,
      locked: false,
      promotionReason: '由资料中的可行动个体自动建立',
    })
  }

  // Wire graph relations into agent relations + initial memory so synced
  // agents are not islands: the graph already knows who met whom.
  const names = new Map(rows.map((row) => [row.id, row.name] as const))
  const syncedIds = new Set(rows.map((row) => row.id))
  const facts = getDatabase()
    .prepare(
      `SELECT subject_id,object_id,predicate,value_json FROM claims WHERE world_id=? AND origin='source' AND object_id IS NOT NULL`,
    )
    .all(worldId) as Array<{ subject_id: string; object_id: string; predicate: string; value_json: unknown }>
  for (const fact of facts) {
    if (!syncedIds.has(fact.subject_id) || !syncedIds.has(fact.object_id)) continue
    const agent = snapshot.agents.npcs.find((a) => a.genetics.seed === fact.subject_id)
    if (!agent) continue
    if (agent.relations[fact.object_id] !== undefined) continue
    agent.relations[fact.object_id] = 0
    const objectName = names.get(fact.object_id) || fact.object_id
    agent.memory_short.push({
      id: `init-graphrel-${fact.subject_id}-${fact.predicate}-${fact.object_id}`.slice(0, 80),
      content: `${names.get(fact.subject_id) || fact.subject_id} ${fact.predicate} ${objectName}`,
      importance: 0.7,
      emotional_weight: 0.2,
      source: 'social' as const,
      timestamp: new Date().toISOString(),
      decay_rate: 0.02,
      retrieval_strength: 0.9,
    })
  }
  updateWorld(worldId, { snapshot })
  return { added, removed, total: snapshot.agents.npcs.length, candidateEntityCount: rows.length }
}
