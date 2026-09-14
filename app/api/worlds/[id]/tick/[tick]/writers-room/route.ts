import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  try {
    const db = getDatabase()
    const session = db.prepare('SELECT * FROM writers_room_sessions WHERE world_id=? AND tick=? ORDER BY updated_at DESC LIMIT 1').get(params.id, tick) as Record<string, unknown> | undefined
    if (!session) return NextResponse.json({ session: null, proposals: [], opinions: [], resolutions: [], gateReview: null })
    const proposals = db.prepare('SELECT id,premise,proposal_json,status,created_at FROM scene_proposals WHERE session_id=? ORDER BY created_at,id').all(String(session.id)) as Array<Record<string, unknown>>
    const opinions = db.prepare('SELECT id,round,role,actor_id,proposal_id,opinion_json,created_at FROM writers_room_opinions WHERE session_id=? ORDER BY round,role,actor_id,proposal_id').all(String(session.id)) as Array<Record<string, unknown>>
    const resolutions = db.prepare('SELECT id,round,resolution_json,passed,created_at FROM writers_room_resolutions WHERE session_id=? ORDER BY round').all(String(session.id)) as Array<Record<string, unknown>>
    const gateReview = db.prepare('SELECT passed,review_json,created_at FROM narrative_gate_reviews WHERE world_id=? AND tick=?').get(params.id, tick) as Record<string, unknown> | undefined
    return NextResponse.json({
      session,
      proposals: proposals.map((row) => ({ ...row, proposal: JSON.parse(String(row.proposal_json)) })),
      opinions: opinions.map((row) => ({ ...row, opinion: JSON.parse(String(row.opinion_json)) })),
      resolutions: resolutions.map((row) => ({ ...row, resolution: JSON.parse(String(row.resolution_json)) })),
      gateReview: gateReview ? { ...gateReview, review: JSON.parse(String(gateReview.review_json)) } : null,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
