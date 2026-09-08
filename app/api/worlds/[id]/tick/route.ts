import { NextResponse } from 'next/server'
import { runWorldTick } from '@/engine/orchestrator'
import { getDirectorRegistry } from '@/server/director-registry'
import { getWorld, updateWorld } from '@/server/novel-repository'
import { getDatabase } from '@/server/database'
import { randomUUID } from 'node:crypto'
import { hydrateVisibleKnowledge } from '@/server/knowledge-context'
import { flushOutbox } from '@/server/outbox-service'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { world } = body

    if (!world) {
      return NextResponse.json(
        { error: 'world is required' },
        { status: 400 }
      )
    }

    const persisted = getWorld(params.id)
    if (persisted && (persisted.graphSyncStatus !== 'ready' || !persisted.visibilityConfirmed)) {
      return NextResponse.json({ error: '正式推演前必须完成图谱同步并确认信息可见性' }, { status: 409 })
    }

    const worldWithKnowledge = persisted ? hydrateVisibleKnowledge(params.id, world) : world
    const nextWorld = await runWorldTick(worldWithKnowledge, {
      directorRegistry: getDirectorRegistry(),
    })

    const db = getDatabase(); const now = new Date().toISOString()
    db.exec('BEGIN')
    try {
      db.prepare(`INSERT INTO simulation_ticks (id,world_id,tick,status,payload_json,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(world_id,tick) DO UPDATE SET status=excluded.status,payload_json=excluded.payload_json`).run(randomUUID(), params.id, nextWorld.tick, 'committed', JSON.stringify(nextWorld), now)
      db.prepare(`INSERT INTO outbox (id,world_id,operation,payload_json,status,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(randomUUID(), params.id, 'append_evolution_tick', JSON.stringify({ tick: nextWorld.tick, events: nextWorld.events.slice(-20) }), 'pending', now, now, now)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    if (persisted) updateWorld(params.id, { snapshot: nextWorld })
    if (persisted) void flushOutbox(params.id)

    return NextResponse.json({ world: nextWorld })
  } catch (error) {
    console.error('Failed to run world tick:', error)
    return NextResponse.json(
      { error: 'Failed to run world tick: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
