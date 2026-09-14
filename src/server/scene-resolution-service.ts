import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { chatJson } from './llm/openai-compat'
import { getDatabase } from './database'
import type { WorldSlice } from '@/domain/world'
import type { EvolutionContract, AgentIntent, SceneBeat } from '@/domain/narrative-workflow'
import { ensureCharacterDecisionSignature, getCharacterDecisionSignature } from './reader-story-service'

type DeliberationIssue = {
  severity: 'critical' | 'error' | 'warning'
  category: string
  evidence: string
  violatedConstraint: string
  repairDirection: string
}

type WritersRoomOpinion = {
  role: string
  actorId?: string
  proposalId: string
  verdict: 'support' | 'revise' | 'reject'
  issues: DeliberationIssue[]
}

type SceneProposal = {
  id: string
  premise: string
  causalAnchors: string[]
  beats: Array<Record<string, unknown>>
  stateAfterEvidence: string[]
  readerPayoff: string
  hookResult: string
  risks: string[]
}

const CORE_ROLES = [
  'MainlineGuardian',
  'CausalityCritic',
  'ContinuityKeeper',
  'ReaderAdvocate',
  'DevilsAdvocate',
] as const

function text(value: unknown, fallback = ''): string {
  const result = String(value ?? '').trim()
  return result || fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)) : []
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => consume()))
  return results
}

function actorById(world: WorldSlice, id: string) {
  return world.agents.npcs.find((actor) => actor.genetics.seed === id)
}

export function buildAgentIntents(
  worldId: string,
  tick: number,
  before: WorldSlice,
  after: WorldSlice,
  contract: EvolutionContract,
): AgentIntent[] {
  const prior = new Map(before.agents.npcs.map((actor) => [actor.genetics.seed, actor]))
  return contract.participants.map((participant) => {
    const actor = actorById(after, participant.actorId) || actorById(before, participant.actorId)
    if (!actor) throw new Error('编剧会找不到参与人物：' + participant.actorId)
    const previous = prior.get(participant.actorId)
    const action = text(actor.last_action_description)
    const dialogue = text(actor.last_dialogue)
    const target = undefined
    return {
      id: randomUUID(),
      worldId,
      tick,
      actorId: participant.actorId,
      perceivedSituation: text(previous?.last_action_description, contract.coreEvent),
      immediateGoal: participant.goal,
      intendedAction: action || text(actor.action_history?.slice(-1)[0]?.type, '尝试改变当前冲突'),
      reason: '角色当前目标：' + participant.goal + '；进入原因：' + participant.reason,
      expectedResult: '使本章产生可记录的状态变化：' + contract.requiredStateChanges.join('；'),
      acceptableCost: participant.risk,
      hardBoundary: '不得使用尚未获得的信息，不得违背当前人物关系、能力和章节范围',
      knownClaimIds: [],
      targetActorIds: target ? [String(target)] : contract.participants.filter((item) => item.actorId !== participant.actorId).map((item) => item.actorId),
      status: 'proposed' as const,
    }
  })
}

