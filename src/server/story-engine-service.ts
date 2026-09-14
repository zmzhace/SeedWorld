import 'server-only'

import { randomUUID } from 'node:crypto'
import type { StoryEngine } from '@/domain/narrative-workflow'
import { getDatabase } from './database'
import { getWorld, listArchive } from './novel-repository'
import { chatJson } from './llm/openai-compat'
import type { BookFoundation } from '@/domain/narrative-workflow'

const arr = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
function parse(value: unknown): StoryEngine | null {
  try { return typeof value === 'string' ? JSON.parse(value) as StoryEngine : null } catch { return null }
}

function map(row: Record<string, unknown>): StoryEngine {
  const value = parse(row.engine_json) || {} as StoryEngine
  return {
    id: String(row.id), worldId: String(row.world_id), version: Number(row.version),
    foundationVersion: Number(row.foundation_version), status: String(row.status) as StoryEngine['status'],
    signatureExperience: text(value.signatureExperience, ''),
    dramaticQuestion: text(value.dramaticQuestion, ''),
    repeatableSituation: text(value.repeatableSituation, ''),
    protagonistMethod: text(value.protagonistMethod, ''),
    oppositionSources: arr(value.oppositionSources), scarceResources: arr(value.scarceResources), failureCosts: arr(value.failureCosts),
    progressionRewards: arr(value.progressionRewards), variationAxes: arr(value.variationAxes), escalationAxes: arr(value.escalationAxes),
    resetMechanisms: arr(value.resetMechanisms), exhaustionSignals: arr(value.exhaustionSignals),
    emotionalPromise: text(value.emotionalPromise, ''),
    forbiddenRepetitions: arr(value.forbiddenRepetitions), evidenceClaimIds: arr(value.evidenceClaimIds),
    createdAt: String(row.created_at), confirmedAt: row.confirmed_at ? String(row.confirmed_at) : undefined,
  }
}

