import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { WorldSlice } from '@/domain/world'
import type {
  BookFoundation, ChapterOutline, EvolutionContract, FinaleContract, FutureTrajectory, MainlineHealthReport,
  NarrativeHorizon, NarrativeQuestion, PendingTransition, RequiredStateDelta, SceneBeat,
  StateCondition,
} from '@/domain/narrative-workflow'
import { getDatabase } from './database'
import { chatJson } from './llm/openai-compat'

const parse = <T>(value: unknown, fallback: T): T => {
  try { return typeof value === 'string' ? JSON.parse(value) as T : fallback } catch { return fallback }
}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const stableId = (prefix: string, value: string) => `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`

export function getNarrativeHorizon(worldId: string): NarrativeHorizon | null {
  const row = getDatabase().prepare('SELECT horizon_json FROM narrative_horizons WHERE world_id=? ORDER BY version DESC LIMIT 1').get(worldId) as { horizon_json: string } | undefined
  return row ? parse<NarrativeHorizon>(row.horizon_json, null as never) : null
}

export function listFutureTrajectories(worldId: string): FutureTrajectory[] {
  const rows = getDatabase().prepare('SELECT trajectory_json FROM future_trajectories WHERE world_id=? AND horizon_version=(SELECT MAX(version) FROM narrative_horizons WHERE world_id=?) ORDER BY confidence DESC,created_at').all(worldId, worldId) as Array<{ trajectory_json: string }>
  return rows.map((row) => parse<FutureTrajectory>(row.trajectory_json, null as never)).filter(Boolean)
}

export function syncNarrativeHorizonPointers(worldId: string): NarrativeHorizon | null {
  const db = getDatabase()
  const horizon = getNarrativeHorizon(worldId)
  if (!horizon) return null
  const volume = db.prepare("SELECT id FROM volumes WHERE world_id=? AND status='active' ORDER BY ordinal LIMIT 1").get(worldId) as { id: string } | undefined
  const arc = db.prepare("SELECT id FROM story_arcs WHERE world_id=? AND status='active' ORDER BY created_at LIMIT 1").get(worldId) as { id: string } | undefined
  horizon.currentVolumeId = volume?.id
  horizon.currentArcId = arc?.id
  horizon.activeObligationIds = (db.prepare("SELECT id FROM narrative_obligations WHERE world_id=? AND status!='resolved'").all(worldId) as Array<{ id: string }>).map((row) => row.id)
  db.prepare('UPDATE narrative_horizons SET horizon_json=? WHERE id=?').run(JSON.stringify(horizon), horizon.id)
  return horizon
}

export function getLatestMainlineHealth(worldId: string): MainlineHealthReport | null {
  const row = getDatabase().prepare('SELECT report_json FROM mainline_health_reports WHERE world_id=? ORDER BY tick DESC,created_at DESC LIMIT 1').get(worldId) as { report_json: string } | undefined
  return row ? parse<MainlineHealthReport>(row.report_json, null as never) : null
}

export function getClosureReadiness(worldId: string) {
  const db = getDatabase(); const horizon = getNarrativeHorizon(worldId); const trajectories = listFutureTrajectories(worldId)
  const openObligations = Number((db.prepare("SELECT COUNT(*) AS value FROM narrative_obligations WHERE world_id=? AND status!='resolved'").get(worldId) as { value: number }).value)
  const activeThreads = Number((db.prepare("SELECT COUNT(*) AS value FROM story_threads WHERE world_id=? AND status IN ('active','escalating')").get(worldId) as { value: number }).value)
  const irreversibleChanges = Number((db.prepare("SELECT COUNT(*) AS value FROM state_deltas WHERE world_id=? AND status='published' AND json_extract(delta_json,'$.reversible')=0").get(worldId) as { value: number }).value)
  const supported = trajectories.filter((item) => item.viability === 'supported')
  const checks = {
    irreversibleConflictChange: irreversibleChanges > 0,
    coreQuestionsAnswerable: Boolean(horizon?.openQuestions.length) && horizon!.openQuestions.every((item) => item.status !== 'open' || item.answerEventIds.length > 0),
    obligationsRecoverable: openObligations <= 3,
    threadsClosable: activeThreads <= 2,
    supportedTrajectory: supported.length === 1,
    noInventedFinaleMechanism: supported.length === 1 && supported[0].supportingEventIds.length > 0,
    convergenceReached: horizon?.phase === 'convergence',
  }
  return { ready: Object.values(checks).every(Boolean), phase: horizon?.phase || 'exploration', checks, openObligations, activeThreads, supportedTrajectoryIds: supported.map((item) => item.id) }
}

