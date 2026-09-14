import 'server-only'

import { randomUUID } from 'node:crypto'
import type { GraphEntity, GraphFact, ImportJob, WritingSettings, WorldOntology } from '@/domain/novel-graph'
import { DEFAULT_WRITING_SETTINGS } from '@/domain/novel-graph'
import { getDatabase } from './database'
import type { ActorRuntime, ActorLifecycle, Scene, SceneParticipant, SceneStatus, StoryThread, StoryThreadStatus } from '@/domain/dynamic-workflow'

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
  archiveStatus: 'empty' | 'extracting' | 'ready' | 'error'
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
    archiveStatus: String(row.archive_status || 'empty') as WorldDocument['archiveStatus'],
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

export function updateWorld(id: string, patch: { title?: string; summary?: string; snapshot?: unknown; writingSettings?: Partial<WritingSettings>; archiveStatus?: WorldDocument['archiveStatus']; visibilityConfirmed?: boolean }): WorldDocument | null {
  const current = getWorld(id); if (!current) return null
  const settings = patch.writingSettings ? { ...current.writingSettings, ...patch.writingSettings } : current.writingSettings
  const version = patch.writingSettings ? current.writingSettingsVersion + 1 : current.writingSettingsVersion
  getDatabase().prepare(`UPDATE worlds SET title=?,summary=?,snapshot_json=?,writing_settings_json=?,writing_settings_version=?,archive_status=?,visibility_confirmed=?,updated_at=? WHERE id=?`)
    .run(patch.title ?? current.title ?? null, patch.summary ?? current.summary ?? null, patch.snapshot === undefined ? json(current.snapshot) : json(patch.snapshot), json(settings), version, patch.archiveStatus ?? current.archiveStatus, patch.visibilityConfirmed === undefined ? Number(current.visibilityConfirmed) : Number(patch.visibilityConfirmed), new Date().toISOString(), id)
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
  const db = getDatabase()
  db.prepare(`INSERT INTO entities (id,world_id,type,name,aliases_json,properties_json,status,actionable,provenance_json,origin,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,aliases_json=excluded.aliases_json,properties_json=excluded.properties_json,status=excluded.status,actionable=excluded.actionable,provenance_json=excluded.provenance_json,origin=excluded.origin,updated_at=excluded.updated_at`)
    .run(entity.id, entity.worldId, entity.type, entity.name, json(entity.aliases), json(entity.properties), entity.status, Number(entity.actionable), json({ ...entity.provenance, importId }), entity.graphLayer === 'evolution' ? 'simulation' : 'source', entity.createdAt, entity.updatedAt)
}

export function upsertFact(fact: GraphFact, importId?: string): void {
  const db = getDatabase()
  db.prepare(`INSERT INTO claims (id,world_id,subject_id,predicate,object_id,value_json,claim_scope,believer_id,valid_from,valid_until,confidence,provenance_json,origin,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET predicate=excluded.predicate,object_id=excluded.object_id,value_json=excluded.value_json,claim_scope=excluded.claim_scope,believer_id=excluded.believer_id,valid_from=excluded.valid_from,valid_until=excluded.valid_until,confidence=excluded.confidence,provenance_json=excluded.provenance_json,origin=excluded.origin`)
    .run(fact.id, fact.worldId, fact.subjectId, fact.predicate, fact.objectId || null, fact.value === undefined ? null : json(fact.value), fact.scope, fact.believerId || null, fact.validFrom || null, fact.validUntil || null, fact.confidence, json({ ...fact.provenance, importId }), fact.graphLayer === 'evolution' ? 'simulation' : 'source', fact.createdAt)
}

