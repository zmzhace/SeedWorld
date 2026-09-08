import 'server-only'

import { randomUUID } from 'node:crypto'
import type { GraphEntity, GraphFact, ImportJob, WritingSettings, WorldOntology } from '@/domain/novel-graph'
import { DEFAULT_WRITING_SETTINGS } from '@/domain/novel-graph'
import { getDatabase } from './database'

const json = (value: unknown) => JSON.stringify(value)
const parse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export type WorldDocument = {
  id: string
  title?: string
  summary?: string
  prompt: string
  snapshot?: unknown
  writingSettings: WritingSettings
  writingSettingsVersion: number
  sourceGraphId?: string
  evolutionGraphId?: string
  graphSyncStatus: string
  visibilityConfirmed: boolean
  createdAt: string
  updatedAt: string
}

function mapWorld(row: Record<string, unknown>): WorldDocument {
  return {
    id: String(row.id), title: row.title ? String(row.title) : undefined,
    summary: row.summary ? String(row.summary) : undefined, prompt: String(row.prompt),
    snapshot: parse(row.snapshot_json, undefined),
    writingSettings: parse(row.writing_settings_json, DEFAULT_WRITING_SETTINGS),
    writingSettingsVersion: Number(row.writing_settings_version),
    sourceGraphId: row.source_graph_id ? String(row.source_graph_id) : undefined,
    evolutionGraphId: row.evolution_graph_id ? String(row.evolution_graph_id) : undefined,
    graphSyncStatus: String(row.graph_sync_status),
    visibilityConfirmed: Boolean(row.visibility_confirmed),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

export function createWorld(input: { id?: string; prompt?: string; title?: string; writingSettings?: Partial<WritingSettings> }): WorldDocument {
  const db = getDatabase(); const id = input.id || randomUUID(); const now = new Date().toISOString()
  const settings = { ...DEFAULT_WRITING_SETTINGS, ...input.writingSettings }
  db.prepare(`INSERT INTO worlds (id,title,prompt,writing_settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run(id, input.title || null, input.prompt || '', json(settings), now, now)
  return getWorld(id)!
}

export function getWorld(id: string): WorldDocument | null {
  const row = getDatabase().prepare('SELECT * FROM worlds WHERE id=?').get(id) as Record<string, unknown> | undefined
  return row ? mapWorld(row) : null
}

export function listWorlds(): WorldDocument[] {
  return (getDatabase().prepare('SELECT * FROM worlds ORDER BY updated_at DESC').all() as Record<string, unknown>[]).map(mapWorld)
}

export function updateWorld(id: string, patch: { title?: string; summary?: string; snapshot?: unknown; writingSettings?: Partial<WritingSettings>; graphSyncStatus?: string; sourceGraphId?: string; evolutionGraphId?: string; visibilityConfirmed?: boolean }): WorldDocument | null {
  const current = getWorld(id); if (!current) return null
  const settings = patch.writingSettings ? { ...current.writingSettings, ...patch.writingSettings } : current.writingSettings
  const version = patch.writingSettings ? current.writingSettingsVersion + 1 : current.writingSettingsVersion
  getDatabase().prepare(`UPDATE worlds SET title=?,summary=?,snapshot_json=?,writing_settings_json=?,writing_settings_version=?,source_graph_id=?,evolution_graph_id=?,graph_sync_status=?,visibility_confirmed=?,updated_at=? WHERE id=?`)
    .run(patch.title ?? current.title ?? null, patch.summary ?? current.summary ?? null, patch.snapshot === undefined ? json(current.snapshot) : json(patch.snapshot), json(settings), version, patch.sourceGraphId ?? current.sourceGraphId ?? null, patch.evolutionGraphId ?? current.evolutionGraphId ?? null, patch.graphSyncStatus ?? current.graphSyncStatus, patch.visibilityConfirmed === undefined ? Number(current.visibilityConfirmed) : Number(patch.visibilityConfirmed), new Date().toISOString(), id)
  return getWorld(id)
}

export function saveOntology(ontology: WorldOntology): void {
  getDatabase().prepare(`INSERT INTO ontologies (id,world_id,version,definition_json,rationale,created_at) VALUES (?,?,?,?,?,?)`)
    .run(ontology.id, ontology.worldId, ontology.version, json(ontology), ontology.rationale, ontology.createdAt)
}

export function getLatestOntology(worldId: string): WorldOntology | null {
  const row = getDatabase().prepare('SELECT definition_json FROM ontologies WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as { definition_json: string } | undefined
  return row ? parse<WorldOntology>(row.definition_json, null as never) : null
}

export function upsertEntity(entity: GraphEntity, importId?: string): void {
  getDatabase().prepare(`INSERT INTO graph_entities (id,world_id,graph_layer,external_id,type,name,aliases_json,properties_json,status,actionable,provenance_json,import_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,aliases_json=excluded.aliases_json,properties_json=excluded.properties_json,status=excluded.status,actionable=excluded.actionable,provenance_json=excluded.provenance_json,updated_at=excluded.updated_at`)
    .run(entity.id, entity.worldId, entity.graphLayer, entity.externalId || null, entity.type, entity.name, json(entity.aliases), json(entity.properties), entity.status, Number(entity.actionable), json(entity.provenance), importId || null, entity.createdAt, entity.updatedAt)
}

export function upsertFact(fact: GraphFact, importId?: string): void {
  getDatabase().prepare(`INSERT INTO graph_facts (id,world_id,graph_layer,external_id,subject_id,predicate,object_id,value_json,claim_scope,believer_id,valid_from,valid_until,confidence,provenance_json,import_id,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET predicate=excluded.predicate,object_id=excluded.object_id,value_json=excluded.value_json,claim_scope=excluded.claim_scope,believer_id=excluded.believer_id,valid_from=excluded.valid_from,valid_until=excluded.valid_until,confidence=excluded.confidence,provenance_json=excluded.provenance_json`)
    .run(fact.id, fact.worldId, fact.graphLayer, fact.externalId || null, fact.subjectId, fact.predicate, fact.objectId || null, fact.value === undefined ? null : json(fact.value), fact.scope, fact.believerId || null, fact.validFrom || null, fact.validUntil || null, fact.confidence, json(fact.provenance), importId || null, fact.createdAt)
}

export function listGraph(worldId: string, options: { layer?: string; type?: string; limit?: number; offset?: number } = {}) {
  const limit = Math.min(200, Math.max(1, options.limit || 100)); const offset = Math.max(0, options.offset || 0)
  const where = ['world_id=?']; const args: Array<string | number | null> = [worldId]
  if (options.layer) { where.push('graph_layer=?'); args.push(options.layer) }
  if (options.type) { where.push('type=?'); args.push(options.type) }
  const rows = getDatabase().prepare(`SELECT * FROM graph_entities WHERE ${where.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`).all(...args, limit, offset) as Record<string, unknown>[]
  const facts = getDatabase().prepare(`SELECT * FROM graph_facts WHERE world_id=? ${options.layer ? 'AND graph_layer=?' : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(worldId, ...(options.layer ? [options.layer] : []), limit, offset) as Record<string, unknown>[]
  return {
    entities: rows.map(row => ({ ...row, aliases: parse(row.aliases_json, []), properties: parse(row.properties_json, {}), provenance: parse(row.provenance_json, {}) })),
    facts: facts.map(row => ({ ...row, value: parse(row.value_json, null), provenance: parse(row.provenance_json, {}) })), limit, offset,
  }
}

export function createImport(worldId: string, contentHash: string) {
  const existing = getDatabase().prepare('SELECT * FROM imports WHERE world_id=? AND content_hash=?').get(worldId, contentHash) as Record<string, unknown> | undefined
  if (existing) return { id: String(existing.id), duplicate: true }
  const id = randomUUID(); const now = new Date().toISOString()
  getDatabase().prepare(`INSERT INTO imports (id,world_id,content_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(id, worldId, contentHash, 'queued', now, now)
  return { id, duplicate: false }
}

export function createJob(worldId: string, importId: string): ImportJob {
  const id = randomUUID(); const now = new Date().toISOString()
  getDatabase().prepare(`INSERT INTO jobs (id,world_id,import_id,status,stage,progress,message,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, worldId, importId, 'queued', 'queued', 0, '等待处理', now, now)
  return getJob(id)!
}

export function updateJob(id: string, patch: Partial<Pick<ImportJob, 'status'|'stage'|'progress'|'message'|'error'|'remoteBatchId'>>): void {
  const current = getJob(id); if (!current) return
  getDatabase().prepare(`UPDATE jobs SET status=?,stage=?,progress=?,message=?,error=?,remote_batch_id=?,updated_at=? WHERE id=?`).run(patch.status ?? current.status, patch.stage ?? current.stage, patch.progress ?? current.progress, patch.message ?? current.message, patch.error ?? current.error ?? null, patch.remoteBatchId ?? current.remoteBatchId ?? null, new Date().toISOString(), id)
}

export function getJob(id: string): ImportJob | null {
  const row = getDatabase().prepare('SELECT * FROM jobs WHERE id=?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return { id: String(row.id), worldId: String(row.world_id), importId: String(row.import_id), status: String(row.status) as ImportJob['status'], stage: String(row.stage), progress: Number(row.progress), message: String(row.message), error: row.error ? String(row.error) : undefined, remoteBatchId: row.remote_batch_id ? String(row.remote_batch_id) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

export function rollbackImport(importId: string): boolean {
  const db = getDatabase(); const found = db.prepare('SELECT id FROM imports WHERE id=?').get(importId)
  if (!found) return false
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM graph_facts WHERE import_id=?').run(importId)
    db.prepare('DELETE FROM graph_entities WHERE import_id=?').run(importId)
    db.prepare(`UPDATE imports SET status='rolled_back',updated_at=? WHERE id=?`).run(new Date().toISOString(), importId)
    db.prepare(`UPDATE jobs SET status='rolled_back',stage='rolled_back',progress=100,message='已撤销',updated_at=? WHERE import_id=?`).run(new Date().toISOString(), importId)
    db.exec('COMMIT'); return true
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