export function getFinaleContract(worldId: string): FinaleContract | null {
  const row = getDatabase().prepare('SELECT contract_json FROM finale_contracts WHERE world_id=? ORDER BY created_at DESC LIMIT 1').get(worldId) as { contract_json: string } | undefined
  return row ? parse<FinaleContract>(row.contract_json, null as never) : null
}

export async function ensureFinaleContract(worldId: string): Promise<FinaleContract> {
  const existing = getFinaleContract(worldId)
  if (existing) return existing
  const readiness = getClosureReadiness(worldId)
  if (!readiness.ready) throw new Error('最终卷条件尚未自然成熟')
  const horizon = getNarrativeHorizon(worldId)
  const trajectory = listFutureTrajectories(worldId).find((item) => item.id === readiness.supportedTrajectoryIds[0])
  if (!horizon || !trajectory) throw new Error('缺少可由已发布事实支持的唯一终局方向')
  const db = getDatabase()
  const events = db.prepare('SELECT id,summary,tick FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL ORDER BY tick').all(worldId)
  const prompt = `你是最终卷架构师。只能依据已发布事件与被持续支持的候选方向形成终局契约，不得篡改旧事实或新增解决一切的关键机制。返回 JSON：endingTruth,finalChoice,requiredMilestones[{description,prerequisiteConditionIds:[]}],requiredPayoffs[],prohibitedShortcuts[],unresolvedThreads[]。\n候选方向：${JSON.stringify(trajectory)}\n已发布事件：${JSON.stringify(events)}`
  const raw = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 5000, maxAttempts: 2 })
  const endingTruth = text(raw.endingTruth); const finalChoice = text(raw.finalChoice)
  if (!endingTruth || !finalChoice) throw new Error('最终卷方案缺少可验证的终局真相或最终选择')
  const contract: FinaleContract = {
    id: stableId('finale', `${worldId}:${horizon.version}:${trajectory.id}`), worldId, horizonVersion: horizon.version,
    selectedTrajectoryId: trajectory.id, endingTruth, finalChoice,
    requiredMilestones: records(raw.requiredMilestones).map((item, index) => ({ id: stableId('milestone', `${worldId}:${index}:${text(item.description)}`), description: text(item.description), prerequisiteConditionIds: strings(item.prerequisiteConditionIds) })).filter((item) => item.description),
    requiredPayoffs: strings(raw.requiredPayoffs), prohibitedShortcuts: strings(raw.prohibitedShortcuts), unresolvedThreads: strings(raw.unresolvedThreads), status: 'active',
  }
  const now = new Date().toISOString()
  db.exec('BEGIN')
  try {
    db.prepare('INSERT INTO finale_contracts (id,world_id,horizon_version,status,contract_json,created_at) VALUES (?,?,?,?,?,?)').run(contract.id, worldId, horizon.version, contract.status, JSON.stringify(contract), now)
    horizon.phase = 'finale'
    db.prepare("UPDATE narrative_horizons SET phase='finale',horizon_json=? WHERE id=?").run(JSON.stringify(horizon), horizon.id)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return contract
}

export function reopenFinale(worldId: string) {
  const db = getDatabase()
  const row = db.prepare("SELECT id,created_at FROM finale_contracts WHERE world_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").get(worldId) as { id: string; created_at: string } | undefined
  if (!row) throw new Error('当前没有可撤销的最终卷契约')
  if (db.prepare('SELECT 1 FROM chapters WHERE world_id=? AND created_at>=? LIMIT 1').get(worldId, row.created_at)) throw new Error('最终卷首章已经发布，必须通过新版本和正文事件解释变化')
  const horizon = getNarrativeHorizon(worldId)
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM finale_contracts WHERE id=?').run(row.id)
    if (horizon) { horizon.phase = 'convergence'; db.prepare("UPDATE narrative_horizons SET phase='convergence',horizon_json=? WHERE id=?").run(JSON.stringify(horizon), horizon.id) }
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return { reopened: true }
}

