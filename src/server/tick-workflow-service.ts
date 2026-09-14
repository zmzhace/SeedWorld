import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { getDatabase } from './database'
import { getWorld } from './novel-repository'
import { hydrateVisibleKnowledge } from './knowledge-context'
import { ensurePrimaryScene, syncActorRuntime } from './dynamic-workflow'
import { createEvolutionContract, ensureRollingOutline, getLatestFoundation, scopeWorldForContract } from './narrative-planning-service'
import { generateAgentIntents, loadAgentIntents, loadSceneBeats, resolveSceneBeats, saveAgentIntents } from './scene-resolution-service'
import { startChapterRun } from './chapter-service'
import { getStoryEngine } from './story-engine-service'
import {
  buildMainlineHealth, completeWorkflowStep, createPendingTransition, createWorkflowRun,
  ensureNarrativeHorizon, getNarrativeHorizon, loadPendingTransition, markWorkflow,
} from './narrative-control-service'

const activeRuns = new Set<string>()
const leaseOwner = `seedworld-${process.pid}-${randomUUID()}`
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export type TickWorkflowStatus = {
  tick: number
  status: string
  stage: string
  blockReason?: string
  workflowRunId?: string
  chapterRunId?: string
  pendingTransitionId?: string
  discussionRound?: number
  proposalCount?: number
  opinionCount?: number
  unresolvedIssueCount?: number
  chapter?: { status: string; stage: string; progress: number; message: string; error?: string }
}

export function getTickWorkflowStatus(worldId: string, tick: number): TickWorkflowStatus | null {
  const db = getDatabase()
  const row = db.prepare(`SELECT t.tick,t.status,t.block_reason,w.id AS workflow_run_id,w.current_step,w.error,
    c.id AS chapter_run_id,c.status AS chapter_status,c.stage AS chapter_stage,c.progress AS chapter_progress,c.message AS chapter_message,c.error AS chapter_error,
    p.id AS pending_transition_id
    FROM simulation_ticks t
    LEFT JOIN workflow_runs w ON w.world_id=t.world_id AND w.tick=t.tick
    LEFT JOIN chapter_runs c ON c.world_id=t.world_id AND c.tick=t.tick
    LEFT JOIN pending_transitions p ON p.world_id=t.world_id AND p.tick=t.tick
    WHERE t.world_id=? AND t.tick=? ORDER BY c.created_at DESC LIMIT 1`).get(worldId, tick) as Record<string, unknown> | undefined
  if (!row) return null
  const room = db.prepare('SELECT id,round FROM writers_room_sessions WHERE world_id=? AND tick=? ORDER BY updated_at DESC LIMIT 1').get(worldId, tick) as { id: string; round: number } | undefined
  const proposalCount = room ? Number((db.prepare('SELECT COUNT(*) AS value FROM scene_proposals WHERE session_id=?').get(room.id) as { value: number }).value) : 0
  const opinions = room ? db.prepare('SELECT opinion_json FROM writers_room_opinions WHERE session_id=?').all(room.id) as Array<{ opinion_json: string }> : []
  const unresolvedIssueCount = opinions.reduce((count, item) => {
    try { return count + (JSON.parse(item.opinion_json).issues || []).filter((issue: { severity?: string }) => issue.severity === 'critical' || issue.severity === 'error').length } catch { return count }
  }, 0)
  return {
    tick: Number(row.tick), status: String(row.status), stage: String(row.current_step || row.status),
    blockReason: row.block_reason || row.error ? String(row.block_reason || row.error) : undefined,
    workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : undefined,
    chapterRunId: row.chapter_run_id ? String(row.chapter_run_id) : undefined,
    pendingTransitionId: row.pending_transition_id ? String(row.pending_transition_id) : undefined,
    discussionRound: room?.round, proposalCount, opinionCount: opinions.length, unresolvedIssueCount,
    chapter: row.chapter_run_id ? {
      status: String(row.chapter_status), stage: String(row.chapter_stage), progress: Number(row.chapter_progress || 0),
      message: String(row.chapter_message || ''), error: row.chapter_error ? String(row.chapter_error) : undefined,
    } : undefined,
  }
}

export function getLatestTickWorkflowStatus(worldId: string): TickWorkflowStatus | null {
  const row = getDatabase().prepare('SELECT tick FROM simulation_ticks WHERE world_id=? ORDER BY tick DESC LIMIT 1').get(worldId) as { tick: number } | undefined
  return row ? getTickWorkflowStatus(worldId, row.tick) : null
}

