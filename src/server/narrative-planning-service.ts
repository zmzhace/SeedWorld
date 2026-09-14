import 'server-only'

import { randomUUID } from 'node:crypto'
import type { WorldSlice } from '@/domain/world'
import type {
  BookFoundation, ChapterOutline, ChapterRelevance, EvolutionContract, HookType, NarrativePurpose,
  NarrativeQuestion, RequiredStateDelta, StateCondition, StoryArcPlan, VolumePlan,
} from '@/domain/narrative-workflow'
import { microStoryIssues } from '@/domain/story-closure-validation'
export { validateNarrativeEvents } from '@/domain/narrative-validation'
import { getDatabase } from './database'
import { chatJson } from './llm/openai-compat'
import { getWorld, listArchive, listScenes, listStoryThreads } from './novel-repository'
import { ensureNarrativeHorizon, getNarrativeHorizon, syncNarrativeHorizonPointers } from './narrative-control-service'
import { getStoryEngine } from './story-engine-service'
import { ensureReaderQuestions, listReaderQuestions } from './reader-story-service'

const arr = (value: unknown, fallback: string[] = []): string[] => Array.isArray(value)
  ? value.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim()
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const candidate = record.description ?? record.ending ?? record.turn ?? record.content ?? record.value ?? record.name
        return typeof candidate === 'string' ? candidate.trim() : JSON.stringify(record)
      }
      return ''
    }).filter(Boolean)
  : fallback
const text = (value: unknown, fallback: string): string => typeof value === 'string' && value.trim() ? value.trim() : fallback
const HOOKS = new Set<HookType>(['crisis', 'mystery', 'desire', 'emotion', 'choice'])
const PURPOSES = new Set<NarrativePurpose>([
  'advance_mainline', 'plant_foreshadow', 'strengthen_foreshadow', 'resolve_foreshadow',
  'answer_question', 'change_relationship', 'change_goal_or_belief', 'show_consequence', 'build_pressure',
])

function foundationWithoutLegacyEnding(foundation: BookFoundation) {
  const { endingTruth: _endingTruth, finalChoice: _finalChoice, characterEndings: _characterEndings, keyTurns: _keyTurns, ...openFoundation } = foundation
  return openFoundation
}

