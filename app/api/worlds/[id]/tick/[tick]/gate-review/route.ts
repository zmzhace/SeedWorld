import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  const row = getDatabase().prepare('SELECT passed,review_json,created_at FROM narrative_gate_reviews WHERE world_id=? AND tick=?').get(params.id, tick) as Record<string, unknown> | undefined
  return NextResponse.json({ review: row ? { ...row, review: JSON.parse(String(row.review_json)) } : null })
}
