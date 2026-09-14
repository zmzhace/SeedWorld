import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: { id: string; actorId: string } }) {
  const tick = Number(new URL(request.url).searchParams.get('tick') || Number.MAX_SAFE_INTEGER)
  const rows = getDatabase().prepare(`SELECT k.*,c.subject_id,c.predicate,c.object_id,c.value_json,c.claim_scope,c.confidence AS claim_confidence FROM knowledge_states k JOIN claims c ON c.id=k.claim_id WHERE k.world_id=? AND ((k.holder_type='public') OR (k.holder_type='actor' AND k.holder_id=?)) AND k.learned_at_tick<=? ORDER BY k.learned_at_tick,k.created_at`).all(params.id, params.actorId, tick) as Record<string, unknown>[]
  return NextResponse.json(rows.map(row => ({ ...row, value: row.value_json ? JSON.parse(String(row.value_json)) : null })))
}
