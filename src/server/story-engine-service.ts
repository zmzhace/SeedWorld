import 'server-only'

import { randomUUID } from 'node:crypto'
import type { StoryEngine } from '@/domain/narrative-workflow'
import { matchedStoryAnchors, storyEngineSpecificityIssues } from '@/domain/story-engine-validation'
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
  const row = getDatabase().prepare('SELECT id,world_id,version,foundation_json,status,created_at,confirmed_at FROM book_foundations WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as { id: string; world_id: string; version: number; foundation_json: string; status: string; created_at: string; confirmed_at?: string } | undefined
  if (!row) return null
  try {
    return {
      ...JSON.parse(row.foundation_json), id: row.id, worldId: row.world_id,
      version: Number(row.version), status: row.status, createdAt: row.created_at,
      confirmedAt: row.confirmed_at || undefined,
    } as BookFoundation
  } catch { return null }
}

const META_ENTITY_NAMES = new Set([
  'MiroFish', 'SeedWorld', '主角团', '全球体系', '世界', '故事', '小说', '作品', '作者', '读者',
])

function storyAnchors(archive: ReturnType<typeof listArchive>): string[] {
  const candidates = archive.entities
    .map((source) => {
      const entity = source as Record<string, unknown>
      return {
        name: String(entity.name || '').trim(),
        type: String(entity.type || '').toLowerCase(),
        actionable: Boolean(entity.actionable),
        origin: String(entity.origin || ''),
      }
    })
    .filter((entity) => entity.name.length >= 2 && entity.name.length <= 24)
    .filter((entity) => !META_ENTITY_NAMES.has(entity.name))
    .filter((entity) => !/^(某人|某地|未知|其他|普通|entity|concept|event|rule)$/i.test(entity.name))
    .sort((left, right) => {
      const score = (item: typeof left) =>
        Number(item.actionable) * 4
        + Number(item.origin === 'source') * 2
        + Number(/person|character|organization|faction|location|ability|energy|phenomenon|rule|事件|人物|组织|地点|能力|能量/.test(item.type)) * 2
      return score(right) - score(left) || left.name.localeCompare(right.name, 'zh-CN')
    })
  return [...new Set(candidates.map((item) => item.name))].slice(0, 100)
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  foundationVersion: number,
  claimIds: Set<string>,
): Omit<StoryEngine, 'id'|'worldId'|'version'|'createdAt'> {
  return {
    foundationVersion, status: 'draft',
    signatureExperience: String(raw.signatureExperience || '').trim(),
    dramaticQuestion: String(raw.dramaticQuestion || '').trim(),
    repeatableSituation: String(raw.repeatableSituation || '').trim(),
    protagonistMethod: String(raw.protagonistMethod || '').trim(),
    oppositionSources: arr(raw.oppositionSources).slice(0, 8), scarceResources: arr(raw.scarceResources).slice(0, 8),
    failureCosts: arr(raw.failureCosts).slice(0, 8), progressionRewards: arr(raw.progressionRewards).slice(0, 8),
    variationAxes: arr(raw.variationAxes).slice(0, 8), escalationAxes: arr(raw.escalationAxes).slice(0, 8),
    resetMechanisms: arr(raw.resetMechanisms).slice(0, 6), exhaustionSignals: arr(raw.exhaustionSignals).slice(0, 8),
    emotionalPromise: String(raw.emotionalPromise || '').trim(), forbiddenRepetitions: arr(raw.forbiddenRepetitions).slice(0, 8),
    evidenceClaimIds: [...new Set(arr(raw.evidenceClaimIds).filter((id) => claimIds.has(id)))].slice(0, 20),
  }
}

function storyFoundation(foundation: BookFoundation) {
  return {
    corePromise: foundation.corePromise,
    centralConflict: foundation.centralConflict,
    thematicQuestion: foundation.thematicQuestion,
    protagonistPressure: foundation.protagonistPressure,
    requiredLongTermQuestions: foundation.requiredLongTermQuestions,
    immutableRules: foundation.immutableRules,
    forbiddenDirections: foundation.forbiddenDirections,
    forbiddenContent: foundation.forbiddenContent,
    audiencePromise: foundation.audiencePromise,
  }
}