async function executeTick(worldId: string, nextTick: number, workflowRunId: string) {
  if (activeRuns.has(workflowRunId)) return
  const db = getDatabase()
  const now = new Date()
  const lease = db.prepare(`UPDATE workflow_runs SET lease_owner=?,lease_expires_at=?,updated_at=?
    WHERE id=? AND status='running' AND (lease_owner IS NULL OR lease_owner=? OR lease_expires_at<?)`).run(
    leaseOwner, new Date(now.getTime() + 30 * 60_000).toISOString(), now.toISOString(), workflowRunId, leaseOwner, now.toISOString(),
  )
  if (!lease.changes) return
  activeRuns.add(workflowRunId)
  try {
    const persisted = getWorld(worldId)
    if (!persisted) throw new Error('世界不存在')
    const foundation = getLatestFoundation(worldId)
    if (!foundation || foundation.status !== 'confirmed') throw new Error('请先确认作品根基，再开始正式推演')
    const engine = getStoryEngine(worldId)
    if (!engine || engine.status !== 'confirmed' || engine.foundationVersion !== foundation.version) {
      throw new Error('请先确认当前作品的故事发动机，再开始正式推演')
    }
    const horizon = await ensureNarrativeHorizon(worldId, foundation)
    await ensureRollingOutline(worldId)
    completeWorkflowStep(workflowRunId, 'plan_narrative_horizon', hash({ foundation: foundation.version, horizon: horizon.version }), { foundationVersion: foundation.version, horizonVersion: horizon.version })
    const base = hydrateVisibleKnowledge(worldId, persisted.snapshot as any)
    if (!base) throw new Error('世界快照不存在')
    const scene = ensurePrimaryScene(worldId, base)
    syncActorRuntime(worldId, base, scene.id)
    completeWorkflowStep(workflowRunId, 'load_context', hash({ tick: base.tick, scene: scene.id }), { sceneId: scene.id })

    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        db.prepare("UPDATE simulation_ticks SET status='simulating',replan_count=?,block_reason=NULL WHERE world_id=? AND tick=?").run(attempt, worldId, nextTick)
        const contract = await createEvolutionContract(worldId, base, attempt > 0)
        completeWorkflowStep(workflowRunId, 'create_evolution_contract', hash(contract), contract)
        const outlineRow = db.prepare('SELECT outline_json FROM chapter_outlines WHERE id=?').get(contract.chapterOutlineId || '') as { outline_json: string } | undefined
        const outline = outlineRow ? JSON.parse(outlineRow.outline_json) : undefined
        const health = buildMainlineHealth(worldId, nextTick, outline)
        if (!health.healthy) throw new Error('主线健康检查未通过：' + [...health.arcProgress.missingConditionIds, ...health.overdueObligationIds, ...health.contradictions].join('；'))
        completeWorkflowStep(workflowRunId, 'check_mainline_health', hash(health), health)

        const scoped = scopeWorldForContract(base, contract)
        let intents = loadAgentIntents(worldId, nextTick).filter((intent) => intent.id.includes(contract.id) && contract.participants.some((participant) => participant.actorId === intent.actorId))
        if (intents.length !== contract.participants.length) {
          intents = await generateAgentIntents(worldId, nextTick, scoped, contract)
          saveAgentIntents(intents)
        }
        completeWorkflowStep(workflowRunId, 'generate_character_intents', hash(intents), intents)

        let beats = loadSceneBeats(worldId, nextTick).filter((beat) => beat.id.includes(contract.id))
        const gate = db.prepare('SELECT passed FROM narrative_gate_reviews WHERE world_id=? AND tick=?').get(worldId, nextTick) as { passed: number } | undefined
        if (!beats.length || !gate?.passed) beats = await resolveSceneBeats(worldId, scoped, contract, intents)
        completeWorkflowStep(workflowRunId, 'script_resolution', hash(beats), beats)
        const transition = loadPendingTransition(worldId, nextTick) || createPendingTransition(worldId, base, contract, beats, health)
        completeWorkflowStep(workflowRunId, 'build_pending_transition', hash(transition), transition)

        const pendingSnapshot = { ...base, tick: nextTick }
        db.prepare("UPDATE simulation_ticks SET status='awaiting_chapter',payload_json=?,block_reason=NULL WHERE world_id=? AND tick=?").run(JSON.stringify(pendingSnapshot), worldId, nextTick)
        const chapterRun = startChapterRun({
          worldId, tickFrom: nextTick, tickTo: nextTick, tick: nextTick, contractId: contract.id,
          povEntityId: contract.povEntityId, goal: contract.coreEvent, requiredEvents: contract.requiredBeats, eventIds: [],
        })
        completeWorkflowStep(workflowRunId, 'draft_chapter', hash({ chapterRunId: chapterRun.id }), { chapterRunId: chapterRun.id })
        return
      } catch (error) {
        lastError = error
        db.prepare('UPDATE simulation_ticks SET replan_count=?,block_reason=? WHERE world_id=? AND tick=?').run(attempt + 1, (error as Error).message, worldId, nextTick)
        db.prepare("UPDATE evolution_contracts SET status='blocked' WHERE world_id=? AND tick=? AND status='active'").run(worldId, nextTick)
      }
    }
    throw lastError || new Error('无法形成可发布的章节路径')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    db.prepare("UPDATE simulation_ticks SET status='blocked',block_reason=?,payload_json=? WHERE world_id=? AND tick=?").run(reason, JSON.stringify({ error: reason }), worldId, nextTick)
    markWorkflow(workflowRunId, 'blocked', 'blocked', reason)
  } finally {
    db.prepare('UPDATE workflow_runs SET lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_owner=?').run(new Date().toISOString(), workflowRunId, leaseOwner)
    activeRuns.delete(workflowRunId)
  }
}

