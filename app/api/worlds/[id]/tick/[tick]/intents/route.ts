import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  const rows = getDatabase().prepare('SELECT id,actor_id,intent_json,status,created_at FROM agent_intents WHERE world_id=? AND tick=? ORDER BY created_at,actor_id').all(params.id, tick) as Array<Record<string, unknown>>
  return NextResponse.json({ intents: rows.map((row) => ({ ...row, intent: JSON.parse(String(row.intent_json)) })) })
}