export async function generateAgentIntents(
  worldId: string,
  tick: number,
  world: WorldSlice,
  contract: EvolutionContract,
): Promise<AgentIntent[]> {
  const db = getDatabase()
  const knownClaims = new Set((db.prepare("SELECT claim_id,holder_id FROM knowledge_states WHERE world_id=? AND holder_type='actor' AND stance!='rejected' AND learned_at_tick<=?").all(worldId, tick) as Array<{ claim_id: string; holder_id: string }>).map((row) => row.claim_id + ':' + row.holder_id))
  const publicClaims = new Set((db.prepare("SELECT id FROM claims WHERE world_id=? AND claim_scope='public_narrative'").all(worldId) as Array<{ id: string }>).map((row) => row.id))
  const publishedEvents = new Set((db.prepare('SELECT id FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL').all(worldId) as Array<{ id: string }>).map((row) => row.id))
  const worldRules = new Set((db.prepare('SELECT id FROM world_rules WHERE world_id=? AND enabled=1').all(worldId) as Array<{ id: string }>).map((row) => row.id))
  const deltaIds = new Set((contract.requiredDeltas || []).map((item) => item.id))
  const participants = contract.participants
  await Promise.all(participants.map((participant) => ensureCharacterDecisionSignature(worldId, participant.actorId)))
  const tasks = participants.map((participant) => ({ participant }))
  const generated = await mapWithConcurrency(tasks, 3, async ({ participant }) => {
    const actor = actorById(world, participant.actorId)
    if (!actor) throw new Error('编剧会找不到参与人物：' + participant.actorId)
    const visibleClaims = db.prepare(`SELECT c.id,c.subject_id,c.predicate,c.object_id,c.value_json,c.claim_scope
      FROM claims c WHERE c.world_id=? AND c.valid_until IS NULL AND (
        c.claim_scope='public_narrative'
        OR (c.claim_scope='character_belief' AND c.believer_id=?)
        OR EXISTS (SELECT 1 FROM knowledge_states k WHERE k.world_id=c.world_id AND k.claim_id=c.id
          AND k.learned_at_tick<=? AND k.stance!='rejected'
          AND (k.holder_type='public' OR (k.holder_type='actor' AND k.holder_id=?)))
      ) ORDER BY c.created_at DESC LIMIT 40`).all(worldId, participant.actorId, tick, participant.actorId)
    const prompt = [
      '你是角色辩护者，只为一个角色提出结构化行动意图，不写小说正文。',
      '角色不能使用未知信息，不知道远期候选方向，不能替作者完成主线，不能凭空创造人物、地点、能力、证据或解法。',
      '意图必须包含立即目标、行动、动机、预期结果、可接受代价、硬边界和目标人物。',
      '返回 JSON：{"goalId":"...","perceivedSituation":"...","immediateGoal":"...","intendedAction":"...","reason":"...","expectedResult":"...","acceptableCost":"...","hardBoundary":"...","knownClaimIds":[],"anchorEventIds":[],"relationshipStateIds":[],"applicableRuleIds":[],"contributionDeltaIds":[],"targetActorIds":[]}',
      '本章契约：' + JSON.stringify(contract),
      '角色：' + JSON.stringify({ id: actor.genetics.seed, name: actor.identity.name, goals: actor.goals, belief: actor.core_belief, relations: actor.relations, memory: actor.memory_short.slice(-8), location: actor.location, lifeStatus: actor.life_status }),
      '人物选择签名（不得为了大纲静默改写）：' + JSON.stringify(getCharacterDecisionSignature(worldId, participant.actorId)),
      '该角色在本 Tick 可引用的命题（只能使用这些 ID）：' + JSON.stringify(visibleClaims),
      '当前场景与最近事件：' + JSON.stringify({ time: world.time, environment: world.environment, events: world.events.slice(-8) }),
    ].join('\n')
    const result = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 2200, maxAttempts: 2 })
    const allowed = new Set(participants.map((item) => item.actorId))
    const knownClaimIds = strings(result.knownClaimIds).filter((claimId) => publicClaims.has(claimId) || knownClaims.has(claimId + ':' + participant.actorId))
    const anchorEventIds = strings(result.anchorEventIds).filter((id) => publishedEvents.has(id))
    const applicableRuleIds = strings(result.applicableRuleIds).filter((id) => worldRules.has(id))
    const contributionDeltaIds = strings(result.contributionDeltaIds).filter((id) => deltaIds.has(id))
    const targetActorIds = strings(result.targetActorIds).filter((id) => allowed.has(id) && id !== participant.actorId)
    return {
      id: 'intent-' + contract.id + '-' + participant.actorId,
      worldId,
      tick,
      actorId: participant.actorId,
      perceivedSituation: text(result.perceivedSituation, contract.coreEvent),
      immediateGoal: text(result.immediateGoal, participant.goal),
      goalId: text(result.goalId, `goal-${participant.actorId}`),
      intendedAction: text(result.intendedAction),
      reason: text(result.reason, participant.reason),
      expectedResult: text(result.expectedResult, contract.requiredStateChanges.join('；')),
      acceptableCost: text(result.acceptableCost, participant.risk),
      hardBoundary: text(result.hardBoundary, '不得使用未知信息，不得违背人物底线和章节范围'),
      knownClaimIds,
      anchorEventIds, relationshipStateIds: strings(result.relationshipStateIds), applicableRuleIds, contributionDeltaIds,
      targetActorIds,
      status: 'proposed' as const,
    }
  })
  if (generated.some((intent) => !intent.intendedAction || (contract.tick > 1 && !intent.knownClaimIds.length && !intent.anchorEventIds?.length && !intent.applicableRuleIds?.length))) throw new Error('角色辩护者的意图缺少真实命题、已发布事件或世界规则作为因果锚点')
  return generated
}

