import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { startChapterRun } from '@/server/chapter-service'
import { loadPendingTransition } from '@/server/narrative-control-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string; tick: string } }) {
  try {
    const tick = Number(params.tick)
    if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
    const db = getDatabase()
    const state = db.prepare('SELECT status FROM simulation_ticks WHERE world_id=? AND tick=?').get(params.id, tick) as { status: string } | undefined
    if (!state) return NextResponse.json({ error: 'Tick 不存在' }, { status: 404 })
    if (state.status !== 'blocked') return NextResponse.json({ error: '只有 blocked Tick 可以重试章节' }, { status: 409 })
    const contractRow = db.prepare('SELECT id,contract_json FROM evolution_contracts WHERE world_id=? AND tick=? ORDER BY created_at DESC LIMIT 1').get(params.id, tick) as { id: string; contract_json: string } | undefined
    if (!contractRow) return NextResponse.json({ error: '该 Tick 没有演化契约，应重新推演而不是重试章节' }, { status: 409 })
    const contract = JSON.parse(contractRow.contract_json) as { povEntityId?: string; coreEvent?: string; requiredBeats?: string[] }
    const transition = loadPendingTransition(params.id, tick)
    if (!transition || transition.status === 'discarded') return NextResponse.json({ error: '该 Tick 没有通过叙事闸门的待提交状态变化，应重新规划' }, { status: 409 })
    db.prepare("UPDATE simulation_ticks SET status='awaiting_chapter',block_reason=NULL WHERE world_id=? AND tick=?").run(params.id, tick)
    db.prepare("UPDATE workflow_runs SET status='running',current_step='draft_chapter',error=NULL,updated_at=? WHERE world_id=? AND tick=?").run(new Date().toISOString(), params.id, tick)
    db.prepare("UPDATE evolution_contracts SET status='active' WHERE id=?").run(contractRow.id)
    const previousRun = db.prepare("SELECT draft_path FROM chapter_runs WHERE world_id=? AND tick=? AND status='failed' AND draft_path IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(params.id, tick) as { draft_path?: string } | undefined
    const run = startChapterRun({ worldId: params.id, tickFrom: tick, tickTo: tick, tick, contractId: contractRow.id, povEntityId: contract.povEntityId, goal: contract.coreEvent, requiredEvents: contract.requiredBeats, eventIds: [], resumeDraftPath: previousRun?.draft_path })
    return NextResponse.json({ run }, { status: 202 })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
