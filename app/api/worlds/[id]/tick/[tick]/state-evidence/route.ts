import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  const rows = getDatabase().prepare(`SELECT e.delta_id,e.quote,e.evidence_json,e.passed,e.created_at,e.chapter_id,e.run_id
    FROM chapter_state_evidence e
    JOIN chapter_runs r ON r.id=e.run_id
    WHERE e.world_id=? AND r.tick=? ORDER BY e.created_at,e.delta_id`).all(params.id, tick) as Array<Record<string, unknown>>
  return NextResponse.json({
    evidence: rows.map((row) => ({
      deltaId: row.delta_id, quote: row.quote, passed: Boolean(row.passed), chapterId: row.chapter_id,
      runId: row.run_id, createdAt: row.created_at, detail: JSON.parse(String(row.evidence_json || '{}')),
    })),
  })
}