export function saveAgentIntents(intents: AgentIntent[]): void {
  const db = getDatabase()
  const statement = db.prepare(
    'INSERT INTO agent_intents (id,world_id,tick,actor_id,intent_json,status,created_at) VALUES (?,?,?,?,?,?,?) ' +
    'ON CONFLICT(world_id,tick,actor_id) DO UPDATE SET id=excluded.id,intent_json=excluded.intent_json,status=excluded.status',
  )
  const now = new Date().toISOString()
  db.exec('BEGIN')
  try {
    for (const intent of intents) statement.run(intent.id, intent.worldId, intent.tick, intent.actorId, JSON.stringify(intent), intent.status, now)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function loadAgentIntents(worldId: string, tick: number): AgentIntent[] {
  const rows = getDatabase().prepare('SELECT intent_json FROM agent_intents WHERE world_id=? AND tick=? ORDER BY created_at,actor_id').all(worldId, tick) as Array<{ intent_json: string }>
  return rows.map((row) => JSON.parse(row.intent_json) as AgentIntent)
}

function proposalPrompt(world: WorldSlice, contract: EvolutionContract, intents: AgentIntent[]): string {
  return [
    '你是长篇小说的剧本总编，只做结构化剧情方案，不写正文。',
    '根据章节契约提出两个实现同一目标的不同场景方案。多角色章形成触发、行动、他人反应、选项变化、决定、后果的连续链；单角色章由环境、期限、制度、身体或信息限制反馈并改变选项。',
    '不得让角色使用未知信息，不得凭空增加人物、地点、能力、秘密或解法。',
    '方案必须实现本章 requiredDeltas，并且推进当前故事弧。角色不知道远期候选方向，不得为候选结局强迫人物。',
    '返回 JSON：{"proposals":[{"premise":"...","causalAnchors":["已发布事件ID"],"beats":[{"ordinal":1,"dependsOnBeatIds":[],"trigger":"...","actorId":"...","action":"...","targetActorIds":["..."],"reaction":"...","changedOption":"...","consequence":"...","claimIds":[],"worldRuleIds":[],"producesDeltaIds":["状态变化ID"]}],"stateAfterEvidence":["..."],"readerPayoff":"...","hookResult":"...","risks":["..."]}]}',
    '章节契约：' + JSON.stringify(contract),
    '角色意图：' + JSON.stringify(intents),
    '最近世界状态：' + JSON.stringify({ time: world.time, environment: world.environment, events: world.events.slice(-8) }),
  ].join('\n')
}

async function proposeScenes(world: WorldSlice, contract: EvolutionContract, intents: AgentIntent[]): Promise<SceneProposal[]> {
  const result = await chatJson([{ role: 'user', content: proposalPrompt(world, contract, intents) }], { maxTokens: 5000, maxAttempts: 2 })
  const proposals = records(result.proposals)
  return proposals.slice(0, 2).map((item, index) => ({
    id: 'proposal-' + contract.id + '-' + (index + 1),
    premise: text(item.premise),
    causalAnchors: strings(item.causalAnchors),
    beats: records(item.beats),
    stateAfterEvidence: strings(item.stateAfterEvidence),
    readerPayoff: text(item.readerPayoff),
    hookResult: text(item.hookResult),
    risks: strings(item.risks),
  })).filter((proposal) => proposal.premise && proposal.beats.length >= 2)
}

function roleInstruction(role: string): string {
  const instructions: Record<string, string> = {
    MainlineGuardian: '检查方案是否推进当前章节目标和当前故事弧，并守住当前卷方向；不得要求人物迎合任何候选终局。',
    CausalityCritic: '检查每个节拍是否具备触发、动机、行动、反应、选择和后果，寻找跳步和巧合。',
    ContinuityKeeper: '检查时间、地点、人物生死、能力规则、认知边界和已发生事实。',
    ReaderAdvocate: '检查首段进入、信息密度、读者回报、理解成本和章末钩子。',
    DevilsAdvocate: '假设方案是错的，寻找便利解法、强行降智、性格突变、流水账和无法兑现的承诺。',
    ReaderCausalityEditor: '同时检查因果连续、读者理解、局部回报、信息预算和钩子是否来自本章后果。',
  }
  return instructions[role] || '从人物合理性和叙事必要性角度审查方案。'
}

async function reviewProposals(role: string, proposals: SceneProposal[], world: WorldSlice, contract: EvolutionContract, intents: AgentIntent[], actorId?: string): Promise<WritersRoomOpinion[]> {
  const actor = actorId ? actorById(world, actorId) : undefined
  const prompt = [
    '你是编剧会成员 ' + role + '。只输出结构化审议，不写小说正文。',
    roleInstruction(role),
    actor ? '你同时代表人物：' + JSON.stringify({ id: actor.genetics.seed, name: actor.identity.name, goals: actor.goals, belief: actor.core_belief, relations: actor.relations, memory: actor.memory_short.slice(-5), decisionSignature: getCharacterDecisionSignature(contract.worldId, actorId!) }) : '',
    '在一次调用中比较全部候选，每个候选必须有且只有一条意见。返回 JSON：{"opinions":[{"proposalId":"...","verdict":"support|revise|reject","issues":[{"severity":"critical|error|warning","category":"...","evidence":"引用具体方案内容","violatedConstraint":"具体契约字段或事实","repairDirection":"可执行修复"}]}]}',
    '章节契约：' + JSON.stringify(contract),
    '角色意图：' + JSON.stringify(actorId ? intents.filter((intent) => intent.actorId === actorId) : intents),
    '候选方案：' + JSON.stringify(proposals),
  ].filter(Boolean).join('\n')
  const result = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 3600, maxAttempts: 2 })
  const byProposal = new Map(records(result.opinions).map((item) => [text(item.proposalId), item]))
  return proposals.map((proposal) => {
    const item = byProposal.get(proposal.id)
    if (!item) return { role, actorId, proposalId: proposal.id, verdict: 'revise' as const, issues: [{ severity: 'error' as const, category: role, evidence: '审议 Agent 没有评价这个候选方案', violatedConstraint: '每个候选必须有完整审议', repairDirection: '重新调用该审议 Agent' }] }
    const verdict = ['support', 'revise', 'reject'].includes(String(item.verdict)) ? String(item.verdict) as WritersRoomOpinion['verdict'] : 'revise'
    const issues = records(item.issues).map((issue) => ({
      severity: ['critical', 'error', 'warning'].includes(String(issue.severity)) ? String(issue.severity) as DeliberationIssue['severity'] : 'error',
      category: text(issue.category, role), evidence: text(issue.evidence, '审议 Agent 未提供证据'),
      violatedConstraint: text(issue.violatedConstraint, '未说明'), repairDirection: text(issue.repairDirection, '重新设计该节拍'),
    }))
    return { role, actorId, proposalId: proposal.id, verdict, issues }
  })
}

