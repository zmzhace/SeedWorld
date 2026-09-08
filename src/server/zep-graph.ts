import 'server-only'

import { createHash } from 'node:crypto'
import { ZepClient, entityFields, type EntityType, type EdgeType } from '@getzep/zep-cloud'
import type { WorldOntology } from '@/domain/novel-graph'

/**
 * Zep Cloud graph I/O.
 *
 * Ingestion flow ported from MiroFish
 * `backend/app/services/graph_builder.py` (the proven path):
 * - graph create with a caller-durable ID + lost-reply reconciliation
 * - ontology install with guaranteed non-empty field maps
 * - episode ingestion: one `graph.add` per chunk (the Batch `batch.add`
 *   endpoint currently rejects items on this project), then poll every
 *   episode's `processed` flag with a deployment deadline — mirroring
 *   MiroFish `_wait_for_episodes` — instead of fire-and-forget calls that
 *   can silently under-ingest.
 *
 * Reads (`readGraph`) keep cursor pagination for nodes/edges.
 */

const MAX_ITEM_CHARS = 10_000
const POLL_INTERVAL_MS = 3000

function ingestionTimeoutMs(): number {
  const seconds = Number(process.env.ZEP_INGESTION_WAIT_TIMEOUT_SECONDS || 1800)
  return Math.max(600, Number.isFinite(seconds) ? seconds : 1800) * 1000
}

function client() {
  const apiKey = process.env.ZEP_API_KEY
  if (!apiKey) throw new Error('ZEP_API_KEY 未配置')
  return new ZepClient({ apiKey })
}

const fieldFactory = {
  text: entityFields.text,
  integer: entityFields.integer,
  float: entityFields.float,
  boolean: entityFields.boolean,
}

export async function ensureGraph(graphId: string, name: string) {
  const zep = client()
  try {
    await zep.graph.get(graphId)
    return
  } catch {
    // not found → create below
  }
  try {
    await zep.graph.create({
      graphId,
      name,
      description: 'SeedWorld fiction knowledge graph',
      timeZone: process.env.TZ || 'Asia/Shanghai',
    })
  } catch (error) {
    // A create response can be lost after the server accepted it.
    // Reconcile with a safe GET instead of failing the whole extraction.
    try {
      await zep.graph.get(graphId)
      return
    } catch {
      throw error
    }
  }
}

export async function setGraphOntology(graphId: string, ontology: WorldOntology) {
  const entities: Record<string, EntityType> = {}
  for (const type of ontology.entityTypes) {
    const fields = Object.fromEntries(
      type.fields.map((field) => [field.name, fieldFactory[field.type](field.description)]),
    )
    if (!Object.keys(fields).length) fields.details = entityFields.text('Additional details.')
    entities[type.name] = { description: type.description, fields }
  }
  const edges: Record<string, EdgeType> = {}
  for (const type of ontology.relationTypes) {
    const fields = Object.fromEntries(
      type.fields.map((field) => [field.name, fieldFactory[field.type](field.description)]),
    )
    edges[type.name] = {
      description: type.description,
      fields,
      sourceTargets: type.sourceTargets,
    }
  }
  await client().graph.setOntology(entities, edges, { graphIds: [graphId] })
}

export type TextChunkInput = { id: string; content: string; sourceId: string; ordinal: number }

export function validateChunks(chunks: TextChunkInput[]): void {
  if (!chunks.length) throw new Error('At least one text chunk is required')
  const oversized = chunks.findIndex((chunk) => chunk.content.length > MAX_ITEM_CHARS)
  if (oversized !== -1) throw new Error(`Text chunk exceeds 10,000 characters at index ${oversized}`)
}

/**
 * Submit one episode per chunk and return their uuids in order.
 * Requests are sequential: episode creation is not documented as
 * idempotent, and an ambiguous replay can duplicate graph episodes.
 */
export async function submitEpisodes(
  graphId: string,
  chunks: TextChunkInput[],
  onProgress?: (message: string, fraction: number) => void,
): Promise<{ episodeUuids: string[] }> {
  if (!graphId) throw new Error('graph_id is required')
  validateChunks(chunks)
  const zep = client()
  const episodeUuids: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    onProgress?.(
      `正在提交文本块 ${i + 1}/${chunks.length}`,
      chunks.length === 1 ? 1 : i / chunks.length,
    )
    const episode = await zep.graph.add(
      {
        graphId,
        data: chunk.content,
        type: 'text',
        strictOntology: false,
        sourceDescription: `SeedWorld source ${chunk.sourceId} chunk ${chunk.ordinal}`,
        metadata: {
          seedworld_chunk_id: chunk.id,
          source_id: chunk.sourceId,
          ordinal: chunk.ordinal,
        },
      },
      { timeoutInSeconds: 120, maxRetries: 2 },
    )
    const uuid = (episode as { uuid?: string }).uuid
    if (!uuid) throw new Error('Zep episode creation returned no uuid')
    episodeUuids.push(uuid)
  }
  onProgress?.(`已提交 ${episodeUuids.length} 个文本块`, 1)
  return { episodeUuids }
}

/**
 * Poll every episode's `processed` flag until all are done.
 * Mirrors MiroFish `_wait_for_episodes`.
 */
export async function waitForEpisodes(
  episodeUuids: string[],
  onProgress?: (message: string, fraction: number) => void,
  timeoutMs: number = ingestionTimeoutMs(),
): Promise<void> {
  const zep = client()
  const pending = new Set(episodeUuids)
  const total = episodeUuids.length
  const startedAt = Date.now()
  onProgress?.(`正在等待 Zep 处理 ${total} 个文本块`, 0)
  while (pending.size) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Zep episode processing timed out with ${pending.size} episode(s) still pending`,
      )
    }
    for (const uuid of [...pending]) {
      const episode = await zep.graph.episode.get(uuid)
      if (episode.processed) pending.delete(uuid)
    }
    const done = total - pending.size
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    onProgress?.(
      `Zep 正在抽取实体：已完成 ${done}/${total}（等待 ${pending.size}，已用时 ${elapsed}s）`,
      total ? done / total : 1,
    )
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  onProgress?.(`Zep 抽取完成：${total}/${total}`, 1)
}

export async function readGraph(graphId: string) {
  const zep = client()
  const nodes: Awaited<ReturnType<typeof zep.graph.node.getByGraphId>> = []
  const edges: Awaited<ReturnType<typeof zep.graph.edge.getByGraphId>> = []
  let nodeCursor: string | undefined
  let edgeCursor: string | undefined
  do {
    const response = await zep.graph.node.getByGraphId(graphId, {
      limit: 100,
      ...(nodeCursor === undefined ? {} : { uuidCursor: nodeCursor }),
    })
    nodes.push(...response)
    nodeCursor = response.length === 100 ? response.at(-1)?.uuid : undefined
  } while (nodeCursor)
  do {
    const response = await zep.graph.edge.getByGraphId(graphId, {
      limit: 100,
      ...(edgeCursor === undefined ? {} : { uuidCursor: edgeCursor }),
    })
    edges.push(...response)
    edgeCursor = response.length === 100 ? response.at(-1)?.uuid : undefined
  } while (edgeCursor)
  return { nodes, edges }
}

export async function graphExists(graphId: string) {
  try {
    await client().graph.get(graphId)
    return true
  } catch {
    return false
  }
}