async function reviewCandidate(input: {
  candidate: Omit<StoryEngine, 'id'|'worldId'|'version'|'createdAt'>
  anchors: string[]
  title: string
  foundation: BookFoundation
  sourceEvidence: unknown
}): Promise<string[]> {
  const review = await chatJson([{ role: 'user', content: [
    '你是独立的长篇小说策划主编，只审查下面的 StoryEngine，不续写、不重新设计。',
    '它必须是作品内部反复产生戏剧冲突的机制，而不是写作流程、软件工作流、任务管理或通用方法论。',
    '检查：是否扎根本作具体实体；是否能反复产生人物目标—阻力—代价—局部回报；是否保留变化空间；是否没有预设固定终局；是否没有新增资料外的客观真相。',
    '候选锚点用于确认方案至少落到本作，不是排他白名单：方案出现未列出的名称本身不是错误；不要因为锚点表没有穷举所有资料专名而拒绝。',
    '返回 JSON：{"passed":boolean,"issues":string[],"groundedAnchorNames":string[]}。任何实质问题都必须 passed=false；通过时 issues 必须为空。groundedAnchorNames 只列出你能在 StoryEngine 正文和候选锚点中同时逐字找到的名称。',
    `作品：${input.title}`,
    `作品根基：${JSON.stringify(storyFoundation(input.foundation))}`,
    `候选锚点：${JSON.stringify(input.anchors)}`,
    `来源证据摘要：${JSON.stringify(input.sourceEvidence)}`,
    `候选 StoryEngine：${JSON.stringify(input.candidate)}`,
  ].join('\n') }], { maxTokens: 2400, maxAttempts: 2 })
  const issues = arr(review.issues)
  const grounded = arr(review.groundedAnchorNames).filter((name) => input.anchors.includes(name))
  if (review.passed !== true) issues.unshift('独立策划审查未通过')
  if (grounded.length < Math.min(2, input.anchors.length)) issues.push('独立策划审查无法确认足够的作品锚点')
  if (review.passed === true && issues.length) issues.unshift('审查结论与问题证据冲突')
  return [...new Set(issues)]
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
  const archive = listArchive(worldId, { limit: 200 })
  const anchors = storyAnchors(archive)
  if (anchors.length < 2) throw new Error('作品资料中缺少足够的具体实体，无法生成作品专属故事发动机')
  const claimIds = new Set(archive.claims.map((claim: any) => String(claim.id)))
  const basePrompt = [
      '你是通用长篇小说的故事架构师。根据作品资料提炼一个可持续但可变形的故事发动机。',
      '这里的“故事发动机”是小说内部反复产生人物目标、阻力、选择、代价与局部回报的戏剧机制，不是写作步骤或软件工作流。',
      '严禁写成用户需求、任务拆解、项目计划、解决方案、方法论、步骤清单、团队协作或反馈迭代。',
      '全部字段合计至少命中三个不同的作品锚点，核心体验、戏剧问题或重复情境中至少出现一个；不能只写“主角、敌人、危机、成长”等通用词。',
      '只提炼资料已经明确给出的矛盾类别与机制，不得替任何异能增加使用条件、效果或副作用，不得替人物增加身份、权限、关系或未来奖励。',
      '这是长期可重复的戏剧循环，不要安排具体章节事件，不要把候选结局、旧关键转折或未来身份写进发动机。',
      '不写章节，不预设终局，不增加资料外的客观真相。返回 JSON：',
      'signatureExperience,dramaticQuestion,repeatableSituation,protagonistMethod,oppositionSources[],scarceResources[],failureCosts[],progressionRewards[],variationAxes[],escalationAxes[],resetMechanisms[],exhaustionSignals[],emotionalPromise,forbiddenRepetitions[],evidenceClaimIds[]。',
      'evidenceClaimIds 只能引用给出的真实命题 ID。',
      '作品：' + world.title, '创作说明：' + String(world.prompt || '').slice(0, 3000), '根基：' + JSON.stringify(storyFoundation(foundation)),
      '必须使用的作品锚点候选：' + JSON.stringify(anchors),
      '事实摘要：' + JSON.stringify(archive.claims.slice(0, 60)),
      '实体摘要：' + JSON.stringify(archive.entities.slice(0, 60)),
    ].join('\n')
  let value: Omit<StoryEngine, 'id'|'worldId'|'version'|'createdAt'> | null = null
  let feedback: string[] = []
  for (let attempt = 1; attempt <= 2; attempt++) {
    const correction = feedback.length
      ? `\n上一版被拒绝，必须逐条修正后重新生成完整 JSON：${JSON.stringify(feedback)}`
      : ''
    const raw = await chatJson([{ role: 'user', content: basePrompt + correction }], { maxTokens: 4096, maxAttempts: 2 })
    const candidate = normalizeCandidate(raw, foundation.version, claimIds)
    const deterministicIssues = storyEngineSpecificityIssues(candidate, anchors)
    if (deterministicIssues.length) { feedback = deterministicIssues; continue }
    const reviewIssues = await reviewCandidate({
      candidate, anchors, title: String(world.title || ''), foundation,
      sourceEvidence: archive.claims.slice(0, 80),
    })
    if (reviewIssues.length) { feedback = reviewIssues; continue }
    value = candidate
    break
  }
  if (!value) throw new Error(`故事发动机未通过作品专属性审查：${feedback.join('；')}`)
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
  const archive = listArchive(worldId, { limit: 200 })
  const issues = storyEngineSpecificityIssues(current, storyAnchors(archive))
  if (issues.length) throw new Error(`故事发动机不能确认：${issues.join('；')}`)
  const now = new Date().toISOString()
  getDatabase().prepare("UPDATE story_engines SET status='confirmed',confirmed_at=? WHERE id=?").run(now, current.id)
  return getStoryEngine(worldId)!
}