function normalizeBeat(raw: Record<string, unknown>, ordinal: number, allowedActors: Set<string>, contract: EvolutionContract): SceneBeat | null {
  const actorId = text(raw.actorId)
  if (!actorId || !allowedActors.has(actorId)) return null
  const targetActorIds = strings(raw.targetActorIds).filter((id) => allowedActors.has(id))
  const beat = {
    id: `beat-${contract.id}-${ordinal}`,
    worldId: '',
    tick: 0,
    ordinal,
    dependsOnBeatIds: (() => {
      const ids = strings(raw.dependsOnBeatIds).map((id) => /^\d+$/.test(id) ? `beat-${contract.id}-${id}` : id)
      return ids.length || ordinal === 1 ? ids : [`beat-${contract.id}-${ordinal - 1}`]
    })(),
    trigger: text(raw.trigger),
    actorId,
    action: text(raw.action),
    targetActorIds,
    reaction: text(raw.reaction),
    changedOption: text(raw.changedOption),
    consequence: text(raw.consequence),
    claimIds: strings(raw.claimIds),
    worldRuleIds: strings(raw.worldRuleIds),
    consumesConditions: records(raw.consumesConditions) as SceneBeat['consumesConditions'],
    producesDeltaIds: strings(raw.producesDeltaIds).filter((id) => (contract.requiredDeltas || []).some((delta) => delta.id === id)),
    evidenceClaimIds: strings(raw.evidenceClaimIds),
  }
  if (!beat.trigger || !beat.action || !beat.reaction || !beat.changedOption || !beat.consequence) return null
  return beat
}