export function listArchive(worldId: string, options: { type?: string; origin?: string; limit?: number; offset?: number } = {}) {
  const limit = Math.min(200, Math.max(1, options.limit || 100)); const offset = Math.max(0, options.offset || 0)
  const where = ['world_id=?']; const args: Array<string | number> = [worldId]
  if (options.type) { where.push('type=?'); args.push(options.type) }
  if (options.origin) { where.push('origin=?'); args.push(options.origin) }
  const entities = getDatabase().prepare(`SELECT * FROM entities WHERE ${where.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`).all(...args, limit, offset) as Record<string, unknown>[]
  const claims = getDatabase().prepare(`SELECT * FROM claims WHERE world_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(worldId, limit, offset) as Record<string, unknown>[]
  return {
    entities: entities.map(row => ({ ...row, aliases: parse(row.aliases_json, []), properties: parse(row.properties_json, {}), provenance: parse(row.provenance_json, {}) })),
    claims: claims.map(row => ({ ...row, value: parse(row.value_json, null), provenance: parse(row.provenance_json, {}) })),
    limit, offset,
  }
}

export function saveKnowledgeState(input: { id: string; worldId: string; holderType: 'actor'|'faction'|'public'; holderId?: string; claimId: string; stance: 'believed'|'doubted'|'rejected'; confidence: number; learnedAtTick: number; learnedFromEventId?: string; learnedFromTransmissionId?: string; secrecy?: number; }): void {
  getDatabase().prepare(`INSERT INTO knowledge_states (id,world_id,holder_type,holder_id,claim_id,stance,confidence,learned_at_tick,learned_from_event_id,learned_from_transmission_id,secrecy,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET stance=excluded.stance,confidence=excluded.confidence,learned_at_tick=excluded.learned_at_tick,learned_from_event_id=excluded.learned_from_event_id,learned_from_transmission_id=excluded.learned_from_transmission_id,secrecy=excluded.secrecy`).run(input.id,input.worldId,input.holderType,input.holderId||null,input.claimId,input.stance,input.confidence,input.learnedAtTick,input.learnedFromEventId||null,input.learnedFromTransmissionId||null,input.secrecy||0,new Date().toISOString())
}

export function correctClaim(worldId: string, claimId: string, patch: { truthStatus?: string; confidence?: number; validUntil?: string | null; value?: unknown }) {
  const result = getDatabase().prepare(`UPDATE claims SET truth_status=COALESCE(?,truth_status),confidence=COALESCE(?,confidence),valid_until=COALESCE(?,valid_until),value_json=COALESCE(?,value_json),origin='author' WHERE world_id=? AND id=?`).run(patch.truthStatus || null, patch.confidence ?? null, patch.validUntil === undefined ? null : patch.validUntil, patch.value === undefined ? null : json(patch.value), worldId, claimId)
  return Number(result.changes) > 0
}

export function listGraph(worldId: string, options: { layer?: string; type?: string; limit?: number; offset?: number } = {}) {
  const limit = Math.min(200, Math.max(1, options.limit || 100)); const offset = Math.max(0, options.offset || 0)
  const where = ['world_id=?']; const args: Array<string | number | null> = [worldId]
  if (options.layer) { where.push('origin=?'); args.push(options.layer === 'evolution' ? 'simulation' : options.layer) }
  if (options.type) { where.push('type=?'); args.push(options.type) }
  const rows = getDatabase().prepare(`SELECT * FROM entities WHERE ${where.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`).all(...args, limit, offset) as Record<string, unknown>[]
  const facts = getDatabase().prepare(`SELECT * FROM claims WHERE world_id=? ${options.layer ? 'AND origin=?' : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(worldId, ...(options.layer ? [options.layer === 'evolution' ? 'simulation' : options.layer] : []), limit, offset) as Record<string, unknown>[]
  return {
    entities: rows.map(row => ({ ...row, aliases: parse(row.aliases_json, []), properties: parse(row.properties_json, {}), provenance: parse(row.provenance_json, {}), graph_layer: row.origin === 'simulation' ? 'evolution' : 'source' })),
    facts: facts.map(row => ({ ...row, value: parse(row.value_json, null), provenance: parse(row.provenance_json, {}), graph_layer: row.origin === 'simulation' ? 'evolution' : 'source' })), limit, offset,
  }
}

const decodeList = (value: unknown): string[] => parse<string[]>(value, []).filter((item) => typeof item === 'string')

function mapScene(row: Record<string, unknown>): Scene {
  return { id: String(row.id), worldId: String(row.world_id), tick: Number(row.tick), status: String(row.status) as SceneStatus, timeLabel: String(row.time_label || ''), locationEntityId: row.location_entity_id ? String(row.location_entity_id) : undefined, objective: String(row.objective), conflict: String(row.conflict), entryCause: row.entry_cause ? String(row.entry_cause) : undefined, exitCondition: row.exit_condition ? String(row.exit_condition) : undefined, anchorEventIds: decodeList(row.anchor_event_ids_json), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

export function listScenes(worldId: string, options: { status?: SceneStatus; limit?: number } = {}): Scene[] {
  const limit = Math.min(100, Math.max(1, options.limit || 50))
  const rows = options.status
    ? getDatabase().prepare('SELECT * FROM scenes WHERE world_id=? AND status=? ORDER BY tick DESC, created_at DESC LIMIT ?').all(worldId, options.status, limit)
    : getDatabase().prepare('SELECT * FROM scenes WHERE world_id=? ORDER BY tick DESC, created_at DESC LIMIT ?').all(worldId, limit)
  return (rows as Record<string, unknown>[]).map(mapScene)
}

export function saveScene(input: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Scene {
  const db = getDatabase(); const now = new Date().toISOString(); const id = input.id || randomUUID()
  db.prepare(`INSERT INTO scenes (id,world_id,tick,status,time_label,location_entity_id,objective,conflict,entry_cause,exit_condition,anchor_event_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,time_label=excluded.time_label,location_entity_id=excluded.location_entity_id,objective=excluded.objective,conflict=excluded.conflict,entry_cause=excluded.entry_cause,exit_condition=excluded.exit_condition,anchor_event_ids_json=excluded.anchor_event_ids_json,updated_at=excluded.updated_at`).run(id, input.worldId, input.tick, input.status, input.timeLabel, input.locationEntityId || null, input.objective, input.conflict, input.entryCause || null, input.exitCondition || null, json(input.anchorEventIds), now, now)
  return mapScene(db.prepare('SELECT * FROM scenes WHERE id=?').get(id) as Record<string, unknown>)
}

export function listStoryThreads(worldId: string, options: { status?: StoryThreadStatus; limit?: number } = {}): StoryThread[] {
  const limit = Math.min(100, Math.max(1, options.limit || 50))
  const rows = options.status
    ? getDatabase().prepare('SELECT * FROM story_threads WHERE world_id=? AND status=? ORDER BY pressure DESC, updated_at DESC LIMIT ?').all(worldId, options.status, limit)
    : getDatabase().prepare('SELECT * FROM story_threads WHERE world_id=? ORDER BY pressure DESC, updated_at DESC LIMIT ?').all(worldId, limit)
  return (rows as Record<string, unknown>[]).map((row) => ({ id: String(row.id), worldId: String(row.world_id), title: String(row.title), kind: String(row.kind), status: String(row.status) as StoryThreadStatus, goal: String(row.goal), pressure: Number(row.pressure), ownerEntityIds: decodeList(row.owner_entity_ids_json), parentThreadId: row.parent_thread_id ? String(row.parent_thread_id) : undefined, anchorEventIds: decodeList(row.anchor_event_ids_json), lastAdvancedTick: row.last_advanced_tick == null ? undefined : Number(row.last_advanced_tick), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }))
}

export function saveStoryThread(input: Omit<StoryThread, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): StoryThread {
  const db = getDatabase(); const now = new Date().toISOString(); const id = input.id || randomUUID()
  db.prepare(`INSERT INTO story_threads (id,world_id,title,kind,status,goal,pressure,owner_entity_ids_json,parent_thread_id,anchor_event_ids_json,last_advanced_tick,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,kind=excluded.kind,status=excluded.status,goal=excluded.goal,pressure=excluded.pressure,owner_entity_ids_json=excluded.owner_entity_ids_json,parent_thread_id=excluded.parent_thread_id,anchor_event_ids_json=excluded.anchor_event_ids_json,last_advanced_tick=excluded.last_advanced_tick,updated_at=excluded.updated_at`).run(id, input.worldId, input.title, input.kind, input.status, input.goal, input.pressure, json(input.ownerEntityIds), input.parentThreadId || null, json(input.anchorEventIds), input.lastAdvancedTick ?? null, now, now)
  return listStoryThreads(input.worldId, { limit: 100 }).find((thread) => thread.id === id)!
}

export function upsertActorRuntime(input: Omit<ActorRuntime, 'updatedAt'>): ActorRuntime {
  const now = new Date().toISOString()
  getDatabase().prepare(`INSERT INTO actor_runtime (actor_id,world_id,lifecycle,agency_score,locked,current_scene_id,last_active_tick,promotion_reason,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(actor_id) DO UPDATE SET lifecycle=excluded.lifecycle,agency_score=excluded.agency_score,locked=excluded.locked,current_scene_id=excluded.current_scene_id,last_active_tick=excluded.last_active_tick,promotion_reason=excluded.promotion_reason,updated_at=excluded.updated_at`).run(input.actorId, input.worldId, input.lifecycle, input.agencyScore, Number(input.locked), input.currentSceneId || null, input.lastActiveTick ?? null, input.promotionReason || null, now)
  return { ...input, updatedAt: now }
}

export function listActorRuntime(worldId: string): ActorRuntime[] {
  const rows = getDatabase().prepare('SELECT * FROM actor_runtime WHERE world_id=? ORDER BY agency_score DESC, updated_at DESC').all(worldId) as Record<string, unknown>[]
  return rows.map((row) => ({ actorId: String(row.actor_id), worldId: String(row.world_id), lifecycle: String(row.lifecycle) as ActorLifecycle, agencyScore: Number(row.agency_score), locked: Boolean(row.locked), currentSceneId: row.current_scene_id ? String(row.current_scene_id) : undefined, lastActiveTick: row.last_active_tick == null ? undefined : Number(row.last_active_tick), promotionReason: row.promotion_reason ? String(row.promotion_reason) : undefined, updatedAt: String(row.updated_at) }))
}

export function saveSceneParticipant(input: SceneParticipant): void {
  getDatabase().prepare(`INSERT INTO scene_participants (scene_id,actor_id,role,reason,joined_tick,left_tick) VALUES (?,?,?,?,?,?) ON CONFLICT(scene_id,actor_id) DO UPDATE SET role=excluded.role,reason=excluded.reason,left_tick=excluded.left_tick`).run(input.sceneId, input.actorId, input.role || null, input.reason || null, input.joinedTick, input.leftTick ?? null)
}

export function saveWorkflowCheckpoint(input: { id?: string; worldId: string; runKind: 'tick'|'chapter'|'scene'; runId: string; step: string; inputHash: string; payload?: unknown }): boolean {
  const result = getDatabase().prepare(`INSERT OR IGNORE INTO workflow_checkpoints (id,world_id,run_kind,run_id,step,input_hash,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(input.id || randomUUID(), input.worldId, input.runKind, input.runId, input.step, input.inputHash, json(input.payload || {}), new Date().toISOString())
  return Number(result.changes) > 0
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

export function updateJob(id: string, patch: Partial<Pick<ImportJob, 'status'|'stage'|'progress'|'message'|'error'>>): void {
  const current = getJob(id); if (!current) return
  getDatabase().prepare(`UPDATE jobs SET status=?,stage=?,progress=?,message=?,error=?,updated_at=? WHERE id=?`).run(patch.status ?? current.status, patch.stage ?? current.stage, patch.progress ?? current.progress, patch.message ?? current.message, patch.error ?? current.error ?? null, new Date().toISOString(), id)
}

export function getJob(id: string): ImportJob | null {
  const row = getDatabase().prepare('SELECT * FROM jobs WHERE id=?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return { id: String(row.id), worldId: String(row.world_id), importId: String(row.import_id), status: String(row.status) as ImportJob['status'], stage: String(row.stage), progress: Number(row.progress), message: String(row.message), error: row.error ? String(row.error) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

export function rollbackImport(importId: string): boolean {
  const db = getDatabase(); const found = db.prepare('SELECT id FROM imports WHERE id=?').get(importId)
  if (!found) return false
  db.exec('BEGIN')
  try {
    db.prepare(`DELETE FROM claims WHERE json_extract(provenance_json,'$.importId')=?`).run(importId)
    db.prepare(`DELETE FROM entities WHERE json_extract(provenance_json,'$.importId')=?`).run(importId)
    db.prepare(`UPDATE imports SET status='rolled_back',updated_at=? WHERE id=?`).run(new Date().toISOString(), importId)
    db.prepare(`UPDATE jobs SET status='rolled_back',stage='rolled_back',progress=100,message='已撤销',updated_at=? WHERE import_id=?`).run(new Date().toISOString(), importId)
    db.exec('COMMIT'); return true
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