export async function startTickWorkflow(worldId: string): Promise<TickWorkflowStatus> {
  const db = getDatabase()
  const persisted = getWorld(worldId)
  if (!persisted) throw new Error('世界不存在')
  if (!persisted.visibilityConfirmed) throw new Error('正式推演前必须确认角色知识边界')
  const foundation = getLatestFoundation(worldId)
  if (!foundation || foundation.status !== 'confirmed') throw new Error('请先确认作品根基，再开始正式推演')
  const unfinished = db.prepare("SELECT tick FROM simulation_ticks WHERE world_id=? AND status IN ('planning','simulating','awaiting_chapter','reviewing') ORDER BY tick DESC LIMIT 1").get(worldId) as { tick: number } | undefined
  if (unfinished) {
    const current = getTickWorkflowStatus(worldId, unfinished.tick)!
    if (current.workflowRunId && ['planning', 'simulating'].includes(current.status)) void executeTick(worldId, unfinished.tick, current.workflowRunId)
    return current
  }
  const blocked = db.prepare("SELECT tick FROM simulation_ticks WHERE world_id=? AND status='blocked' ORDER BY tick DESC LIMIT 1").get(worldId) as { tick: number } | undefined
  if (blocked) throw new Error(`第 ${blocked.tick} 轮仍被阻塞，请先重试、重规划或废弃该轮`)
  const base = persisted.snapshot as any
  const nextTick = Number(base?.tick || 0) + 1
  const now = new Date().toISOString()
  db.prepare('INSERT INTO simulation_ticks (id,world_id,tick,status,payload_json,created_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), worldId, nextTick, 'planning', JSON.stringify(base), now)
  const currentHorizon = getNarrativeHorizon(worldId)
  const workflowRunId = createWorkflowRun({ worldId, tick: nextTick, foundationVersion: foundation.version, horizonVersion: currentHorizon?.version || 0, inputHash: hash({ worldId, nextTick, foundation: foundation.version, horizon: currentHorizon?.version || 0 }) })
  void executeTick(worldId, nextTick, workflowRunId)
  return getTickWorkflowStatus(worldId, nextTick)!
}

export function resumeTickWorkflow(worldId: string, tick: number) {
  const status = getTickWorkflowStatus(worldId, tick)
  if (status?.workflowRunId && ['planning', 'simulating'].includes(status.status)) void executeTick(worldId, tick, status.workflowRunId)
  return status
}

function clearUnpublishedArtifacts(worldId: string, tick: number) {
  const db = getDatabase()
  const contractRows = db.prepare('SELECT id,chapter_outline_id,scene_id FROM evolution_contracts WHERE world_id=? AND tick=?').all(worldId, tick) as Array<{ id: string; chapter_outline_id?: string; scene_id?: string }>
  db.prepare("UPDATE pending_transitions SET status='discarded',transition_json=json_set(transition_json,'$.status','discarded'),updated_at=? WHERE world_id=? AND tick=? AND status!='published'").run(new Date().toISOString(), worldId, tick)
  db.prepare("UPDATE state_deltas SET status='discarded',updated_at=? WHERE world_id=? AND tick=? AND status!='published'").run(new Date().toISOString(), worldId, tick)
  db.prepare("UPDATE evolution_contracts SET status='blocked' WHERE world_id=? AND tick=? AND status!='fulfilled'").run(worldId, tick)
  for (const contract of contractRows) if (contract.chapter_outline_id) {
    db.prepare("UPDATE chapter_outlines SET status='planned',outline_json=json_set(outline_json,'$.status','planned') WHERE id=? AND status!='completed'").run(contract.chapter_outline_id)
  }
  for (const contract of contractRows) if (contract.scene_id) db.prepare("UPDATE scenes SET status='abandoned',updated_at=? WHERE id=? AND status='proposed'").run(new Date().toISOString(), contract.scene_id)
  db.prepare('DELETE FROM scene_beats WHERE world_id=? AND tick=?').run(worldId, tick)
  db.prepare('DELETE FROM narrative_gate_reviews WHERE world_id=? AND tick=?').run(worldId, tick)
  db.prepare('DELETE FROM agent_intents WHERE world_id=? AND tick=?').run(worldId, tick)
  db.prepare('DELETE FROM writers_room_sessions WHERE world_id=? AND tick=?').run(worldId, tick)
  db.prepare("DELETE FROM pending_transitions WHERE world_id=? AND tick=? AND status='discarded'").run(worldId, tick)
  db.prepare("DELETE FROM state_deltas WHERE world_id=? AND tick=? AND status='discarded'").run(worldId, tick)
}

export function replanTickWorkflow(worldId: string, tick: number): TickWorkflowStatus {
  const db = getDatabase()
  const row = db.prepare('SELECT status,payload_json FROM simulation_ticks WHERE world_id=? AND tick=?').get(worldId, tick) as { status: string; payload_json: string } | undefined
  if (!row) throw new Error('Tick 不存在')
  if (row.status !== 'blocked') throw new Error('只有被阻塞且尚未发布的 Tick 可以重规划')
  db.exec('BEGIN')
  try {
    clearUnpublishedArtifacts(worldId, tick)
    db.prepare("UPDATE simulation_ticks SET status='planning',replan_count=replan_count+1,block_reason=NULL WHERE world_id=? AND tick=?").run(worldId, tick)
    const workflow = db.prepare('SELECT id FROM workflow_runs WHERE world_id=? AND tick=?').get(worldId, tick) as { id: string } | undefined
    if (!workflow) throw new Error('Tick 缺少可恢复工作流')
    db.prepare("UPDATE workflow_runs SET status='running',current_step='load_context',error=NULL,attempt=attempt+1,updated_at=? WHERE id=?").run(new Date().toISOString(), workflow.id)
    db.exec('COMMIT')
    void executeTick(worldId, tick, workflow.id)
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getTickWorkflowStatus(worldId, tick)!
}

export function discardTickWorkflow(worldId: string, tick: number) {
  const db = getDatabase()
  const row = db.prepare('SELECT status,block_reason FROM simulation_ticks WHERE world_id=? AND tick=?').get(worldId, tick) as { status: string; block_reason?: string } | undefined
  if (!row) throw new Error('Tick 不存在')
  if (row.status === 'published') throw new Error('已发布 Tick 不能废弃')
  if (['planning', 'simulating', 'reviewing', 'awaiting_chapter'].includes(row.status)) throw new Error('运行中的 Tick 不能废弃，请等待其完成或失败')
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT OR IGNORE INTO workflow_checkpoints (id,world_id,run_kind,run_id,step,input_hash,payload_json,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(randomUUID(), worldId, 'tick', `discarded-${worldId}-${tick}`, 'discarded', hash(row), JSON.stringify(row), new Date().toISOString())
    clearUnpublishedArtifacts(worldId, tick)
    db.prepare('DELETE FROM workflow_runs WHERE world_id=? AND tick=?').run(worldId, tick)
    db.prepare('DELETE FROM simulation_ticks WHERE world_id=? AND tick=?').run(worldId, tick)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return { discarded: true, tick }
}