async function resolveProposal(proposals: SceneProposal[], opinions: WritersRoomOpinion[], world: WorldSlice, contract: EvolutionContract, intents: AgentIntent[]): Promise<{ resolution: { selectedProposalId: string; resolvedIssueIds: string[]; unresolvedIssueIds: string[]; finalBeats: SceneBeat[]; stateAfterEvidence: string[] }; proposal: SceneProposal }> {
  const prompt = [
    '你是剧本总编。阅读候选方案和编剧会意见，选择一个方案并修订为唯一行动链。',
    '不能合并互相冲突的方案，不能删除主线要求来制造“通过”。逐条回应 critical/error，未能解决的问题必须列入 unresolvedIssueIds。',
    '返回 JSON：{"selectedProposalId":"...","resolvedIssueIds":["..."],"unresolvedIssueIds":["..."],"finalBeats":[{"ordinal":1,"dependsOnBeatIds":[],"trigger":"...","actorId":"...","action":"...","targetActorIds":[],"reaction":"...","changedOption":"...","consequence":"...","claimIds":[],"worldRuleIds":[],"producesDeltaIds":["状态变化ID"]}],"stateAfterEvidence":["..."]}',
    '章节契约：' + JSON.stringify(contract),
    '候选方案：' + JSON.stringify(proposals),
    '审议意见：' + JSON.stringify(opinions),
    '角色意图：' + JSON.stringify(intents),
    '世界当前状态：' + JSON.stringify({ time: world.time, events: world.events.slice(-8) }),
  ].join('\n')
  const result = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 5000, maxAttempts: 2 })
  const selectedId = text(result.selectedProposalId)
  const proposal = proposals.find((item) => item.id === selectedId) || proposals[0]
  if (!proposal) throw new Error('编剧会没有可供综合的场景方案')
  const allowedActors = new Set(contract.participants.map((item) => item.actorId))
  const finalBeats = records(result.finalBeats).map((item, index) => normalizeBeat(item, index + 1, allowedActors, contract)).filter((item): item is SceneBeat => Boolean(item))
  for (const beat of finalBeats) {
    beat.worldId = contract.worldId
    beat.tick = contract.tick
  }
  return {
    resolution: {
      selectedProposalId: proposal.id,
      resolvedIssueIds: strings(result.resolvedIssueIds),
      unresolvedIssueIds: strings(result.unresolvedIssueIds),
      finalBeats,
      stateAfterEvidence: strings(result.stateAfterEvidence),
    },
    proposal,
  }
}

function structuralIssues(beats: SceneBeat[], contract: EvolutionContract): DeliberationIssue[] {
  const allowed = new Set(contract.participants.map((item) => item.actorId))
  const issues: DeliberationIssue[] = []
  if (beats.length < 2) issues.push({ severity: 'critical', category: 'scene_chain', evidence: '最终节拍少于2个', violatedConstraint: '必须形成连续行动链', repairDirection: '重新设计触发、反应和后果' })
  const hasInteractiveChange = beats.some((beat) => beat.targetActorIds.some((id) => allowed.has(id)) && beat.reaction && beat.changedOption)
  const hasExternalResistanceChange = beats.some((beat, index) => index > 0 && (beat.dependsOnBeatIds || []).length > 0 && beat.reaction && beat.changedOption && !/思考|观察|回忆/.test(beat.action))
  if (contract.participants.length > 1 && !hasInteractiveChange) {
    issues.push({ severity: 'critical', category: 'mutual_influence', evidence: '没有节拍证明他人的反应改变后续选项', violatedConstraint: '多角色主场景人物必须互相影响', repairDirection: '加入目标人物的反应及由此改变的选择' })
  }
  if (contract.participants.length === 1 && !hasExternalResistanceChange) {
    issues.push({ severity: 'critical', category: 'external_resistance', evidence: '单角色场景没有外部条件反馈迫使人物改变选择', violatedConstraint: '单角色章节必须存在有效外部阻力', repairDirection: '让环境、期限、制度、身体或信息限制对行动作出可验证反馈' })
  }
  if (beats.some((beat) => beat.targetActorIds.some((id) => !allowed.has(id)))) {
    issues.push({ severity: 'critical', category: 'unauthorized_actor', evidence: '节拍引用了契约外人物', violatedConstraint: '参与人物必须来自章节契约', repairDirection: '删除或重新规划该人物' })
  }
  return issues
}