function parse<T>(value: unknown, fallback: T): T {
  try { return typeof value === 'string' ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function normalizeQuestions(value: unknown, fallback: string): NarrativeQuestion[] {
  const values = Array.isArray(value) ? value : []
  const questions = values.map((item, index): NarrativeQuestion | null => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const question = typeof item === 'string' ? item.trim() : text(record.question, '')
    if (!question) return null
    return { id: text(record.id, `question-${index + 1}`), question, status: 'open' as const, answerEventIds: arr(record.answerEventIds) }
  }).filter((item): item is NarrativeQuestion => item !== null)
  return questions.length ? questions : [{ id: 'question-1', question: fallback, status: 'open', answerEventIds: [] }]
}

function mapFoundation(row: Record<string, unknown>): BookFoundation {
  const value = parse<Partial<BookFoundation>>(row.foundation_json, {})
  return {
    id: String(row.id), worldId: String(row.world_id), version: Number(row.version),
    status: String(row.status) as BookFoundation['status'], corePromise: text(value.corePromise, '尚待明确的核心阅读承诺'),
    centralConflict: text(value.centralConflict, '人物必须在不可兼得的目标之间作出选择'),
    thematicQuestion: text(value.thematicQuestion, '人在代价面前如何证明自己的选择'),
    protagonistPressure: text(value.protagonistPressure, '主要人物必须在不断收紧的局部冲突中做出选择'),
    requiredLongTermQuestions: normalizeQuestions(value.requiredLongTermQuestions, text(value.thematicQuestion, '核心矛盾将如何改变人物的选择？')),
    endingTruth: value.endingTruth, finalChoice: value.finalChoice,
    characterEndings: arr(value.characterEndings), immutableRules: arr(value.immutableRules), keyTurns: arr(value.keyTurns),
    requiredForeshadows: arr(value.requiredForeshadows), forbiddenEndings: arr(value.forbiddenEndings), forbiddenDirections: arr(value.forbiddenDirections),
    forbiddenContent: arr(value.forbiddenContent), audiencePromise: text(value.audiencePromise, '清晰、紧凑、每章有有效变化'),
    createdAt: String(row.created_at), confirmedAt: row.confirmed_at ? String(row.confirmed_at) : undefined,
  }
}

export function getLatestFoundation(worldId: string): BookFoundation | null {
  const row = getDatabase().prepare('SELECT * FROM book_foundations WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as Record<string, unknown> | undefined
  return row ? mapFoundation(row) : null
}

function foundationFallback(worldId: string): Omit<BookFoundation, 'id'|'worldId'|'version'|'status'|'createdAt'> {
  const world = getWorld(worldId)
  const premise = world?.summary || world?.prompt || '人物在不断升级的世界冲突中争夺选择权'
  return {
    corePromise: `围绕“${premise.slice(0, 120)}”持续升级，每章都改变局势或理解。`,
    centralConflict: premise,
    thematicQuestion: '当核心利益不能兼得时，人会如何选择？',
    protagonistPressure: '主要人物必须在当前冲突里不断失去维持现状的选项。',
    requiredLongTermQuestions: [{ id: 'question-1', question: '核心矛盾最终会把人物逼向什么立场？', status: 'open', answerEventIds: [] }],
    characterEndings: [], immutableRules: [], keyTurns: [], requiredForeshadows: [], forbiddenEndings: [],
    forbiddenDirections: ['无铺垫的天降解法', '用梦境或幻觉否定已发生正文'],
    forbiddenContent: world?.writingSettings.forbiddenContent || [],
    audiencePromise: world?.writingSettings.audience || '逻辑清晰、节奏明确、人物选择有代价',
  }
}

export async function ensureFoundationDraft(worldId: string): Promise<BookFoundation> {
  const existing = getLatestFoundation(worldId)
  if (existing) return existing
  const world = getWorld(worldId)
  if (!world) throw new Error('世界不存在')
  const archive = listArchive(worldId, { limit: 80 })
  let raw: Record<string, unknown>
  let generationIssue = ''
  try {
    raw = await chatJson([{ role: 'user', content: `你是通用长篇小说总架构师。只依据资料建立作品根基，不预设终局，不写章节，不增加资料外的具体真相，不预设题材惯例。返回 JSON：corePromise,centralConflict,thematicQuestion,protagonistPressure,requiredLongTermQuestions[{question}],immutableRules[],forbiddenDirections[],forbiddenContent[],audiencePromise。核心矛盾必须有冲突方与不可兼得之处；长期问题不得预设唯一答案。\n作品：${world.title || ''}\n创作提示：${world.prompt.slice(0, 6000)}\n写作设置：${JSON.stringify(world.writingSettings)}\n事实摘要：${JSON.stringify(archive.claims.slice(0, 40))}` }], { maxTokens: 4096 })
  } catch (error) {
    generationIssue = '作品根基由占位规则生成，必须人工补全后再确认：' + (error instanceof Error ? error.message : String(error))
    raw = foundationFallback(worldId)
  }
  const fallback = foundationFallback(worldId)
  const value = {
    corePromise: text(raw.corePromise, fallback.corePromise), centralConflict: text(raw.centralConflict, fallback.centralConflict),
    thematicQuestion: text(raw.thematicQuestion, fallback.thematicQuestion), protagonistPressure: text(raw.protagonistPressure, fallback.protagonistPressure),
    requiredLongTermQuestions: normalizeQuestions(raw.requiredLongTermQuestions, fallback.requiredLongTermQuestions[0].question),
    characterEndings: [], immutableRules: arr(raw.immutableRules), keyTurns: [], requiredForeshadows: [], forbiddenEndings: [],
    forbiddenDirections: arr(raw.forbiddenDirections, fallback.forbiddenDirections),
    forbiddenContent: arr(raw.forbiddenContent, fallback.forbiddenContent), audiencePromise: text(raw.audiencePromise, fallback.audiencePromise),
  }
  const id = randomUUID(); const now = new Date().toISOString()
  getDatabase().prepare('INSERT INTO book_foundations (id,world_id,version,status,foundation_json,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, worldId, 1, 'draft', JSON.stringify(value), now)
  if (generationIssue) getDatabase().prepare('UPDATE book_foundations SET validation_issues=? WHERE id=?').run(JSON.stringify([generationIssue]), id)
  return getLatestFoundation(worldId)!
}

export function saveFoundation(worldId: string, patch: Partial<BookFoundation>): BookFoundation {
  const current = getLatestFoundation(worldId)
  if (!current) throw new Error('请先生成全书契约')
  const next = { ...current, ...patch, id: undefined, worldId: undefined, version: undefined, status: undefined, createdAt: undefined, confirmedAt: undefined }
  const version = current.version + 1; const id = randomUUID(); const now = new Date().toISOString()
  const db = getDatabase(); db.exec('BEGIN')
  try {
    db.prepare('INSERT INTO book_foundations (id,world_id,version,status,foundation_json,validation_issues,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, worldId, version, 'draft', JSON.stringify(next), '[]', now)
    db.prepare("UPDATE chapter_outlines SET status='stale',outline_json=json_set(outline_json,'$.status','stale') WHERE world_id=? AND status NOT IN ('completed','stale')").run(worldId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getLatestFoundation(worldId)!
}

export function confirmFoundation(worldId: string): BookFoundation {
  const current = getLatestFoundation(worldId)
  if (!current) throw new Error('请先生成全书契约')
  const unresolved = [['corePromise', current.corePromise], ['centralConflict', current.centralConflict], ['thematicQuestion', current.thematicQuestion], ['protagonistPressure', current.protagonistPressure], ['audiencePromise', current.audiencePromise]]
    .filter(([, value]) => !String(value || '').trim() || /待作者确认|待确定|随便发展|根据剧情|任选|暂定/.test(String(value))).map(([field, value]) => field + '：' + String(value || '为空'))
  if (unresolved.length) throw new Error('全书契约仍含未决内容，不能确认：' + unresolved.join('；'))
  if (!current.requiredLongTermQuestions.length) throw new Error('全书契约至少需要一个长期读者问题')
  const row = getDatabase().prepare('SELECT validation_issues FROM book_foundations WHERE id=?').get(current.id) as { validation_issues: string } | undefined
  const generationIssues = parse<string[]>(row?.validation_issues, [])
  if (generationIssues.length) throw new Error(generationIssues.join('；'))
  if (current.corePromise.length < 12 || current.centralConflict.length < 12 || !/[与和对抗争夺不能不可冲突代价]/.test(current.centralConflict)) throw new Error('作品承诺或核心矛盾仍不够具体：请明确冲突双方、争夺对象或不可兼得的问题')
  const now = new Date().toISOString()
  getDatabase().prepare("UPDATE book_foundations SET status='confirmed',confirmed_at=? WHERE id=?").run(now, current.id)
  seedObligations(worldId, current)
  return getLatestFoundation(worldId)!
}

function seedObligations(worldId: string, foundation: BookFoundation) {
  const db = getDatabase(); const now = new Date().toISOString()
  const insert = db.prepare('INSERT OR IGNORE INTO narrative_obligations (id,world_id,kind,description,status,source_foundation_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
  ;(foundation.requiredForeshadows || []).forEach((description, index) => insert.run(`obl_${worldId}_${foundation.version}_f${index}`, worldId, 'foreshadow', description, 'open', foundation.version, now, now))
  foundation.requiredLongTermQuestions.forEach((question, index) => insert.run(`obl_${worldId}_${foundation.version}_q${index}`, worldId, 'question', question.question, 'open', foundation.version, now, now))
}

export type RollingOutline = { volumes: VolumePlan[]; arcs: StoryArcPlan[]; chapters: ChapterOutline[] }

function normalizeChapterPlan(
  item: Record<string, unknown>,
  index: number,
  context: { worldId: string; arcId: string; arc: StoryArcPlan; foundation: BookFoundation; count: number },
): ChapterOutline {
  const chapterId = randomUUID()
  const isFirst = index === 0
  // Rolling planning never knows the arc length in advance.
  const isLast = false
  const purpose = PURPOSES.has(item.narrativePurpose as NarrativePurpose)
    ? item.narrativePurpose as NarrativePurpose
    : isFirst ? 'advance_mainline' : isLast ? 'show_consequence' : 'build_pressure'
  const hookType = HOOKS.has(item.hookType as HookType) ? item.hookType as HookType : 'choice'
  const requiredChange = text(item.requiredChange, '人物目标、关系、认知、风险或局势至少一项发生可证明的变化')
  // Outline planning must not invent placeholder claims. Concrete deltas are produced
  // by the evolution contract and validated against real entities/events later.
  const stateBefore: StateCondition[] = []
  const requiredDeltas: RequiredStateDelta[] = []
  const mode: ChapterRelevance['mode'] = purpose === 'show_consequence' ? 'consequence' : purpose === 'advance_mainline' ? 'advance' : 'prepare'
  const relevance: ChapterRelevance = mode === 'advance'
    ? { mode, targetArcConditionIds: context.arc.completionConditionIds || [] }
    : mode === 'consequence'
      ? { mode, sourceEventIds: [], irreversibleDeltaIds: [] }
      : {
          mode,
          futureArcConditionIds: context.arc.completionConditionIds || [],
          createdAssetIds: [],
          payoffWindow: {
            earliestChapter: Math.min(context.count, index + 2),
            latestChapter: Math.min(context.count, index + 3),
          },
        }
  return {
    id: chapterId, worldId: context.worldId, arcId: context.arcId, ordinal: index + 1,
    goal: text(item.goal, isLast ? context.arc.result : `${context.arc.goal}：完成第 ${index + 1} 个必要因果步骤`),
    conflict: text(item.conflict, index < Math.ceil(context.count / 2) ? context.arc.resistance : context.arc.escalation),
    requiredChange, stateBefore, mainlineObjective: text(item.goal, requiredChange), coreConflict: text(item.conflict, context.arc.centralConflict || context.arc.resistance), relevance, requiredDeltas, forbiddenDeltas: [], narrativePurpose: purpose, hookType,
    hookGoal: text(item.hookGoal, isLast ? context.arc.turn : '由本章已发生的后果迫使下一步行动发生'),
    causalPrerequisite: text(item.causalPrerequisite, isFirst ? `全书契约中的核心冲突首次进入人物的局部生活` : '上一章的结果改变了当前目标、风险、关系或可用信息'),
    globalRelevance: text(item.globalRelevance, `推进当前故事弧“${context.arc.goal}”，不为未确定的终局强迫人物`),
    readerPayoff: text(item.readerPayoff, `读者看到“${requiredChange}”真正落地`),
    scopeBoundary: text(item.scopeBoundary, '只处理当前故事弧允许的局部问题，不提前泄露后续关键转折或终局真相'),
    deletionLoss: text(item.deletionLoss, `删除本章将使“${requiredChange}”失去发生过程和因果依据`),
    timeWindow: text(item.timeWindow, isFirst ? '承接作品起点，不跳过尚未到达的关键转折' : '承接上章后的最近合理时间'),
    conflictMode: text(item.conflictMode, '由当前作品题材和本章目标决定'),
    newConcepts: arr(item.newConcepts).slice(0, isFirst ? 1 : 2), allowedNewConceptIds: arr(item.newConcepts).slice(0, isFirst ? 1 : 2),
    causalPrerequisiteEventIds: [], povCandidateIds: [], obligationIds: context.arc.obligationIds || [], horizonVersion: getNarrativeHorizon(context.worldId)?.version || 1,
    maxNamedCharacters: Math.max(1, Math.min(isFirst ? 3 : 4, Number(item.maxNamedCharacters) || (isFirst ? 3 : 4))),
    inheritedConsequenceEventIds: arr(item.inheritedConsequenceEventIds),
    immediateGoal: text(item.immediateGoal, text(item.goal, '')),
    centralObstacle: text(item.centralObstacle, text(item.conflict, '')),
    difficultChoice: text(item.difficultChoice, ''),
    irreversibleResult: text(item.irreversibleResult, requiredChange),
    concretePayoff: text(item.concretePayoff, text(item.readerPayoff, '')),
    changedUnderstanding: text(item.changedUnderstanding, ''),
    nextPressure: text(item.nextPressure, text(item.hookGoal, '')),
    advancedQuestionIds: arr(item.advancedQuestionIds), answeredQuestionIds: arr(item.answeredQuestionIds),
    createdQuestionIds: arr(item.createdQuestionIds), engineFunction: text(item.engineFunction, ''),
    status: 'planned',
  }
}

function rawOutlineIssues(raw: Record<string, unknown>): string[] {
  const volumes = Array.isArray(raw.volumes) ? raw.volumes as Record<string, unknown>[] : []
  const firstVolume = volumes[0]
  const arcs = firstVolume && Array.isArray(firstVolume.arcs) ? firstVolume.arcs as Record<string, unknown>[] : []
  const chapters = arcs[0] && Array.isArray(arcs[0].chapters) ? arcs[0].chapters as Record<string, unknown>[] : []
  const issues: string[] = []
  if (volumes.length < 1) issues.push('缺少当前卷方向')
  if (chapters.length < 1) issues.push('当前故事弧至少需要一个下一章候选')
  const required = ['goal','conflict','requiredChange','causalPrerequisite','globalRelevance','readerPayoff','scopeBoundary','deletionLoss','hookGoal','timeWindow','conflictMode','immediateGoal','centralObstacle','difficultChoice','irreversibleResult','concretePayoff','changedUnderstanding','nextPressure','engineFunction']
  chapters.forEach((chapter, index) => required.forEach((field) => {
    if (typeof chapter[field] !== 'string' || !String(chapter[field]).trim()) issues.push(`第${index + 1}章缺少${field}`)
  }))
  chapters.forEach((chapter, index) => {
    const concepts = Array.isArray(chapter.newConcepts) ? chapter.newConcepts as unknown[] : []
    const conceptLimit = index === 0 ? 1 : 2
    const castLimit = index === 0 ? 3 : 4
    if (concepts.length > conceptLimit) issues.push(`第${index + 1}章新概念超过${conceptLimit}个`)
    if (Number(chapter.maxNamedCharacters || castLimit) > castLimit) issues.push(`第${index + 1}章具名人物超过${castLimit}名`)
  })
  const conflictModes = chapters.map((chapter) => String(chapter.conflictMode || '').trim()).filter(Boolean)
  if (chapters.length >= 3 && new Set(conflictModes).size < 2) issues.push('连续章节不能长期重复同一冲突形态')
  for (let index = 2; index < conflictModes.length; index++) {
    if (conflictModes[index] === conflictModes[index - 1] && conflictModes[index - 1] === conflictModes[index - 2]) {
      issues.push(`第${index - 1}至${index + 1}章连续重复同一冲突形态`)
    }
  }
  for (let index = 2; index < chapters.length; index++) {
    if (chapters[index].hookType === chapters[index - 1].hookType && chapters[index - 1].hookType === chapters[index - 2].hookType) issues.push(`第${index - 1}至${index + 1}章钩子结构重复`)
  }
  return issues
}

async function reviewOutlineCandidate(foundation: BookFoundation, raw: Record<string, unknown>): Promise<string[]> {
  try {
    const review = await chatJson([{ role: 'user', content: `你是独立的长篇小说大纲主编。只审查，不续写。检查候选大纲是否同时满足：
1. 每章由前章的具体结果引发，相邻章节不能交换；
2. 每章有局部回报和可验证变化，不是只抛新谜团；
3. 一个故事弧只处理一个阶段目标，没有跳过当前弧去强行收束长期问题；
4. 核心人物没有为刺激而无依据死亡、失踪、叛变或性格突变；
5. 章节冲突方式符合作品的 audiencePromise，不得整个故事弧都在查文件、问话、赶路或重复打斗；同一主要手段不得连续两章以上；
6. 整个弧至少有三种由题材自然产生的冲突形态，且每2至3章至少有一次可见、不可轻易撤回的现实后果；
7. 行动场面必须同时产出证据、选择、关系或目标变化，不是无意义打斗；安静章也必须改变人物或因果；
8. 首章最多3名具名人物、1个陌生规则或核心概念；母本中的复合“初始事件”是素材池，必须拆分为读者可理解的因果步骤，不得整包塞入一章；
9. 时间连续：当前故事弧不得跳过必要的中间状态；时间跳跃必须有因果与后果。
最多返回8条最严重且不重复的问题，每条不超过80字；strengths最多3条，每条不超过50字。返回 JSON：{passed:boolean,issues:[string],strengths:[string]}。
全书契约：${JSON.stringify(foundationWithoutLegacyEnding(foundation))}
候选大纲：${JSON.stringify(raw)}` }], { maxTokens: 4096 })
    const issues = arr(review.issues)
    // Model verdicts can contradict their own evidence (for example,
    // `passed: true` alongside several severe structural defects). Evidence
    // wins: any concrete issue forces a rewrite regardless of the boolean.
    if (issues.length) return issues
    return review.passed === true ? [] : ['大纲主编未通过候选大纲，但没有提供具体问题证据']
  } catch (error) {
    return ['大纲独立审查失败，正式流程不得放行：' + (error as Error).message]
  }
}

export async function ensureRollingOutline(worldId: string): Promise<RollingOutline> {
  const db = getDatabase()
  const existingVolumes = db.prepare('SELECT * FROM volumes WHERE world_id=? ORDER BY ordinal').all(worldId) as Record<string, unknown>[]
  const foundation = getLatestFoundation(worldId)
  if (!foundation) throw new Error('全书契约不存在')
  if (foundation.status !== 'confirmed') throw new Error('作品根基确认前不能生成正式滚动大纲')
  const engine = getStoryEngine(worldId)
  if (!engine || engine.status !== 'confirmed' || engine.foundationVersion !== foundation.version) throw new Error('请先确认与当前作品根基匹配的故事发动机')
  ensureReaderQuestions(worldId)
  await ensureNarrativeHorizon(worldId, foundation)
  if (existingVolumes.length) {
    syncNarrativeHorizonPointers(worldId)
    const existing = readOutline(worldId)
    if (!existing.chapters.some((item) => item.status === 'planned')) {
      const activeArc = existing.arcs.find((item) => item.status === 'active')
      if (activeArc) return expandArc(worldId, activeArc.id)
    }
    return existing
  }
  let raw: Record<string, unknown> = {}
  const planningPrompt = `你是通用长篇小说总架构师，不预设题材或终局。根据作品承诺、核心矛盾、故事发动机和长期问题建立当前卷方向、当前故事弧方向，并只详细规划下一章。故事弧不预设章节数量。
章节必须是一条因果链：第N章的困境必须由第N-1章的结果、选择或信息变化引发。每章只安排一个核心事件，必须有局部回报，并明确属于直接推进当前弧、建立带兑现期限的准备资产，或承接已发生事件的必要后果。只规划必须发生的状态变化，不规定人物必须用哪种行动实现。
开篇弧从人物眼前处境扩展到小组冲突或制度的第一道裂缝，不得给出全书解法。故事弧结束应获得阶段答案和新的必要目标。不得用无依据的死亡、失踪、背叛或性格突变制造刺激。
同时兑现作品的类型和读者承诺：一个故事弧至少使用三种由当前作品自然产生的冲突形态，例如可能是现场危机、证据追查、制度阻力、关系决裂、资源竞争、道德选择，但不得强行套用不属于该题材的类型。同一主要手段不得连续使用超过两章；每2至3章至少产生一次可见、不可轻易撤回的现实后果。行动场面必须产出证据、选择、关系或目标变化，不得只有热闹；安静章可以存在，但不得让整个故事弧变成连续查文件、问话、赶路或重复会议。
返回 JSON：volumes[{title,goal,conflict,cost,endingTurn,arcs:[{title,goal,resistance,escalation,turn,result,cost,localSettlement,longTailResidue,allowedEscalationAxes[],chapters:[{goal,conflict,requiredChange,causalPrerequisite,globalRelevance,readerPayoff,scopeBoundary,deletionLoss,timeWindow,conflictMode,newConcepts[],maxNamedCharacters,narrativePurpose,hookType,hookGoal,inheritedConsequenceEventIds[],immediateGoal,centralObstacle,difficultChoice,irreversibleResult,concretePayoff,changedUnderstanding,nextPressure,advancedQuestionIds[],answeredQuestionIds[],createdQuestionIds[],engineFunction}]}]}]。narrativePurpose 只能取 advance_mainline/plant_foreshadow/strengthen_foreshadow/resolve_foreshadow/answer_question/change_relationship/change_goal_or_belief/show_consequence/build_pressure；hookType 只能取 crisis/mystery/desire/emotion/choice。
生成前自检：如果相邻两章可以交换而不影响逻辑，说明因果不合格；如果某章删掉不影响后文，合并或重写；如果连续章节只是换地点、换对手、重复同类冲突，重新设计冲突类型或选择代价。
作品根基：${JSON.stringify(foundationWithoutLegacyEnding(foundation))}\n故事发动机：${JSON.stringify(engine)}\n读者问题：${JSON.stringify(listReaderQuestions(worldId))}\n叙事地平线：${JSON.stringify(getNarrativeHorizon(worldId))}`
  try {
    let revisionPrompt = planningPrompt
    for (let attempt = 0; attempt < 3; attempt++) {
      raw = await chatJson([{ role: 'user', content: revisionPrompt }], { maxTokens: 12288 })
      const rawIssues = rawOutlineIssues(raw)
      const firstChapter = (((raw.volumes as any[])?.[0]?.arcs as any[])?.[0]?.chapters as Record<string, unknown>[])?.[0]
      const chapterIssues = firstChapter ? microStoryIssues(firstChapter, {
        isFirst: true,
        publishedEventIds: new Set(),
        readerQuestionIds: new Set(listReaderQuestions(worldId).map((item: any) => String(item.id))),
      }) : []
      const issues = [...rawIssues, ...chapterIssues, ...await reviewOutlineCandidate(foundation, raw)]
      if (!issues.length) break
      revisionPrompt = `${planningPrompt}\n第 ${attempt + 1} 版未通过结构校验：${issues.join('；')}。请针对这些证据重写完整 JSON，不要解释。\n未通过版本：${JSON.stringify(raw)}`
      if (attempt === 2) raw = {}
    }
  } catch (error) {
    throw new Error('全书大纲生成失败，已停止推演：' + (error as Error).message)
  }
  if (!Array.isArray(raw.volumes) || raw.volumes.length === 0) {
    throw new Error('全书大纲未通过结构审查，禁止使用通用兜底大纲')
  }
  const volumesRaw = Array.isArray(raw.volumes) ? raw.volumes.slice(0, 1) as Record<string, unknown>[] : []
  const allVolumesHaveDirection = volumesRaw.every((volume) => Array.isArray(volume.arcs) && (volume.arcs as unknown[]).length > 0)
  const firstArcs = Array.isArray(volumesRaw[0]?.arcs) ? volumesRaw[0].arcs as Record<string, unknown>[] : []
  const firstArcChapters = Array.isArray(firstArcs[0]?.chapters) ? firstArcs[0].chapters as unknown[] : []
  if (!allVolumesHaveDirection || firstArcChapters.length < 1) {
    throw new Error('滚动大纲必须包含当前卷、当前故事弧和下一章目标')
  }
  const normalized = volumesRaw
  const now = new Date().toISOString()
  const compassId = randomUUID()
  db.prepare('INSERT INTO story_compasses (id,world_id,version,compass_json,created_at) VALUES (?,?,?,?,?)').run(compassId, worldId, 1, JSON.stringify({ stablePromises: [foundation.corePromise, foundation.audiencePromise], centralConflict: foundation.centralConflict, immutableRules: foundation.immutableRules, openThreads: foundation.requiredLongTermQuestions, currentVolume: 1, currentArc: 1 }), now)
  normalized.forEach((volumeRaw, volumeIndex) => {
    const volumeId = randomUUID()
    const volume: VolumePlan = { id: volumeId, worldId, ordinal: volumeIndex + 1, title: text(volumeRaw.title, `第${volumeIndex + 1}卷`), goal: text(volumeRaw.goal, foundation.corePromise), centralQuestion: text(volumeRaw.centralQuestion, foundation.thematicQuestion), stageGoal: text(volumeRaw.goal, foundation.corePromise), pressureChange: text(volumeRaw.pressureChange, '核心矛盾迫使人物失去维持现状的选项'), expectedCost: text(volumeRaw.cost, '维持现状的代价上升'), entryConditionIds: [], completionConditionIds: [], forbiddenResolutionIds: foundation.requiredLongTermQuestions.map((item) => item.id), requiredArcFunctions: [], trajectoryEvaluationIds: getNarrativeHorizon(worldId)?.trajectoryIds || [], conflict: text(volumeRaw.conflict, foundation.centralConflict), cost: text(volumeRaw.cost, '维持现状的代价上升'), endingTurn: text(volumeRaw.endingTurn, '当前卷的核心压力发生不可逆转化'), status: volumeIndex === 0 ? 'active' : 'planned' }
    db.prepare('INSERT INTO volumes (id,world_id,ordinal,title,plan_json,status,created_at) VALUES (?,?,?,?,?,?,?)').run(volumeId, worldId, volume.ordinal, volume.title, JSON.stringify(volume), volume.status, now)
    const arcsRaw = Array.isArray(volumeRaw.arcs) ? (volumeRaw.arcs as Record<string, unknown>[]).slice(0, 3) : []
    arcsRaw.forEach((arcRaw, arcIndex) => {
      const arcId = randomUUID()
      const arc: StoryArcPlan = { id: arcId, worldId, volumeId, ordinal: arcIndex + 1, title: text(arcRaw.title, `故事弧 ${arcIndex + 1}`), goal: text(arcRaw.goal, volume.goal), objective: text(arcRaw.goal, volume.goal), centralConflict: text(arcRaw.centralConflict, volume.conflict), resistance: text(arcRaw.resistance, volume.conflict), escalation: text(arcRaw.escalation, '阻力与代价逐章升级'), turn: text(arcRaw.turn, volume.endingTurn), result: text(arcRaw.result, '局势发生不可逆变化'), cost: text(arcRaw.cost, volume.cost), startConditionIds: [], completionConditionIds: [`arc-${arcId}-complete`], failureConditionIds: [], forbiddenConditionIds: [], requiredConflictModes: arr(arcRaw.requiredConflictModes), obligationIds: [], localSettlement: text(arcRaw.localSettlement, '当前阶段问题得到具体但不彻底的回答'), longTailResidue: text(arcRaw.longTailResidue, '本弧代价形成下一弧必须处理的压力'), requiredQuestionIds: listReaderQuestions(worldId).filter((item:any) => item.importance === 'core' || item.importance === 'arc').map((item:any) => item.id), allowedEscalationAxes: arr(arcRaw.allowedEscalationAxes).filter((axis) => engine.escalationAxes.includes(axis)), usedConflictPatterns: [], engineVersion: engine.version, status: volumeIndex === 0 && arcIndex === 0 ? 'active' : 'planned' }
      db.prepare('INSERT INTO story_arcs (id,world_id,volume_id,ordinal,title,plan_json,status,created_at) VALUES (?,?,?,?,?,?,?,?)').run(arcId, worldId, volumeId, arc.ordinal, arc.title, JSON.stringify(arc), arc.status, now)
      if (volumeIndex || arcIndex) return
      const chaptersRaw = Array.isArray(arcRaw.chapters) ? (arcRaw.chapters as Record<string, unknown>[]).slice(0, 1) : []
      chaptersRaw.forEach((chapterRaw, chapterIndex) => {
        const chapter = normalizeChapterPlan(chapterRaw, chapterIndex, { worldId, arcId, arc, foundation, count: chaptersRaw.length })
        db.prepare('INSERT INTO chapter_outlines (id,world_id,arc_id,ordinal,outline_json,status,created_at) VALUES (?,?,?,?,?,?,?)').run(chapter.id, worldId, arcId, chapter.ordinal, JSON.stringify(chapter), chapter.status, now)
      })
    })
  })
  syncNarrativeHorizonPointers(worldId)
  return readOutline(worldId)
}

export function readOutline(worldId: string): RollingOutline {
  const db = getDatabase()
  const volumes = (db.prepare('SELECT plan_json FROM volumes WHERE world_id=? ORDER BY ordinal').all(worldId) as Array<{ plan_json: string }>).map((row) => parse<VolumePlan>(row.plan_json, null as never)).filter(Boolean)
  const arcs = (db.prepare('SELECT plan_json FROM story_arcs WHERE world_id=? ORDER BY created_at').all(worldId) as Array<{ plan_json: string }>).map((row) => parse<StoryArcPlan>(row.plan_json, null as never)).filter(Boolean)
  const chapters = (db.prepare('SELECT outline_json FROM chapter_outlines WHERE world_id=? ORDER BY created_at').all(worldId) as Array<{ outline_json: string }>).map((row) => parse<ChapterOutline>(row.outline_json, null as never)).filter(Boolean)
  return { volumes, arcs, chapters }
}

export async function expandArc(worldId: string, arcId: string): Promise<RollingOutline> {
  const db = getDatabase()
  const row = db.prepare('SELECT a.plan_json,v.plan_json AS volume_json FROM story_arcs a JOIN volumes v ON v.id=a.volume_id WHERE a.world_id=? AND a.id=?').get(worldId, arcId) as { plan_json: string; volume_json: string } | undefined
  if (!row) throw new Error('故事弧不存在')
  const existingPlanned = db.prepare("SELECT COUNT(*) AS value FROM chapter_outlines WHERE arc_id=? AND status IN ('planned','active')").get(arcId) as { value: number }
  if (existingPlanned.value) return readOutline(worldId)
  db.prepare("DELETE FROM chapter_outlines WHERE arc_id=? AND status='stale'").run(arcId)
  const completedCount = Number((db.prepare("SELECT COUNT(*) AS value FROM chapter_outlines WHERE arc_id=? AND status='completed'").get(arcId) as { value: number }).value)
  const foundation = getLatestFoundation(worldId); const arc = parse<StoryArcPlan>(row.plan_json, null as never); const volume = parse<VolumePlan>(row.volume_json, null as never)
  const engine = getStoryEngine(worldId)
  if (!engine || engine.status !== 'confirmed') throw new Error('故事发动机未确认，不能展开故事弧')
  ensureReaderQuestions(worldId)
  const recentEvents = db.prepare('SELECT id,tick,summary,narrative_purpose FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL ORDER BY tick DESC,created_at DESC LIMIT 8').all(worldId)
  let raw: Record<string, unknown> = {}
  try {
    raw = await chatJson([{ role: 'user', content: `你是通用长篇小说架构师。当前弧已有 ${completedCount} 章正式发布；根据当前卷方向、故事发动机、已发布后果和当前故事弧目标，只生成下一章一个可执行章节，不预设本弧长度。下一章必须由上一章的具体结果、选择或信息变化引发。必须写明前置因果、对当前弧的职责、局部回报、长线残留、信息边界、删除损失、时间范围和冲突形态。只确定必须完成的变化，具体行动路径留给角色推演。
首章最多3名具名人物、只演示1个陌生规则或核心概念；后续单章最多4名具名人物、最多2个新概念。当前弧不得跳过自身完成条件或提前解决长期问题。
返回 JSON：chapters[{goal,conflict,requiredChange,causalPrerequisite,globalRelevance,readerPayoff,scopeBoundary,deletionLoss,timeWindow,conflictMode,newConcepts[],maxNamedCharacters,narrativePurpose,hookType,hookGoal,inheritedConsequenceEventIds[],immediateGoal,centralObstacle,difficultChoice,irreversibleResult,concretePayoff,changedUnderstanding,nextPressure,advancedQuestionIds[],answeredQuestionIds[],createdQuestionIds[],engineFunction}]。后续章 inheritedConsequenceEventIds 必须引用给出的已发布事件 ID；具体回报不能写成“谜团加深”或“局势升级”。\n全书契约：${JSON.stringify(foundationWithoutLegacyEnding(foundation!))}\n故事发动机：${JSON.stringify(engine)}\n读者问题：${JSON.stringify(listReaderQuestions(worldId))}\n最近已发布事件：${JSON.stringify(recentEvents)}\n当前卷：${JSON.stringify(volume)}\n当前弧：${JSON.stringify(arc)}` }], { maxTokens: 8192 })
  } catch (error) { throw new Error('故事弧展开失败，已停止正式推演：' + (error as Error).message) }
  const rawChapters = Array.isArray(raw.chapters) ? (raw.chapters as Record<string, unknown>[]).slice(0, 1) : []
  if (rawChapters.length !== 1) throw new Error('滚动规划必须只生成一个下一章')
  const nextIssues = [
    ...rawOutlineIssues({ volumes: [{ arcs: [{ chapters: rawChapters }] }] }),
    ...microStoryIssues(rawChapters[0], {
      isFirst: completedCount === 0,
      publishedEventIds: new Set(recentEvents.map((event: any) => String(event.id))),
      readerQuestionIds: new Set(listReaderQuestions(worldId).map((item: any) => String(item.id))),
    }),
  ]
  if (nextIssues.length) throw new Error(`下一章合同未通过确定性校验：${nextIssues.join('；')}`)
  const chapters = rawChapters
  const totalCount = completedCount + chapters.length
  const now = new Date().toISOString()
  chapters.forEach((item, index) => {
    const chapter = normalizeChapterPlan(item, completedCount + index, { worldId, arcId, arc, foundation: foundation!, count: totalCount })
    db.prepare('INSERT INTO chapter_outlines (id,world_id,arc_id,ordinal,outline_json,status,created_at) VALUES (?,?,?,?,?,?,?)').run(chapter.id, worldId, arcId, chapter.ordinal, JSON.stringify(chapter), chapter.status, now)
  })
  db.prepare("UPDATE story_arcs SET status='active' WHERE id=?").run(arcId)
  return readOutline(worldId)
}

export async function regenerateUnpublishedOutline(worldId: string): Promise<RollingOutline> {
  const db = getDatabase()
  const foundation = getLatestFoundation(worldId)
  if (!foundation || foundation.status !== 'confirmed') throw new Error('请先确认作品根基')
  const running = db.prepare("SELECT 1 FROM simulation_ticks WHERE world_id=? AND status IN ('planning','simulating','awaiting_chapter','reviewing') LIMIT 1").get(worldId)
  if (running) throw new Error('当前仍有运行中的章节，不能同时重建大纲')
  db.prepare("UPDATE chapter_outlines SET status='stale',outline_json=json_set(outline_json,'$.status','stale') WHERE world_id=? AND status NOT IN ('completed','stale')").run(worldId)
  const arc = db.prepare("SELECT id FROM story_arcs WHERE world_id=? AND status='active' ORDER BY created_at LIMIT 1").get(worldId) as { id: string } | undefined
  if (!arc) throw new Error('当前没有可展开的故事弧')
  return expandArc(worldId, arc.id)
}

export async function ensurePlanning(worldId: string) {
  const foundation = await ensureFoundationDraft(worldId)
  const outline = await ensureRollingOutline(worldId)
  return { foundation, outline }
}

export function getLatestEvolutionContract(worldId: string): EvolutionContract | null {
  const row = getDatabase().prepare('SELECT contract_json FROM evolution_contracts WHERE world_id=? ORDER BY tick DESC,created_at DESC LIMIT 1').get(worldId) as { contract_json: string } | undefined
  return row ? parse<EvolutionContract>(row.contract_json, null as never) : null
}

export async function createEvolutionContract(worldId: string, world: WorldSlice, forceNew = false): Promise<EvolutionContract> {
  const tick = world.tick + 1; const db = getDatabase()
  if (!forceNew) {
    const row = db.prepare("SELECT contract_json FROM evolution_contracts WHERE world_id=? AND tick=? AND status IN ('active','fulfilled') ORDER BY created_at DESC LIMIT 1").get(worldId, tick) as { contract_json: string } | undefined
    if (row) {
      const existing = parse<EvolutionContract>(row.contract_json, null as never)
      if (existing?.participants?.length >= 1 && existing.participants.length <= 4) return existing
      // Old contracts could include up to seven agents. They are not reused,
      // because that would reintroduce cast roll-call chapters after the upgrade.
      db.prepare("UPDATE evolution_contracts SET status='blocked' WHERE world_id=? AND tick=? AND status='active'").run(worldId, tick)
    }
  }
  const foundation = getLatestFoundation(worldId)
  if (!foundation || foundation.status !== 'confirmed') throw new Error('请先确认全书契约，再开始正式推演')
  const engine = getStoryEngine(worldId)
  if (!engine || engine.status !== 'confirmed' || engine.foundationVersion !== foundation.version) throw new Error('请先确认与当前作品根基匹配的故事发动机')
  const horizon = await ensureNarrativeHorizon(worldId, foundation)
  let outline = await ensureRollingOutline(worldId)
  let nextChapter = outline.chapters.find((item) => item.status === 'planned')
  if (!nextChapter) {
    const nextArc = outline.arcs.find((item) => item.status === 'active') || outline.arcs.find((item) => item.status === 'planned')
    if (!nextArc) throw new Error('当前滚动大纲已经完成，请先规划下一卷')
    outline = await expandArc(worldId, nextArc.id)
    nextChapter = outline.chapters.find((item) => item.status === 'planned')
  }
  if (!nextChapter) throw new Error('当前故事弧没有可执行的章节目标')
  const arc = outline.arcs.find((item) => item.id === nextChapter.arcId)
  const volume = outline.volumes.find((item) => item.id === arc?.volumeId)
  const arcChapters = outline.chapters.filter((item) => item.arcId === nextChapter!.arcId).sort((a, b) => a.ordinal - b.ordinal)
  const chapterIndex = arcChapters.findIndex((item) => item.id === nextChapter!.id)
  const previousOutline = chapterIndex > 0 ? arcChapters[chapterIndex - 1] : undefined
  const followingOutline = chapterIndex >= 0 ? arcChapters[chapterIndex + 1] : undefined
  const scene = listScenes(worldId, { status: 'active', limit: 1 })[0]
  const actors = world.agents.npcs.filter((actor) => actor.life_status !== 'dead')
  if (actors.length < 1) throw new Error('主场景至少需要一名仍可行动的人物')
  const chapterCount = Number((db.prepare('SELECT COUNT(*) AS value FROM chapters WHERE world_id=?').get(worldId) as { value: number }).value)
  const chapterNumber = chapterCount + 1
  const recentEvents = db.prepare('SELECT id,tick,summary,narrative_purpose FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL ORDER BY tick DESC,created_at DESC LIMIT 12').all(worldId) as Record<string, unknown>[]
  const threads = listStoryThreads(worldId, { limit: 8 })
  const archive = listArchive(worldId, { limit: 120 })
  let raw: Record<string, unknown> = {}
  try {
    raw = await chatJson([{ role: 'user', content: `你是章节架构师。为第 ${chapterNumber} 章创建严格演化契约。已批准的下一章大纲是本轮必须完成的当前故事弧目标：角色可以根据性格和认知决定如何实现，但不能换成另一件事。核心事件必须由前置因果引发，落地规定的状态变化和读者回报。不得根据远期候选方向强迫人物，不得提前解决长期问题。
这不是让全体智能体轮流露面，而是为一个核心冲突挑选最小必要阵容。本章具名人物硬上限为 ${Math.max(1, Math.min(chapterNumber === 1 ? 3 : 4, Number(nextChapter.maxNamedCharacters) || (chapterNumber === 1 ? 3 : 4)))} 名；每增加一人，必须说明他如何独立改变选择、阻力或结果；删掉他不影响本章则不得入选。所有在场人物必须互相作用，不得并列行动或各自独白。只能使用给定 ID；不得用观察、沉思或闲聊代替事件。需要提及但不在场的人物放入 referenceEntities，最多 1 名。只准演示大纲授权的新概念：${JSON.stringify(nextChapter.newConcepts || [])}，不得临时扩充设定。时间必须落在大纲的 ${nextChapter.timeWindow || '承接上章后的最近合理时间'}，主要冲突形态为 ${nextChapter.conflictMode || '由当前章节目标决定'}。若是第一章，读者默认对世界一无所知；先让读者理解谁想做什么、什么正在阻止他。
返回 JSON：coreEvent,povEntityId,participantIds[],participantReasons[{actorId,reason,goal,risk,sceneFunction,necessity}],scene{timeLabel,locationEntityId,entryCause,exitCondition},referenceEntities[{entityId,purpose}],knownAtOpening[],allowedNewConcepts[],withheldInformation[],requiredDelta{operation,subjectId,after{predicate,value,objectId,claimId,holderType,status,pressure,lifecycle},reversible},foreshadowActions[],allowedAnswers[],forbiddenMoves[],emotionTarget,climaxForm,hookType,hookGoal,requiredBeats[],continuityChecks[],evaluationFocus[],causalAnchorEventIds[]。scene.locationEntityId 只能用已有地点实体 ID；若角色原本不在一处，entryCause 必须说明他们如何因已有事件同场。requiredDelta 必须绑定下方真实 ID，只允许 assert_claim/grant_knowledge/change_relationship/change_location_state/change_actor_state/advance_story_thread/advance_obligation；它必须真实表达 requiredChange，章节序号变化不算剧情变化。hookType 限 crisis/mystery/desire/emotion/choice。\n全书契约：${JSON.stringify(foundationWithoutLegacyEnding(foundation))}\n故事发动机：${JSON.stringify(engine)}\n本章微型故事合同：${JSON.stringify({ immediateGoal: nextChapter.immediateGoal, centralObstacle: nextChapter.centralObstacle, difficultChoice: nextChapter.difficultChoice, irreversibleResult: nextChapter.irreversibleResult, concretePayoff: nextChapter.concretePayoff, changedUnderstanding: nextChapter.changedUnderstanding, nextPressure: nextChapter.nextPressure, engineFunction: nextChapter.engineFunction })}\n当前卷：${JSON.stringify(volume)}\n当前弧：${JSON.stringify(arc)}\n前一章大纲：${JSON.stringify(previousOutline)}\n已批准的下一章大纲：${JSON.stringify(nextChapter)}\n再下一章大纲：${JSON.stringify(followingOutline)}\n当前场景：${JSON.stringify(scene)}\n人物：${JSON.stringify(actors.map((actor) => ({ id: actor.genetics.seed, name: actor.identity.name, goals: actor.goals, location: actor.location, belief: actor.core_belief, relations: actor.relations })))}\n可用实体与命题：${JSON.stringify({ entities: archive.entities.map((item:any)=>({ id:item.id,name:item.name,type:item.type })), claims: archive.claims.slice(0,50).map((item:any)=>({ id:item.id,subjectId:item.subject_id,predicate:item.predicate,objectId:item.object_id })) })}\n最近事件：${JSON.stringify(recentEvents)}\n活跃故事线：${JSON.stringify(threads)}` }], { maxTokens: 6144 })
  } catch (error) { throw new Error('章节演化契约生成失败，已停止正式推演：' + (error as Error).message) }
  const allowedIds = new Set(actors.map((actor) => actor.genetics.seed))
  const rawIds = arr(raw.participantIds).filter((id) => allowedIds.has(id))
  const defaultCastLimit = chapterNumber === 1 ? 3 : 4
  const castLimit = Math.max(1, Math.min(defaultCastLimit, Number(nextChapter.maxNamedCharacters) || defaultCastLimit))
  if (rawIds.length < 1 || rawIds.length > castLimit) throw new Error(`章节架构师必须选择1至${castLimit}名具有明确因果职责的在场人物`)
  const selectedIds = [...new Set(rawIds)].slice(0, castLimit)
  const selectedLocations = [...new Set(selectedIds.map((id) => actors.find((actor) => actor.genetics.seed === id)?.location).filter(Boolean))]
  const sceneRaw = raw.scene && typeof raw.scene === 'object' ? raw.scene as Record<string, unknown> : {}
  const rawEntryCause = text(sceneRaw.entryCause, '')
  if (selectedLocations.length > 1 && rawEntryCause.length < 12) throw new Error('参与人物原本不在同一地点，但章节架构师没有提供可验证的同场因由')
  const reasonsRaw = Array.isArray(raw.participantReasons) ? raw.participantReasons as Record<string, unknown>[] : []
  const participants = selectedIds.map((actorId) => {
    const actor = actors.find((item) => item.genetics.seed === actorId)!
    const reason = reasonsRaw.find((item) => String(item.actorId) === actorId)
    return {
      actorId,
      reason: text(reason?.reason, `${actor.identity.name}的当前目标与本章冲突直接相连`),
      goal: text(reason?.goal, actor.goals[0] || '在冲突中保护自身核心利益'),
      risk: text(reason?.risk, '失败会失去资源、关系、信任或行动机会'),
      sceneFunction: text(reason?.sceneFunction, '对核心选择施加不可替代的影响'),
      necessity: text(reason?.necessity, `删去${actor.identity.name}会使本章选择或结果无法成立`),
    }
  })
  const referencesRaw = Array.isArray(raw.referenceEntities) ? raw.referenceEntities as Record<string, unknown>[] : []
  const referenceEntities = referencesRaw
    .filter((item) => allowedIds.has(String(item.entityId)) && !selectedIds.includes(String(item.entityId)))
    .slice(0, 1)
    .map((item) => ({ entityId: String(item.entityId), purpose: text(item.purpose, '为当前选择提供不可缺少的因果信息') }))
  const hookType = HOOKS.has(raw.hookType as HookType) ? raw.hookType as HookType : nextChapter.hookType
  const anchors = arr(raw.causalAnchorEventIds).filter((id) => recentEvents.some((event) => String(event.id) === id))
  const causalAnchors = anchors.length ? anchors : recentEvents.slice(0, 2).map((event) => String(event.id))
  const rawDelta = raw.requiredDelta && typeof raw.requiredDelta === 'object' ? raw.requiredDelta as Record<string, unknown> : null
  const allowedOperations = new Set<RequiredStateDelta['operation']>(['assert_claim','grant_knowledge','change_relationship','change_location_state','change_actor_state','advance_story_thread','advance_obligation'])
  const operation = text(rawDelta?.operation, '') as RequiredStateDelta['operation']
  const subjectId = text(rawDelta?.subjectId, '')
  const allowedSubjectIds = new Set([...actors.map((actor) => actor.genetics.seed), ...archive.entities.map((item:any) => String(item.id)), ...threads.map((item) => item.id), ...(nextChapter.obligationIds || []), arc?.id || ''].filter(Boolean))
  const after = rawDelta?.after && typeof rawDelta.after === 'object' ? rawDelta.after as Record<string, unknown> : {}
  if (!allowedOperations.has(operation) || !allowedSubjectIds.has(subjectId) || !Object.keys(after).length) throw new Error('章节架构师没有给出绑定真实实体的可提交状态变化')
  if (text(after.objectId, '') && !allowedSubjectIds.has(String(after.objectId))) throw new Error('状态变化引用了不存在的对象')
  if (operation === 'grant_knowledge' && (!actors.some((actor) => actor.genetics.seed === subjectId) || !archive.claims.some((item:any) => String(item.id) === String(after.claimId || '')))) throw new Error('认知变化必须绑定真实角色和已有命题')
  if (operation === 'assert_claim' && (!text(after.predicate, '') || (!('value' in after) && !text(after.objectId, '')))) throw new Error('新增命题缺少谓词和值')
  if (operation === 'change_relationship' && (!text(after.objectId, '') || !allowedSubjectIds.has(String(after.objectId)))) throw new Error('关系变化引用了不存在的目标')
  if (operation === 'change_actor_state' && !['mentioned','candidate','active','background','dormant','retired','dead'].includes(text(after.lifecycle, ''))) throw new Error('人物生命周期变化无效')
  if (operation === 'advance_story_thread' && !threads.some((item) => item.id === subjectId)) throw new Error('故事线变化引用了不存在的故事线')
  if (operation === 'advance_story_thread' && !['dormant','active','escalating','split','merged','resolved','failed','frozen'].includes(text(after.status, ''))) throw new Error('故事线变化缺少合法状态')
  if (operation === 'advance_obligation' && !(nextChapter.obligationIds || []).includes(subjectId)) throw new Error('叙事义务变化引用了未授权义务')
  if (operation === 'advance_obligation' && !['open','planted','resolved'].includes(text(after.status, ''))) throw new Error('叙事义务变化缺少合法状态')
  const requiredDeltas: RequiredStateDelta[] = [{
    id: nextChapter.requiredDeltas?.[0]?.id || `delta-${nextChapter.id}-main`, operation, subjectId,
    before: nextChapter.stateBefore || [], after, sourceEventIds: causalAnchors, evidenceBeatIds: [],
    narrativeReason: nextChapter.requiredChange, reversible: Boolean(rawDelta?.reversible ?? false),
  }]
  const relevance = nextChapter.relevance?.mode === 'consequence'
    ? { ...nextChapter.relevance, sourceEventIds: nextChapter.relevance.sourceEventIds.length ? nextChapter.relevance.sourceEventIds : causalAnchors }
    : nextChapter.relevance
  const contract: EvolutionContract = {
    id: randomUUID(), worldId, tick, volumeId: volume?.id, arcId: arc?.id, chapterOutlineId: nextChapter.id,
    mainlineObjective: nextChapter.goal,
    causalPrerequisite: nextChapter.causalPrerequisite || previousOutline?.requiredChange || '承接已发生事件的直接后果',
    globalRelevance: nextChapter.globalRelevance || `推进当前故事弧“${arc?.goal || nextChapter.goal}”，不为未确定的终局强迫人物`,
    readerPayoff: nextChapter.readerPayoff || `让读者看到“${nextChapter.requiredChange}”落地`,
    scopeBoundary: nextChapter.scopeBoundary || '不越过当前故事弧，不提前泄露后续转折或终局真相',
    status: 'active', coreEvent: text(raw.coreEvent, `${nextChapter.goal}；冲突为：${nextChapter.conflict}`),
    povEntityId: allowedIds.has(String(raw.povEntityId)) ? String(raw.povEntityId) : selectedIds[0],
    participants, referenceEntities,
    readerEntry: {
      chapterNumber,
      knownAtOpening: arr(raw.knownAtOpening, chapterNumber === 1 ? ['读者只知道 POV 当下的目标、场所与眼前阻力'] : ['已发布章节建立的信息']),
      allowedNewConcepts: (nextChapter.newConcepts?.length
        ? nextChapter.newConcepts
        : arr(raw.allowedNewConcepts)
      ).slice(0, chapterNumber === 1 ? 1 : 2),
      withheldInformation: arr(raw.withheldInformation, ['与当前选择无关的世界真相、阵营背景和其他人物经历']),
    },
    stateBefore: nextChapter.stateBefore || [], requiredDeltas, forbiddenDeltas: nextChapter.forbiddenDeltas || [], relevance, horizonVersion: horizon.version,
    requiredStateChanges: requiredDeltas.length ? requiredDeltas.map((item) => item.narrativeReason) : [nextChapter.requiredChange],
    foreshadowActions: arr(raw.foreshadowActions), allowedAnswers: arr(raw.allowedAnswers),
    forbiddenMoves: [...new Set([...arr(raw.forbiddenMoves), ...foundation.forbiddenDirections, '不得让人物利用尚未获得的信息', '不得凭空加入陌生危机解决或打断当前冲突', '不得用无关事件替换已批准的下一章主线目标', '不得根据远期候选方向强迫人物选择', nextChapter.scopeBoundary || '不得越过当前故事弧的信息边界'])],
    emotionTarget: text(raw.emotionTarget, '压力通过选择累积，并在后果落地时达到峰值'), climaxForm: text(raw.climaxForm, '不可轻易撤回的选择'),
    hookType, hookGoal: text(raw.hookGoal, nextChapter.hookGoal), requiredBeats: arr(raw.requiredBeats, [nextChapter.goal, nextChapter.requiredChange]),
    continuityChecks: arr(raw.continuityChecks, ['承接上一章结尾或已有事件', '每项重大行为都有触发、动机、行动和后果']),
    evaluationFocus: [...new Set([...arr(raw.evaluationFocus), `是否完成已批准的主线目标：${nextChapter.goal}`, `是否真正落地必须变化：${nextChapter.requiredChange}`, `是否给出读者回报：${nextChapter.readerPayoff || nextChapter.requiredChange}`, '删除本章是否会损害因果、人物选择、信息理解、情绪积累或伏笔兑现'])],
    causalAnchorEventIds: causalAnchors,
    narrativePurpose: nextChapter.narrativePurpose, createdAt: new Date().toISOString(),
  }
  const locationEntityId = text(sceneRaw.locationEntityId, '')
  if (locationEntityId && !archive.entities.some((item:any) => String(item.id) === locationEntityId)) throw new Error('主场景引用了不存在的地点实体')
  const sceneId = randomUUID()
  contract.sceneId = sceneId
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO scenes (id,world_id,tick,status,time_label,location_entity_id,objective,conflict,entry_cause,exit_condition,anchor_event_ids_json,created_at,updated_at)
      VALUES (?,?,?,'proposed',?,?,?,?,?,?,?,?,?)`).run(sceneId, worldId, tick, text(sceneRaw.timeLabel, scene?.timeLabel || world.time || '承接上一已发布事件'), locationEntityId || scene?.locationEntityId || null, contract.mainlineObjective || nextChapter.goal, nextChapter.coreConflict || nextChapter.conflict, rawEntryCause || contract.causalPrerequisite || nextChapter.causalPrerequisite || '由当前故事弧的未完成条件引发', text(sceneRaw.exitCondition, nextChapter.requiredChange), JSON.stringify(causalAnchors), contract.createdAt, contract.createdAt)
    db.prepare('INSERT INTO evolution_contracts (id,world_id,tick,volume_id,arc_id,chapter_outline_id,scene_id,status,contract_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(contract.id, worldId, tick, contract.volumeId || null, contract.arcId || null, contract.chapterOutlineId || null, sceneId, contract.status, JSON.stringify(contract), contract.createdAt)
    for (const participant of participants) {
      db.prepare(`INSERT INTO scene_participants (scene_id,actor_id,role,reason,joined_tick,left_tick) VALUES (?,?,?,?,?,NULL)
        ON CONFLICT(scene_id,actor_id) DO UPDATE SET role=excluded.role,reason=excluded.reason,left_tick=NULL`).run(sceneId, participant.actorId, participant.sceneFunction, participant.reason, tick)
    }
    if (contract.chapterOutlineId) db.prepare("UPDATE chapter_outlines SET status='active',outline_json=json_set(outline_json,'$.status','active') WHERE id=?").run(contract.chapterOutlineId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return contract
}

export function scopeWorldForContract(world: WorldSlice, contract: EvolutionContract): WorldSlice {
  const selected = new Set(contract.participants.map((item) => item.actorId))
  return {
    ...world,
    social_context: {
      ...world.social_context,
      pressures: [
        ...world.social_context.pressures,
        `已批准主线目标：${contract.mainlineObjective || contract.coreEvent}`,
        `本章前置因果：${contract.causalPrerequisite || '承接已发生事件的直接后果'}`,
        `本章核心事件：${contract.coreEvent}`,
        `本章必须变化：${contract.requiredStateChanges.join('；')}`,
        `本章信息边界：${contract.scopeBoundary || '不得提前泄露后续关键转折'}`,
      ],
    },
    active_hooks: [contract.hookGoal],
    agents: { ...world.agents, npcs: world.agents.npcs.filter((actor) => selected.has(actor.genetics.seed)) },
  }
}

export function mergeScopedWorld(previous: WorldSlice, scoped: WorldSlice): WorldSlice {
  const changed = new Map(scoped.agents.npcs.map((actor) => [actor.genetics.seed, actor]))
  return { ...scoped, agents: { ...scoped.agents, npcs: previous.agents.npcs.map((actor) => changed.get(actor.genetics.seed) || actor) } }
}
