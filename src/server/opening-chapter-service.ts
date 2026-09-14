import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { WorldSlice } from '@/domain/world'
import type { EvolutionContract, SceneBeat, RequiredStateDelta } from '@/domain/narrative-workflow'
import { chatJson } from './llm/openai-compat'
import { getDatabase } from './database'
import { getLatestFoundation } from './narrative-planning-service'
import { getStoryEngine } from './story-engine-service'
import { ensurePrimaryScene } from './dynamic-workflow'
import { listArchive } from './novel-repository'

const text = (value: unknown, fallback = '') => String(value ?? '').trim() || fallback
const strings = (value: unknown) => Array.isArray(value) ? value.map(String).map((v) => v.trim()).filter(Boolean) : []
const stable = (value: string) => `opening_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`

/**
 * Build the first chapter's contract. The opening is deliberately not a normal
 * arc chapter: it establishes one readable promise and one irreversible fact
 * before the rolling outline starts.
 */
export async function createOpeningContract(worldId: string, world: WorldSlice): Promise<EvolutionContract> {
  const db = getDatabase()
  const existing = db.prepare("SELECT id,contract_json,status FROM evolution_contracts WHERE world_id=? AND tick=1 ORDER BY created_at DESC LIMIT 1").get(worldId) as { id?: string; contract_json?: string; status?: string } | undefined
  if (existing?.contract_json && existing.status !== 'blocked') return JSON.parse(existing.contract_json) as EvolutionContract
  if (existing?.contract_json && existing.id) {
    db.prepare("UPDATE evolution_contracts SET status='active' WHERE id=?").run(existing.id)
    return JSON.parse(existing.contract_json) as EvolutionContract
  }
  const foundation = getLatestFoundation(worldId)
  const engine = getStoryEngine(worldId)
  if (!foundation || foundation.status !== 'confirmed') throw new Error('请先确认作品根基')
  if (!engine || engine.status !== 'confirmed') throw new Error('请先确认故事发动机')
  const scene = ensurePrimaryScene(worldId, world)
  const actor = world.agents.npcs.find((item) => item.life_status !== 'dead')
  if (!actor) throw new Error('首章至少需要一名仍可行动的人物')
  const archive = listArchive(worldId, { limit: 40 })
  const result = await chatJson([{ role: 'user', content: `你是成熟长篇小说的首章架构师。只设计第一章的可写结构，不写正文。参考多数高完成度类型小说的共同开篇规律：从具体场景中的异常、行动或正在逼近的期限切入；尽快让读者看见一个有欲望的人；让阻碍在现场发生；通过一次被迫选择造成不可逆后果；只留下一个由本章结果产生的继续阅读问题。首章不是世界观说明、人物简历或阵营展示。
必须同时满足：第一段出现可感知的异常、危险、任务或冲突，不得从起床、照镜子、天气、梦境、泛泛历史开始；POV人物有今天就必须处理的具体目标，失败会损失明确东西；阻碍正在发生而非抽象命运；选择至少有两个都要付代价的选项；结果改变下一步行动空间；最多一个陌生核心概念；人物通过行动和反应出现，不轮流自我介绍。
只允许一个POV、最多两个辅助人物、一个陌生概念。返回严格JSON：title,openingPattern,whyThisOpening,openingSituation,immediateGoal,obstacle,forcedChoice,localPayoff,longTermQuestion,hookType,hookGoal,beats[{trigger,action,reaction,changedOption,consequence}].openingPattern只能取incident/deadline/contradiction/investigation/promise；beats至少3拍，最后一拍必须产生不可逆结果。
作品根基：${JSON.stringify({ corePromise: foundation.corePromise, centralConflict: foundation.centralConflict, thematicQuestion: foundation.thematicQuestion, rules: foundation.immutableRules })}
故事发动机：${JSON.stringify({ experience: engine.signatureExperience, repeatableSituation: engine.repeatableSituation, protagonistMethod: engine.protagonistMethod, failureCosts: engine.failureCosts, emotionalPromise: engine.emotionalPromise })}
POV人物：${JSON.stringify({ id: actor.genetics.seed, name: actor.identity.name, goals: actor.goals, location: actor.location, belief: actor.core_belief })}
当前场景：${JSON.stringify(scene)}
已有资料中的实体（只能引用，不得新增世界真相）：${JSON.stringify(archive.entities.slice(0, 20).map((item: any) => ({ id: item.id, name: item.name, type: item.type })))}
` }], { maxTokens: 4096, maxAttempts: 2 })
  const hookType = new Set(['crisis', 'mystery', 'desire', 'emotion', 'choice']).has(String(result.hookType)) ? String(result.hookType) as EvolutionContract['hookType'] : 'crisis'
  const rawBeats = Array.isArray(result.beats) ? result.beats.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
  if (rawBeats.length < 3) throw new Error('首章架构不足三拍，未创建通用兜底剧情')
  const claimId = stable(`${worldId}:opening:pressure`)
  const delta: RequiredStateDelta = {
    id: stable(`${worldId}:opening:delta`), operation: 'assert_claim', subjectId: actor.genetics.seed,
    before: [], after: { claimId, predicate: 'opening_choice', value: text(result.forcedChoice, '主角被迫做出第一次选择'), claimScope: 'objective' },
    sourceEventIds: [], evidenceBeatIds: [], narrativeReason: text(result.localPayoff, '首章选择改变了主角下一步的行动空间'), reversible: false,
  }
  const beats: SceneBeat[] = rawBeats.slice(0, 6).map((item, index) => ({
    id: stable(`${worldId}:opening:beat:${index}`), worldId, tick: 1, ordinal: index + 1, actorId: actor.genetics.seed,
    dependsOnBeatIds: index ? [stable(`${worldId}:opening:beat:${index - 1}`)] : [], trigger: text(item.trigger, text(result.openingSituation, '异常打破日常')),
    action: text(item.action, text(result.immediateGoal, '确认异常并采取行动')), targetActorIds: [], reaction: text(item.reaction, '环境反馈让原计划变得不可行'), changedOption: text(item.changedOption, '原本安全的选择被关闭'), consequence: text(item.consequence, text(result.localPayoff, '主角获得局部结果')),
    consumesConditions: [], producesDeltaIds: index === rawBeats.length - 1 ? [delta.id] : [], evidenceClaimIds: [], claimIds: [], worldRuleIds: [],
  }))
  delta.evidenceBeatIds = [beats[beats.length - 1].id]
  const contract: EvolutionContract = {
    id: stable(`${worldId}:opening:contract`), worldId, tick: 1, status: 'active', coreEvent: text(result.openingSituation, '一个异常迫使主角立即行动'),
    mainlineObjective: text(result.immediateGoal, '处理眼前异常'), causalPrerequisite: '作品起点的具体异常在首章发生', readerPayoff: text(result.localPayoff, '主角完成一次有代价的选择'), scopeBoundary: '不得解释全貌、终局或未进入现场的阵营',
    povEntityId: actor.genetics.seed, sceneId: scene.id, participants: [{ actorId: actor.genetics.seed, reason: '首章POV，异常直接打断其当前处境', goal: text(result.immediateGoal, '处理眼前异常'), risk: '选择失败会失去安全、时间或重要资源', sceneFunction: '承担读者入口并作出关键选择', necessity: '删除该人物首章无法成立' }],
    referenceEntities: [], readerEntry: { chapterNumber: 1, knownAtOpening: strings(result.knownAtOpening), allowedNewConcepts: strings(result.allowedNewConcepts).slice(0, 1), withheldInformation: ['世界全貌与终局答案'] },
    requiredStateChanges: [text(result.localPayoff, '首章选择改变了行动空间')], stateBefore: [], requiredDeltas: [delta], forbiddenDeltas: [], relevance: { mode: 'advance', targetArcConditionIds: [] },
    foreshadowActions: [text(result.longTermQuestion, '为什么这件事会发生？')], allowedAnswers: [], forbiddenMoves: ['开篇解释完整世界观', '按角色顺序介绍人物', '突然跳到终局'], emotionTarget: '不安与好奇', climaxForm: 'choice', hookType, hookGoal: text(result.hookGoal, text(result.longTermQuestion, '一个后果迫使读者继续')), requiredBeats: rawBeats.map((_, i) => `首章节拍${i + 1}`), continuityChecks: ['首章只有一个POV', '前三段建立即时目标或异常'], evaluationFocus: ['读者能复述目标、阻碍、选择和结果'], causalAnchorEventIds: [], narrativePurpose: 'advance_mainline', horizonVersion: 0, createdAt: new Date().toISOString(),
  }
  db.prepare(`INSERT INTO evolution_contracts (id,world_id,tick,contract_json,status,created_at) VALUES (?,?,?,?,?,?)`).run(contract.id, worldId, 1, JSON.stringify(contract), 'active', contract.createdAt)
  return contract
}