export async function resolveSceneBeats(worldId: string, world: WorldSlice, contract: EvolutionContract, intents: AgentIntent[]): Promise<SceneBeat[]> {
  const db = getDatabase()
  const sessionId = 'room-' + contract.id
  const briefHash = createHash('sha256').update(JSON.stringify({ contract, intents })).digest('hex')
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO writers_room_sessions (id,world_id,tick,contract_id,round,status,brief_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT(world_id,tick,contract_id) DO UPDATE SET round=excluded.round,status=excluded.status,brief_hash=excluded.brief_hash,updated_at=excluded.updated_at',
  ).run(sessionId, worldId, contract.tick, contract.id, 1, 'proposing', briefHash, now, now)
  const proposals = await proposeScenes(world, contract, intents)
  if (proposals.length < 2) throw new Error('剧本 Agent 未生成至少两个可审议的场景方案')
  const saveProposal = db.prepare(
    'INSERT INTO scene_proposals (id,session_id,world_id,tick,premise,proposal_json,status,created_at) VALUES (?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT(session_id,id) DO UPDATE SET premise=excluded.premise,proposal_json=excluded.proposal_json,status=excluded.status',
  )
  for (const proposal of proposals) saveProposal.run(proposal.id, sessionId, worldId, contract.tick, proposal.premise, JSON.stringify(proposal), 'proposed', now)
  db.prepare('UPDATE writers_room_sessions SET status=? ,updated_at=? WHERE id=?').run('reviewing', now, sessionId)
  const highComplexity = contract.participants.length >= 3 || (contract.requiredDeltas || []).some((delta) => !delta.reversible) || contract.allowedAnswers.length > 0 || contract.foreshadowActions.length > 0
  const reviewTasks = highComplexity
    ? [...CORE_ROLES.map((role) => ({ role, actorId: undefined as string | undefined })), ...contract.participants.map((participant) => ({ role: 'CharacterAdvocate', actorId: participant.actorId }))]
    : [{ role: 'ReaderCausalityEditor', actorId: undefined as string | undefined }, ...contract.participants.slice(0, 2).map((participant) => ({ role: 'CharacterAdvocate', actorId: participant.actorId }))]
  const opinions = (await mapWithConcurrency(reviewTasks, 3, (task) => reviewProposals(task.role, proposals, world, contract, intents, task.actorId))).flat()
  const saveOpinion = db.prepare('INSERT OR REPLACE INTO writers_room_opinions (id,session_id,round,role,actor_id,proposal_id,opinion_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
  for (const opinion of opinions) saveOpinion.run(randomUUID(), sessionId, 1, opinion.role, opinion.actorId || null, opinion.proposalId, JSON.stringify(opinion), now)
  let { resolution } = await resolveProposal(proposals, opinions, world, contract, intents)
  let selectedProposal = proposals.find((proposal) => proposal.id === resolution.selectedProposalId) || proposals[0]
  if (!selectedProposal) throw new Error('编剧会没有选中的场景方案')
  let finalProposal: SceneProposal = { ...selectedProposal, beats: resolution.finalBeats }
  const issueOwners = new Set(opinions
    .filter((opinion) => opinion.proposalId === selectedProposal.id && opinion.issues.some((issue) => issue.severity !== 'warning'))
    .map((opinion) => `${opinion.role}:${opinion.actorId || ''}`))
  issueOwners.add('MainlineGuardian:')
  issueOwners.add('ContinuityKeeper:')
  const targetedTasks = reviewTasks.filter((task) => issueOwners.has(`${task.role}:${task.actorId || ''}`))
  let finalOpinions = targetedTasks.length
    ? (await mapWithConcurrency(targetedTasks, 3, (task) => reviewProposals(task.role, [finalProposal], world, contract, intents, task.actorId))).flat()
    : []
  let issues = [...finalOpinions.flatMap((opinion) => opinion.issues), ...structuralIssues(resolution.finalBeats, contract)]

  // The first synthesis must answer the first round. If the resulting beats
  // still contain a cited problem, run one targeted reconsideration instead
  // of silently publishing or discarding the whole chapter.
  if (issues.some((issue) => issue.severity === 'critical' || issue.severity === 'error')) {
    db.prepare('UPDATE writers_room_sessions SET round=2,status=?,updated_at=? WHERE id=?').run('reconsidering', new Date().toISOString(), sessionId)
    for (const opinion of finalOpinions) saveOpinion.run(randomUUID(), sessionId, 2, opinion.role, opinion.actorId || null, finalProposal.id, JSON.stringify(opinion), new Date().toISOString())
    const reconsidered = await resolveProposal([finalProposal], finalOpinions, world, contract, intents)
    resolution = reconsidered.resolution
    finalProposal = { ...finalProposal, beats: resolution.finalBeats }
    const secondReviewTasks = targetedTasks.length ? targetedTasks : reviewTasks.slice(0, 2)
    finalOpinions = (await mapWithConcurrency(secondReviewTasks, 3, (task) => reviewProposals(task.role, [finalProposal], world, contract, intents, task.actorId))).flat()
    issues = [...finalOpinions.flatMap((opinion) => opinion.issues), ...structuralIssues(resolution.finalBeats, contract)]
    db.prepare('INSERT OR REPLACE INTO writers_room_resolutions (id,session_id,round,resolution_json,passed,created_at) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), sessionId, 2, JSON.stringify({ resolution, issues }), issues.some((issue) => issue.severity === 'critical' || issue.severity === 'error') ? 0 : 1, new Date().toISOString())
  }

  const unresolved = resolution.unresolvedIssueIds.length > 0 || issues.some((issue) => issue.severity === 'critical' || issue.severity === 'error')
  db.prepare('INSERT OR REPLACE INTO writers_room_resolutions (id,session_id,round,resolution_json,passed,created_at) VALUES (?,?,?,?,?,?)')
    .run(randomUUID(), sessionId, 1, JSON.stringify({ resolution, issues }), unresolved ? 0 : 1, now)
  db.prepare('UPDATE writers_room_sessions SET status=?,selected_proposal_id=?,updated_at=? WHERE id=?')
    .run(unresolved ? 'blocked' : 'resolved', unresolved ? null : resolution.selectedProposalId, new Date().toISOString(), sessionId)
  for (const proposal of proposals) {
    db.prepare('UPDATE scene_proposals SET status=? WHERE id=?').run(!unresolved && proposal.id === resolution.selectedProposalId ? 'selected' : 'rejected', proposal.id)
  }
  db.prepare(
    'INSERT INTO narrative_gate_reviews (id,world_id,tick,passed,review_json,created_at) VALUES (?,?,?,?,?,?) ' +
    'ON CONFLICT(world_id,tick) DO UPDATE SET passed=excluded.passed,review_json=excluded.review_json,created_at=excluded.created_at',
  ).run(randomUUID(), worldId, contract.tick, unresolved ? 0 : 1, JSON.stringify({ proposals, opinions, resolution, issues }), new Date().toISOString())
  if (unresolved) throw new Error('编剧会存在未解决的关键问题：' + issues.slice(0, 3).map((issue) => issue.category + '：' + issue.evidence).join('；'))
  const statement = db.prepare('INSERT INTO scene_beats (id,world_id,tick,ordinal,beat_json,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(world_id,tick,ordinal) DO UPDATE SET id=excluded.id,beat_json=excluded.beat_json')
  const beatNow = new Date().toISOString()
  for (const beat of resolution.finalBeats) statement.run(beat.id, worldId, contract.tick, beat.ordinal, JSON.stringify(beat), beatNow)
  return resolution.finalBeats
}

export function loadSceneBeats(worldId: string, tick: number): SceneBeat[] {
  const rows = getDatabase().prepare('SELECT beat_json FROM scene_beats WHERE world_id=? AND tick=? ORDER BY ordinal').all(worldId, tick) as Array<{ beat_json: string }>
  return rows.map((row) => JSON.parse(row.beat_json) as SceneBeat)
}