export async function ensureNarrativeHorizon(worldId: string, foundation: BookFoundation): Promise<NarrativeHorizon> {
  const existing = getNarrativeHorizon(worldId)
  if (existing && existing.stablePromises.includes(foundation.corePromise) && existing.stablePromises.includes(foundation.audiencePromise)) return existing
  const db = getDatabase()
  const now = new Date().toISOString()
  const questions = foundation.requiredLongTermQuestions.length ? foundation.requiredLongTermQuestions : [{
    id: stableId('question', `${worldId}:${foundation.thematicQuestion}`), question: foundation.thematicQuestion,
    status: 'open' as const, answerEventIds: [],
  }]
  const { endingTruth: _endingTruth, finalChoice: _finalChoice, characterEndings: _characterEndings, keyTurns: _keyTurns, ...openFoundation } = foundation
  const raw = await chatJson([{ role: 'user', content: `你是通用长篇小说架构师。不要确定唯一终局。根据作品承诺、核心矛盾和主题问题，提出2至4个彼此真正不同、都能由人物选择逐步形成的远期可能走向。它们只是作者侧规划假设，不能增加资料外的具体世界事实。返回 JSON：{trajectories:[{title,premise,possibleResolution,thematicAnswer,characterConsequences:[],requiredObligationIds:[]}]}。\n作品根基：${JSON.stringify(openFoundation)}` }], { maxTokens: 4096, maxAttempts: 2 })
  const legacyTrajectory = foundation.endingTruth && foundation.finalChoice ? {
    title: '旧规划迁移方向', premise: foundation.endingTruth, possibleResolution: foundation.finalChoice,
    thematicAnswer: foundation.thematicQuestion, characterConsequences: foundation.characterEndings || [],
    requiredObligationIds: [], legacy: true,
  } : null
  const rawTrajectories = [
    ...(legacyTrajectory ? [legacyTrajectory] : []),
    ...records(raw.trajectories).slice(0, legacyTrajectory ? 3 : 4),
  ]
  if (rawTrajectories.length < 2 || rawTrajectories.length > 4) throw new Error('叙事地平线需要2至4个可行远期方向，模型输出未通过')
  const version = (existing?.version || 0) + 1
  const trajectories = rawTrajectories.map((item, index): FutureTrajectory => ({
    id: stableId('trajectory', `${worldId}:${version}:${index}:${text(item.title)}`), worldId, horizonVersion: version,
    title: text(item.title), premise: text(item.premise), possibleResolution: text(item.possibleResolution),
    requiredConditionIds: [], supportingEventIds: [], contradictingEventIds: [], requiredObligationIds: strings(item.requiredObligationIds),
    thematicAnswer: text(item.thematicAnswer), characterConsequences: strings(item.characterConsequences),
    viability: 'possible', confidence: item.legacy ? 0.75 : 0.5, createdAt: now, lastEvaluatedAt: now,
  }))
  if (trajectories.some((item) => !item.title || !item.premise || !item.possibleResolution)) throw new Error('远期方向缺少标题、前提或可能收束')
  const horizon: NarrativeHorizon = {
    id: stableId('horizon', `${worldId}:${version}`), worldId, version, phase: 'exploration',
    stablePromises: [foundation.corePromise, foundation.audiencePromise].filter(Boolean), currentPressures: [],
    openQuestions: questions as NarrativeQuestion[], activeObligationIds: [], trajectoryIds: trajectories.map((item) => item.id),
    ruledOutTrajectoryIds: [], lastEvaluatedChapter: 0, createdAt: now,
  }
  db.exec('BEGIN')
  try {
    db.prepare('INSERT INTO narrative_horizons (id,world_id,version,phase,horizon_json,created_at) VALUES (?,?,?,?,?,?)').run(horizon.id, worldId, version, horizon.phase, JSON.stringify(horizon), now)
    const insert = db.prepare('INSERT INTO future_trajectories (id,world_id,horizon_version,viability,confidence,trajectory_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    for (const trajectory of trajectories) insert.run(trajectory.id, worldId, version, trajectory.viability, trajectory.confidence, JSON.stringify(trajectory), now, now)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return horizon
}

function readSubjectValue(db: DatabaseSync, worldId: string, condition: StateCondition): unknown {
  if (condition.domain === 'claim' || condition.domain === 'relationship' || condition.domain === 'location') {
    const row = db.prepare("SELECT object_id,value_json FROM claims WHERE world_id=? AND subject_id=? AND predicate=? AND truth_status='asserted' AND valid_until IS NULL ORDER BY created_at DESC LIMIT 1").get(worldId, condition.subjectId, condition.predicate) as { object_id?: string; value_json?: string } | undefined
    return row?.object_id ?? parse(row?.value_json, undefined)
  }
  if (condition.domain === 'knowledge') return Boolean(db.prepare("SELECT 1 FROM knowledge_states WHERE world_id=? AND holder_id=? AND claim_id=? AND stance!='rejected' LIMIT 1").get(worldId, condition.subjectId, condition.predicate))
  if (condition.domain === 'actor') return (db.prepare(`SELECT ${condition.predicate === 'locked' ? 'locked' : 'lifecycle'} AS value FROM actor_runtime WHERE world_id=? AND actor_id=?`).get(worldId, condition.subjectId) as { value?: unknown } | undefined)?.value
  if (condition.domain === 'story_thread') return (db.prepare('SELECT status FROM story_threads WHERE world_id=? AND id=?').get(worldId, condition.subjectId) as { status?: string } | undefined)?.status
  if (condition.domain === 'obligation') return (db.prepare('SELECT status FROM narrative_obligations WHERE world_id=? AND id=?').get(worldId, condition.subjectId) as { status?: string } | undefined)?.status
  return undefined
}

export function conditionSatisfied(worldId: string, condition: StateCondition): boolean {
  const actual = readSubjectValue(getDatabase(), worldId, condition)
  const expected = condition.value
  switch (condition.operator) {
    case 'exists': return actual !== undefined && actual !== null
    case 'not_exists': return actual === undefined || actual === null
    case 'eq': return JSON.stringify(actual) === JSON.stringify(expected)
    case 'neq': return JSON.stringify(actual) !== JSON.stringify(expected)
    case 'gte': return Number(actual) >= Number(expected)
    case 'lte': return Number(actual) <= Number(expected)
    case 'contains': return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected))
  }
}