function getFoundation(worldId: string): BookFoundation | null {
  const row = getDatabase().prepare('SELECT foundation_json,status,confirmed_at FROM book_foundations WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as { foundation_json: string; status: string; confirmed_at?: string } | undefined
  if (!row) return null
  try { return { ...JSON.parse(row.foundation_json), status: row.status, confirmedAt: row.confirmed_at || undefined } as BookFoundation } catch { return null }
}

export function getStoryEngine(worldId: string): StoryEngine | null {
  const row = getDatabase().prepare('SELECT * FROM story_engines WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as Record<string, unknown> | undefined
  return row ? map(row) : null
}

export async function ensureStoryEngineDraft(worldId: string, force = false): Promise<StoryEngine> {
  const existing = getStoryEngine(worldId)
  const foundation = getFoundation(worldId)
  if (!foundation) throw new Error('作品根基不存在')
  if (!force && existing && existing.foundationVersion === foundation.version && existing.status !== 'stale') return existing
  const world = getWorld(worldId)
  if (!world) throw new Error('世界不存在')
  const archive = listArchive(worldId, { limit: 100 })
  const prompt = [
      '你是通用长篇小说的故事架构师。根据作品资料提炼一个可持续但可变形的故事发动机。',
      '不写章节，不预设终局，不增加资料外的客观真相。返回 JSON：',
      'signatureExperience,dramaticQuestion,repeatableSituation,protagonistMethod,oppositionSources[],scarceResources[],failureCosts[],progressionRewards[],variationAxes[],escalationAxes[],resetMechanisms[],exhaustionSignals[],emotionalPromise,forbiddenRepetitions[],evidenceClaimIds[]。',
      'evidenceClaimIds 只能引用给出的真实命题 ID。',
      '作品：' + world.title, '根基：' + JSON.stringify(foundation),
      '事实摘要：' + JSON.stringify(archive.claims.slice(0, 60)),
      '实体摘要：' + JSON.stringify(archive.entities.slice(0, 60)),
    ].join('\n')
  const raw = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 4096 })
  const requiredText = ['signatureExperience', 'dramaticQuestion', 'repeatableSituation', 'protagonistMethod', 'emotionalPromise'] as const
  const requiredLists = ['oppositionSources', 'scarceResources', 'failureCosts', 'progressionRewards', 'variationAxes', 'escalationAxes', 'resetMechanisms', 'exhaustionSignals', 'forbiddenRepetitions'] as const
  const missing = [
    ...requiredText.filter((key) => typeof raw[key] !== 'string' || !String(raw[key]).trim()),
    ...requiredLists.filter((key) => !Array.isArray(raw[key]) || arr(raw[key]).length === 0),
  ]
  if (missing.length) throw new Error(`故事发动机生成不完整，缺少：${missing.join('、')}`)
  const claimIds = new Set(archive.claims.map((claim: any) => String(claim.id)))
  const value: Omit<StoryEngine, 'id'|'worldId'|'version'|'createdAt'> = {
    foundationVersion: foundation.version, status: 'draft',
    signatureExperience: String(raw.signatureExperience).trim(),
    dramaticQuestion: String(raw.dramaticQuestion).trim(),
    repeatableSituation: String(raw.repeatableSituation).trim(),
    protagonistMethod: String(raw.protagonistMethod).trim(),
    oppositionSources: arr(raw.oppositionSources).slice(0, 8), scarceResources: arr(raw.scarceResources).slice(0, 8),
    failureCosts: arr(raw.failureCosts).slice(0, 8), progressionRewards: arr(raw.progressionRewards).slice(0, 8),
    variationAxes: arr(raw.variationAxes).slice(0, 8), escalationAxes: arr(raw.escalationAxes).slice(0, 8),
    resetMechanisms: arr(raw.resetMechanisms).slice(0, 6), exhaustionSignals: arr(raw.exhaustionSignals).slice(0, 8),
    emotionalPromise: String(raw.emotionalPromise).trim(), forbiddenRepetitions: arr(raw.forbiddenRepetitions).slice(0, 8),
    evidenceClaimIds: arr(raw.evidenceClaimIds).filter((id) => claimIds.has(id)),
  }
  const db = getDatabase()
  const version = Number((db.prepare('SELECT COALESCE(MAX(version),0)+1 AS value FROM story_engines WHERE world_id=?').get(worldId) as { value: number }).value)
  const now = new Date().toISOString(); const id = randomUUID()
  db.prepare("UPDATE story_engines SET status='stale' WHERE world_id=? AND status='draft'").run(worldId)
  db.prepare('INSERT INTO story_engines (id,world_id,version,foundation_version,status,engine_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, worldId, version, foundation.version, 'draft', JSON.stringify({ ...value, id, worldId, version, createdAt: now }), now)
  return getStoryEngine(worldId)!
}

export async function regenerateStoryEngineDraft(worldId: string): Promise<StoryEngine> {
  return ensureStoryEngineDraft(worldId, true)
}

export function saveStoryEngine(worldId: string, patch: Partial<StoryEngine>): StoryEngine {
  const current = getStoryEngine(worldId)
  if (!current) throw new Error('故事发动机不存在')
  if (current.status === 'confirmed') throw new Error('已确认的故事发动机不能直接覆盖，请先创建新版本')
  const next = { ...current, ...patch, id: current.id, worldId, version: current.version, status: 'draft' as const }
  getDatabase().prepare('UPDATE story_engines SET engine_json=? WHERE id=?').run(JSON.stringify(next), current.id)
  return getStoryEngine(worldId)!
}

export function confirmStoryEngine(worldId: string): StoryEngine {
  const current = getStoryEngine(worldId); const foundation = getFoundation(worldId)
  if (!current || !foundation) throw new Error('故事发动机或作品根基不存在')
  if (current.foundationVersion !== foundation.version) throw new Error('故事发动机对应的作品根基已过期，请重新生成')
  const missing = ['signatureExperience','dramaticQuestion','repeatableSituation','protagonistMethod','emotionalPromise']
    .filter((key) => !String((current as any)[key] || '').trim())
  if (missing.length || !current.oppositionSources.length || !current.failureCosts.length) throw new Error('故事发动机缺少核心循环、阻力或失败代价')
  const now = new Date().toISOString()
  getDatabase().prepare("UPDATE story_engines SET status='confirmed',confirmed_at=? WHERE id=?").run(now, current.id)
  return getStoryEngine(worldId)!
}
