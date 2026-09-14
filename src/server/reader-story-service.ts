import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { BookFoundation, ChapterOutline, CharacterDecisionSignature, ReaderComprehensionReview, StoryEngine } from '@/domain/narrative-workflow'
import { getDatabase } from './database'
import { getWorld } from './novel-repository'
import { chatJson } from './llm/openai-compat'

const parse = <T>(value: unknown, fallback: T): T => { try { return typeof value === 'string' ? JSON.parse(value) as T : (value as T) ?? fallback } catch { return fallback } }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const strings = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : []

function latestFoundation(worldId: string): BookFoundation | null {
  const row = getDatabase().prepare('SELECT id,world_id,version,foundation_json,status,created_at,confirmed_at FROM book_foundations WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as { id: string; world_id: string; version: number; foundation_json: string; status: string; created_at: string; confirmed_at?: string } | undefined
  if (!row) return null
  return { ...parse<Record<string, unknown>>(row.foundation_json, {}), id: row.id, worldId: row.world_id, version: Number(row.version), status: row.status, createdAt: row.created_at, confirmedAt: row.confirmed_at || undefined } as BookFoundation
}

export function ensureReaderQuestions(worldId: string) {
  const foundation = latestFoundation(worldId)
  if (!foundation) return []
  const db = getDatabase(); const now = new Date().toISOString()
  const insert = db.prepare('INSERT OR IGNORE INTO reader_questions (id,world_id,question,status,importance,question_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
  const questions = Array.isArray(foundation.requiredLongTermQuestions) && foundation.requiredLongTermQuestions.length
    ? foundation.requiredLongTermQuestions
    : [{ id: 'foundation-theme', question: foundation.thematicQuestion || foundation.centralConflict || '核心矛盾将如何改变人物的选择？', status: 'open' as const, answerEventIds: [] }]
  questions.forEach((q, i) => {
    const question = typeof q === 'string' ? q : q.question
    const value = typeof q === 'string' ? { question, status: 'planted', answerEventIds: [] } : q
    insert.run(`rq_${worldId}_${foundation.version}_${i}`, worldId, question, 'planted', (typeof q === 'object' && q.importance) || 'core', JSON.stringify(value), now, now)
  })
  return listReaderQuestions(worldId)
}

export function listReaderQuestions(worldId: string) {
  const rows = getDatabase().prepare("SELECT * FROM reader_questions WHERE world_id=? ORDER BY CASE importance WHEN 'core' THEN 0 WHEN 'arc' THEN 1 ELSE 2 END,created_at").all(worldId) as any[]
  return rows.map((r) => ({ ...parse(r.question_json, {}), id: String(r.id), worldId: String(r.world_id), question: String(r.question), status: String(r.status), importance: String(r.importance) }))
}

export function getReaderState(worldId: string) {
  ensureReaderQuestions(worldId)
  const revelations = getDatabase().prepare('SELECT * FROM reader_revelations WHERE world_id=? ORDER BY created_at').all(worldId) as any[]
  return { questions: listReaderQuestions(worldId), revelations: revelations.map((r) => ({ ...r, evidence: parse(r.evidence_json, {}) })) }
}

export function getReaderQuestion(worldId: string, id: string) {
  ensureReaderQuestions(worldId)
  const row = getDatabase().prepare('SELECT * FROM reader_questions WHERE world_id=? AND id=?').get(worldId, id) as any
  return row ? { ...parse(row.question_json, {}), id: String(row.id), worldId: String(row.world_id), question: String(row.question), status: String(row.status), importance: String(row.importance) } : null
}

export function getCharacterDecisionSignature(worldId: string, actorId: string): CharacterDecisionSignature | null {
  const row = getDatabase().prepare('SELECT * FROM character_decision_signatures WHERE world_id=? AND actor_id=? ORDER BY version DESC LIMIT 1').get(worldId, actorId) as any
  return row ? { ...parse(row.signature_json, {}), id: String(row.id), worldId, actorId, version: Number(row.version), authorLocked: Boolean(row.author_locked), createdAt: String(row.created_at) } as CharacterDecisionSignature : null
}

export async function ensureCharacterDecisionSignature(worldId: string, actorId: string): Promise<CharacterDecisionSignature> {
  const existing = getCharacterDecisionSignature(worldId, actorId)
  if (existing) return existing
  const world = getWorld(worldId)
  const actor = (world?.snapshot as any)?.agents?.npcs?.find((item: any) => item.genetics?.seed === actorId)
  if (!actor) throw new Error(`人物 ${actorId} 不存在，无法建立选择签名`)
  const db = getDatabase()
  const events = db.prepare("SELECT id,summary FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL AND actor_ids_json LIKE ? ORDER BY tick DESC LIMIT 12").all(worldId, `%${actorId}%`) as any[]
  const raw = await chatJson([{ role: 'user', content: `你是人物连续性编辑。只根据人物资料和已发布行为提炼稳定的选择签名，不补写经历，不规划剧情。返回 JSON：protectedValue,usualMethod,fearedCost,moralBoundary,pressureFailureMode,internalContradiction,supportingEventIds[],contradictingEventIds[]。事件 ID 只能引用给定列表。\n人物：${JSON.stringify({ id: actorId, name: actor.identity?.name, belief: actor.core_belief, goals: actor.goals, relations: actor.relations, memories: actor.memory_long })}\n已发布事件：${JSON.stringify(events)}` }], { maxTokens: 2600 })
  const required = ['protectedValue','usualMethod','fearedCost','moralBoundary','pressureFailureMode','internalContradiction']
  if (required.some((key) => !text(raw[key]))) throw new Error(`人物 ${actor.identity?.name || actorId} 的选择签名不完整`)
  const eventIds = new Set(events.map((event) => String(event.id))); const now = new Date().toISOString(); const id = randomUUID()
  const signature: CharacterDecisionSignature = { id, worldId, actorId, version: 1, protectedValue: text(raw.protectedValue), usualMethod: text(raw.usualMethod), fearedCost: text(raw.fearedCost), moralBoundary: text(raw.moralBoundary), pressureFailureMode: text(raw.pressureFailureMode), internalContradiction: text(raw.internalContradiction), supportingEventIds: strings(raw.supportingEventIds).filter((value) => eventIds.has(value)), contradictingEventIds: strings(raw.contradictingEventIds).filter((value) => eventIds.has(value)), authorLocked: false, createdAt: now }
  db.prepare('INSERT INTO character_decision_signatures (id,world_id,actor_id,version,signature_json,author_locked,created_at) VALUES (?,?,?,?,?,?,?)').run(id, worldId, actorId, 1, JSON.stringify(signature), 0, now)
  return signature
}

export function applyReaderAndStoryProjection(db: any, input: { worldId: string; chapterId: string; chapterNumber: number; tick: number; eventId?: string; outline?: ChapterOutline; review: ReaderComprehensionReview; engine: StoryEngine; actorIds: string[] }) {
  const now = new Date().toISOString(); const outline = input.outline
  const updateQuestion = db.prepare("UPDATE reader_questions SET status=?,updated_at=?,question_json=json_set(question_json,'$.lastAdvancedAtChapter',?) WHERE world_id=? AND id=?")
  for (const id of outline?.advancedQuestionIds || []) updateQuestion.run('investigating', now, input.chapterNumber, input.worldId, id)
  for (const id of outline?.answeredQuestionIds || []) updateQuestion.run('answered', now, input.chapterNumber, input.worldId, id)
  const insertQuestion = db.prepare('INSERT OR IGNORE INTO reader_questions (id,world_id,question,status,importance,question_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
  for (const value of outline?.createdQuestionIds || []) {
    if (db.prepare('SELECT 1 FROM reader_questions WHERE world_id=? AND id=?').get(input.worldId, value)) continue
    const id = `rq_${createHash('sha256').update(`${input.worldId}:${value}`).digest('hex').slice(0, 20)}`
    insertQuestion.run(id, input.worldId, value, 'planted', 'local', JSON.stringify({ question: value, status: 'planted', openedAtChapter: input.chapterNumber, answerEventIds: [] }), now, now)
  }
  const reveal = db.prepare('INSERT INTO reader_revelations (id,world_id,chapter_id,question_id,kind,content,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
  if (input.review.localPayoff) reveal.run(randomUUID(), input.worldId, input.chapterId, outline?.answeredQuestionIds?.[0] || null, 'explicit', input.review.localPayoff, JSON.stringify({ consequence: input.review.consequence }), now)
  if (input.review.reasonToContinue) reveal.run(randomUUID(), input.worldId, input.chapterId, null, 'inferred', input.review.reasonToContinue, JSON.stringify({ source: 'reader_comprehension_review' }), now)
  db.prepare('INSERT OR REPLACE INTO story_engine_usage (id,world_id,engine_version,tick,conflict_pattern,escalation_axis,local_payoff,created_at) VALUES (?,?,?,?,?,?,?,?)').run(`engine-use-${input.worldId}-${input.tick}`, input.worldId, input.engine.version, input.tick, outline?.conflictMode || null, input.engine.escalationAxes.find((axis) => outline?.engineFunction?.includes(axis)) || null, Number(Boolean(input.review.localPayoff)), now)
  for (const actorId of input.actorIds) {
    const signature = getCharacterDecisionSignature(input.worldId, actorId)
    if (!signature || !input.eventId) continue
    const next = { ...signature, supportingEventIds: [...new Set([...signature.supportingEventIds, input.eventId])] }
    db.prepare('UPDATE character_decision_signatures SET signature_json=? WHERE id=?').run(JSON.stringify(next), signature.id)
  }
}