export function buildMainlineHealth(worldId: string, tick: number, outline?: ChapterOutline): MainlineHealthReport {
  const db = getDatabase()
  const horizon = getNarrativeHorizon(worldId)
  if (!horizon) throw new Error('叙事地平线尚未建立')
  const stateBefore = outline?.stateBefore || []
  const completed = stateBefore.filter((item) => conditionSatisfied(worldId, item)).map((item) => item.id)
  const missing = stateBefore.filter((item) => !conditionSatisfied(worldId, item)).map((item) => item.id)
  const overdue = (db.prepare("SELECT id FROM narrative_obligations WHERE world_id=? AND status!='resolved' AND due_arc_id IS NOT NULL AND due_arc_id IN (SELECT id FROM story_arcs WHERE world_id=? AND status='completed')").all(worldId, worldId) as Array<{ id: string }>).map((row) => row.id)
  const orphanThreads = (db.prepare("SELECT id FROM story_threads WHERE world_id=? AND status IN ('active','escalating') AND json_array_length(anchor_event_ids_json)=0").all(worldId) as Array<{ id: string }>).map((row) => row.id)
  const trajectories = listFutureTrajectories(worldId)
  const contradictions: string[] = []
  if (outline && !outline.relevance) contradictions.push('章节没有声明主线职责')
  if (outline?.relevance?.mode === 'prepare' && outline.relevance.payoffWindow.latestChapter < outline.ordinal) contradictions.push('准备型章节的兑现期限已过')
  const report: MainlineHealthReport = {
    id: stableId('health', `${worldId}:${tick}:${outline?.id || 'none'}:${JSON.stringify({ missing, overdue, contradictions })}`),
    worldId, tick, healthy: missing.length === 0 && overdue.length === 0 && contradictions.length === 0,
    arcProgress: { completedConditionIds: completed, missingConditionIds: missing, blockedConditionIds: missing },
    volumeProgress: { completedConditionIds: [], unresolvedConditionIds: [] },
    promiseHealth: horizon.stablePromises.map((_, index) => ({ promiseId: `promise-${index + 1}`, status: 'active', evidenceIds: [] })),
    trajectoryHealth: trajectories.map((item) => ({ trajectoryId: item.id, viability: item.viability, evidenceIds: [...item.supportingEventIds, ...item.contradictingEventIds] })),
    overdueObligationIds: overdue, orphanThreadIds: orphanThreads, contradictions, createdAt: new Date().toISOString(),
  }
  if (orphanThreads.length) report.healthy = false
  db.prepare('INSERT OR REPLACE INTO mainline_health_reports (id,world_id,tick,healthy,report_json,created_at) VALUES (?,?,?,?,?,?)').run(report.id, worldId, tick, Number(report.healthy), JSON.stringify(report), report.createdAt)
  return report
}

export function validateSceneChain(worldId: string, contract: EvolutionContract, beats: SceneBeat[]): string[] {
  const db = getDatabase()
  const issues: string[] = []
  const beatIds = new Set(beats.map((item) => item.id))
  const eventIds = new Set((db.prepare('SELECT id FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL').all(worldId) as Array<{ id: string }>).map((row) => row.id))
  const claimIds = new Set((db.prepare('SELECT id FROM claims WHERE world_id=?').all(worldId) as Array<{ id: string }>).map((row) => row.id))
  for (const [index, beat] of beats.entries()) {
    if (index > 0 && !(beat.dependsOnBeatIds || []).some((id) => beatIds.has(id) && beats.findIndex((item) => item.id === id) < index)) issues.push(`第${index + 1}个节拍没有依赖之前的节拍`)
    if (beat.claimIds.some((id) => !claimIds.has(id))) issues.push(`第${index + 1}个节拍引用了不存在的命题`)
  }
  if (contract.causalAnchorEventIds.some((id) => !eventIds.has(id))) issues.push('章节因果锚点不是已发布事件')
  const produced = new Set(beats.flatMap((item) => item.producesDeltaIds || []))
  for (const delta of contract.requiredDeltas || []) if (!produced.has(delta.id)) issues.push(`状态变化 ${delta.id} 没有对应场景节拍`)
  const hasInteraction = beats.some((beat) => beat.targetActorIds.length && beat.reaction && beat.changedOption)
  const hasExternalFeedback = beats.some((beat, index) => index > 0 && (beat.dependsOnBeatIds || []).length > 0 && beat.reaction && beat.changedOption)
  // A focused opening (or an escape/investigation scene) may have one POV
  // actor. In that case the environment, deadline or institution is the
  // opposing force; requiring another actor would reintroduce cast padding.
  if (contract.participants.length > 1 && !hasInteraction) issues.push('场景中没有“他人反应改变选项”')
  if (contract.participants.length === 1 && !hasExternalFeedback) issues.push('单角色场景没有外部反馈改变选项')
  return issues
}

export function createPendingTransition(worldId: string, base: WorldSlice, contract: EvolutionContract, beats: SceneBeat[], health: MainlineHealthReport): PendingTransition {
  const issues = validateSceneChain(worldId, contract, beats)
  if (!health.healthy) issues.push(...health.contradictions, ...health.overdueObligationIds.map((id) => `叙事义务逾期：${id}`))
  if (issues.length) throw new Error('待提交状态变化未通过：' + issues.join('；'))
  const now = new Date().toISOString()
  const transition: PendingTransition = {
    id: stableId('transition', `${worldId}:${contract.tick}:${contract.id}`), worldId, tick: contract.tick, contractId: contract.id,
    baseStateHash: createHash('sha256').update(JSON.stringify(base)).digest('hex'), beatIds: beats.map((item) => item.id),
    deltas: contract.requiredDeltas || [], mainlineHealthReportId: health.id, validationReport: { passed: true, issues: [] },
    status: 'validated', createdAt: now, updatedAt: now,
  }
  const db = getDatabase()
  db.prepare(`INSERT INTO pending_transitions (id,world_id,tick,contract_id,base_state_hash,mainline_health_report_id,transition_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(world_id,tick) DO UPDATE SET contract_id=excluded.contract_id,base_state_hash=excluded.base_state_hash,mainline_health_report_id=excluded.mainline_health_report_id,transition_json=excluded.transition_json,status=excluded.status,updated_at=excluded.updated_at`)
    .run(transition.id, worldId, transition.tick, transition.contractId, transition.baseStateHash, health.id, JSON.stringify(transition), transition.status, now, now)
  const insert = db.prepare(`INSERT INTO state_deltas (id,world_id,tick,contract_id,delta_json,status,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?)
    ON CONFLICT(id) DO UPDATE SET delta_json=excluded.delta_json,status='pending',updated_at=excluded.updated_at`)
  for (const delta of transition.deltas) insert.run(delta.id, worldId, transition.tick, contract.id, JSON.stringify(delta), now, now)
  return transition
}

function assertBeforeConditions(db: DatabaseSync, worldId: string, deltas: RequiredStateDelta[]) {
  for (const delta of deltas) for (const condition of delta.before) {
    const actual = readSubjectValue(db, worldId, condition)
    const ok = condition.operator === 'exists' ? actual != null
      : condition.operator === 'not_exists' ? actual == null
      : condition.operator === 'eq' ? JSON.stringify(actual) === JSON.stringify(condition.value)
      : condition.operator === 'neq' ? JSON.stringify(actual) !== JSON.stringify(condition.value)
      : condition.operator === 'gte' ? Number(actual) >= Number(condition.value)
      : condition.operator === 'lte' ? Number(actual) <= Number(condition.value)
      : Array.isArray(actual) ? actual.includes(condition.value) : String(actual ?? '').includes(String(condition.value))
    if (!ok) throw new Error(`状态变化 ${delta.id} 的前置条件 ${condition.id} 已不成立`)
  }
}

export function applyTransitionInTransaction(db: DatabaseSync, transition: PendingTransition, chapterId: string, eventId: string) {
  assertBeforeConditions(db, transition.worldId, transition.deltas)
  const now = new Date().toISOString()
  for (const delta of transition.deltas) {
    const after = delta.after
    if (delta.operation === 'assert_claim' || delta.operation === 'change_relationship' || delta.operation === 'change_location_state') {
      const claimId = text(after.claimId) || stableId('claim', delta.id)
      const predicate = text(after.predicate) || (delta.operation === 'change_relationship' ? 'relationship_state' : delta.operation === 'change_location_state' ? 'location_state' : 'state')
      db.prepare(`INSERT OR REPLACE INTO claims (id,world_id,subject_id,predicate,object_id,value_json,claim_scope,truth_status,valid_from,confidence,provenance_json,origin,created_at)
        VALUES (?,?,?,?,?,?,?,'asserted',?,1,?,'simulation',?)`).run(claimId, transition.worldId, delta.subjectId, predicate, text(after.objectId) || null, JSON.stringify(after.value ?? after), text(after.claimScope) || 'objective', String(transition.tick), JSON.stringify({ chapterId, eventId, deltaId: delta.id }), now)
    } else if (delta.operation === 'expire_claim') {
      db.prepare('UPDATE claims SET valid_until=? WHERE world_id=? AND id=?').run(String(transition.tick), transition.worldId, text(after.claimId) || delta.subjectId)
    } else if (delta.operation === 'grant_knowledge') {
      const claimId = text(after.claimId)
      if (!claimId || !db.prepare('SELECT 1 FROM claims WHERE world_id=? AND id=?').get(transition.worldId, claimId)) throw new Error(`认知变化 ${delta.id} 缺少有效命题`)
      db.prepare(`INSERT INTO knowledge_states (id,world_id,holder_type,holder_id,claim_id,stance,confidence,learned_at_tick,learned_from_event_id,secrecy,created_at)
        VALUES (?,?,?,?,?,'believed',?,?,?,?,?) ON CONFLICT(world_id,holder_type,holder_id,claim_id) DO UPDATE SET stance='believed',confidence=excluded.confidence,learned_at_tick=excluded.learned_at_tick,learned_from_event_id=excluded.learned_from_event_id`)
        .run(stableId('knowledge', `${delta.subjectId}:${claimId}`), transition.worldId, text(after.holderType) || 'actor', delta.subjectId, claimId, Number(after.confidence ?? 1), transition.tick, eventId, Number(after.secrecy ?? 0), now)
    } else if (delta.operation === 'change_actor_state') {
      const lifecycle = text(after.lifecycle)
      if (lifecycle) db.prepare('UPDATE actor_runtime SET lifecycle=?,updated_at=? WHERE world_id=? AND actor_id=?').run(lifecycle, now, transition.worldId, delta.subjectId)
    } else if (delta.operation === 'advance_story_thread') {
      db.prepare('UPDATE story_threads SET status=COALESCE(?,status),pressure=COALESCE(?,pressure),last_advanced_tick=?,updated_at=? WHERE world_id=? AND id=?').run(text(after.status) || null, after.pressure == null ? null : Number(after.pressure), transition.tick, now, transition.worldId, delta.subjectId)
    } else if (delta.operation === 'advance_obligation') {
      db.prepare('UPDATE narrative_obligations SET status=?,resolved_chapter_id=CASE WHEN ?=\'resolved\' THEN ? ELSE resolved_chapter_id END,updated_at=? WHERE world_id=? AND id=?').run(text(after.status) || 'planted', text(after.status) || 'planted', chapterId, now, transition.worldId, delta.subjectId)
    }
    db.prepare("UPDATE state_deltas SET status='published',updated_at=? WHERE id=?").run(now, delta.id)
  }
  transition.status = 'published'; transition.updatedAt = now
  db.prepare("UPDATE pending_transitions SET status='published',transition_json=?,updated_at=? WHERE id=?").run(JSON.stringify(transition), now, transition.id)
}

export function loadPendingTransition(worldId: string, tick: number): PendingTransition | null {
  const row = getDatabase().prepare("SELECT transition_json FROM pending_transitions WHERE world_id=? AND tick=? AND status!='discarded'").get(worldId, tick) as { transition_json: string } | undefined
  return row ? parse<PendingTransition>(row.transition_json, null as never) : null
}

export async function projectNarrativeAfterPublish(worldId: string, chapterNumber: number) {
  const db = getDatabase(); const now = new Date().toISOString(); const jobId = randomUUID()
  db.prepare(`INSERT INTO projection_jobs (id,world_id,kind,watermark_tick,status,attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(jobId, worldId, 'narrative_horizon', chapterNumber, 'running', 1, now, now)
  try {
    const horizon = syncNarrativeHorizonPointers(worldId)
    if (!horizon) throw new Error('叙事地平线不存在')
    horizon.lastEvaluatedChapter = Math.max(horizon.lastEvaluatedChapter, chapterNumber)
    const completedArcs = db.prepare("SELECT id,summary_json FROM story_arcs WHERE world_id=? AND status='completed'").all(worldId) as Array<{ id: string; summary_json?: string }>
    for (const arc of completedArcs) {
      const exists = db.prepare('SELECT 1 FROM arc_snapshots WHERE world_id=? AND arc_id=?').get(worldId, arc.id)
      if (!exists) {
        const snapshot = {
          summary: parse(arc.summary_json, {}),
          actors: db.prepare('SELECT actor_id,lifecycle,agency_score,last_active_tick FROM actor_runtime WHERE world_id=?').all(worldId),
          obligations: db.prepare('SELECT id,status,planted_chapter_id,resolved_chapter_id FROM narrative_obligations WHERE world_id=?').all(worldId),
        }
        db.prepare('INSERT INTO arc_snapshots (id,world_id,arc_id,ending_tick,snapshot_json,created_at) VALUES (?,?,?,?,?,?)').run(stableId('arc_snapshot', arc.id), worldId, arc.id, chapterNumber, JSON.stringify(snapshot), now)
      }
    }
    const volume = db.prepare("SELECT id FROM volumes WHERE world_id=? AND status='completed' AND id NOT IN (SELECT volume_id FROM trajectory_reviews WHERE world_id=?) ORDER BY ordinal LIMIT 1").get(worldId, worldId) as { id: string } | undefined
    if (volume) {
      const trajectories = listFutureTrajectories(worldId).filter((item) => item.viability !== 'ruled_out')
      const events = db.prepare('SELECT id,tick,summary FROM events WHERE world_id=? AND published_chapter_id IS NOT NULL ORDER BY tick').all(worldId) as Array<{ id: string; tick: number; summary: string }>
      const eventIds = new Set(events.map((item) => item.id))
      const raw = await chatJson([{ role: 'user', content: `你是卷级叙事审查者。根据已发布事件评估候选远期方向；方向只有与事实冲突时才能 ruled_out。不得为了整齐强行淘汰，不得把假设写成世界事实。可在人物选择自然产生新方向时提出新候选，但必须引用 supportingEventIds。长期问题只有在事件已提供答案证据时才能更新。返回 JSON：assessments[{trajectoryId,viability:possible|supported|endangered|ruled_out,confidence,supportingEventIds,contradictingEventIds,reason}],questionUpdates[{questionId,status:open|partially_answered|answered,answerEventIds}],proposedTrajectories[{title,premise,possibleResolution,thematicAnswer,characterConsequences,supportingEventIds}]。\n长期问题：${JSON.stringify(horizon.openQuestions)}\n候选：${JSON.stringify(trajectories)}\n事件：${JSON.stringify(events)}` }], { maxTokens: 6000, maxAttempts: 2 })
      for (const item of records(raw.assessments)) {
        const trajectory = trajectories.find((entry) => entry.id === text(item.trajectoryId)); if (!trajectory) continue
        const supporting = strings(item.supportingEventIds).filter((id) => eventIds.has(id)); const contradicting = strings(item.contradictingEventIds).filter((id) => eventIds.has(id))
        const requested = ['possible','supported','endangered','ruled_out'].includes(text(item.viability)) ? text(item.viability) as FutureTrajectory['viability'] : trajectory.viability
        trajectory.viability = requested === 'ruled_out' && !contradicting.length ? 'endangered' : requested
        trajectory.supportingEventIds = [...new Set([...trajectory.supportingEventIds, ...supporting])]
        trajectory.contradictingEventIds = [...new Set([...trajectory.contradictingEventIds, ...contradicting])]
        trajectory.confidence = Math.max(0, Math.min(1, Number(item.confidence ?? trajectory.confidence)))
        trajectory.lastEvaluatedAt = now
        db.prepare('UPDATE future_trajectories SET viability=?,confidence=?,trajectory_json=?,updated_at=? WHERE id=?').run(trajectory.viability, trajectory.confidence, JSON.stringify(trajectory), now, trajectory.id)
      }
      for (const item of records(raw.questionUpdates)) {
        const question = horizon.openQuestions.find((entry) => entry.id === text(item.questionId)); if (!question) continue
        const evidence = strings(item.answerEventIds).filter((id) => eventIds.has(id)); if (!evidence.length) continue
        const status = text(item.status)
        question.status = status === 'answered' ? 'answered' : status === 'partially_answered' ? 'partially_answered' : 'open'
        question.answerEventIds = [...new Set([...question.answerEventIds, ...evidence])]
      }
      let viable = listFutureTrajectories(worldId).filter((item) => item.viability !== 'ruled_out')
      if (!viable.length) {
        const proposed = records(raw.proposedTrajectories).filter((item) => strings(item.supportingEventIds).some((id) => eventIds.has(id))).slice(0, 4)
        if (proposed.length < 2) throw new Error('所有候选方向失效，但卷级审查没有提出至少两个有事实依据的新方向')
        for (const [index, item] of proposed.entries()) {
          const trajectory: FutureTrajectory = { id: stableId('trajectory', `${worldId}:${horizon.version}:${chapterNumber}:${index}:${text(item.title)}`), worldId, horizonVersion: horizon.version, title: text(item.title), premise: text(item.premise), possibleResolution: text(item.possibleResolution), requiredConditionIds: [], supportingEventIds: strings(item.supportingEventIds).filter((id) => eventIds.has(id)), contradictingEventIds: [], requiredObligationIds: [], thematicAnswer: text(item.thematicAnswer), characterConsequences: strings(item.characterConsequences), viability: 'possible', confidence: .5, createdAt: now, lastEvaluatedAt: now }
          db.prepare('INSERT INTO future_trajectories (id,world_id,horizon_version,viability,confidence,trajectory_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(trajectory.id, worldId, horizon.version, trajectory.viability, trajectory.confidence, JSON.stringify(trajectory), now, now)
        }
        viable = listFutureTrajectories(worldId).filter((item) => item.viability !== 'ruled_out')
      }
      horizon.phase = viable.length <= 2 ? 'convergence' : 'development'
      db.prepare('INSERT INTO trajectory_reviews (id,world_id,volume_id,review_json,created_at) VALUES (?,?,?,?,?)').run(stableId('trajectory_review', volume.id), worldId, volume.id, JSON.stringify(raw), now)
    }
    horizon.trajectoryIds = listFutureTrajectories(worldId).filter((item) => item.viability !== 'ruled_out').map((item) => item.id)
    horizon.ruledOutTrajectoryIds = listFutureTrajectories(worldId).filter((item) => item.viability === 'ruled_out').map((item) => item.id)
    db.prepare('UPDATE narrative_horizons SET phase=?,horizon_json=? WHERE id=?').run(horizon.phase, JSON.stringify(horizon), horizon.id)
    db.prepare("UPDATE projection_jobs SET status='completed',updated_at=? WHERE id=?").run(new Date().toISOString(), jobId)
    if (getClosureReadiness(worldId).ready) await ensureFinaleContract(worldId)
  } catch (error) {
    db.prepare("UPDATE projection_jobs SET status='failed',error=?,updated_at=? WHERE id=?").run(error instanceof Error ? error.message : String(error), new Date().toISOString(), jobId)
    throw error
  }
}

export function createWorkflowRun(input: { worldId: string; tick: number; foundationVersion: number; horizonVersion: number; inputHash: string }) {
  const db = getDatabase(); const now = new Date().toISOString(); const id = stableId('workflow', `${input.worldId}:${input.tick}:${input.foundationVersion}:${input.horizonVersion}`)
  db.prepare(`INSERT INTO workflow_runs (id,world_id,tick,foundation_version,horizon_version,outline_version,status,current_step,input_hash,created_at,updated_at)
    VALUES (?,?,?,?,?,1,'running','load_context',?,?,?) ON CONFLICT(world_id,tick) DO UPDATE SET status=CASE WHEN workflow_runs.status='completed' THEN 'completed' ELSE 'running' END,updated_at=excluded.updated_at`)
    .run(id, input.worldId, input.tick, input.foundationVersion, input.horizonVersion, input.inputHash, now, now)
  return id
}

export function completeWorkflowStep(runId: string, step: string, inputHash: string, output: unknown) {
  const db = getDatabase(); const now = new Date().toISOString(); const id = stableId('step', `${runId}:${step}:${inputHash}`)
  db.prepare(`INSERT INTO workflow_steps (id,run_id,step,input_hash,status,output_json,created_at,updated_at) VALUES (?,?,?,?, 'completed',?,?,?)
    ON CONFLICT(run_id,step,input_hash) DO UPDATE SET status='completed',output_json=excluded.output_json,error=NULL,updated_at=excluded.updated_at`).run(id, runId, step, inputHash, JSON.stringify(output), now, now)
  db.prepare('UPDATE workflow_runs SET current_step=?,updated_at=? WHERE id=?').run(step, now, runId)
}

export function markWorkflow(runId: string, status: 'running' | 'blocked' | 'completed' | 'failed', step: string, error?: string) {
  getDatabase().prepare('UPDATE workflow_runs SET status=?,current_step=?,error=?,updated_at=? WHERE id=?').run(status, step, error || null, new Date().toISOString(), runId)
}
