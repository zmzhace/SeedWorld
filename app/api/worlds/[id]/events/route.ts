import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url)
  const args: Array<string | number> = [params.id]
  const where = ['world_id=?']
  if (url.searchParams.get('sceneId')) { where.push("json_extract(payload_json, '$.sceneId')=?"); args.push(url.searchParams.get('sceneId')!) }
  const from = Number(url.searchParams.get('tickFrom') || 0)
  const to = Number(url.searchParams.get('tickTo') || Number.MAX_SAFE_INTEGER)
  where.push('tick BETWEEN ? AND ?'); args.push(from, to)
  const rows = getDatabase().prepare(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY tick DESC, created_at DESC LIMIT 200`).all(...args) as Record<string, unknown>[]
  return NextResponse.json({ events: rows.map((row) => ({ ...row, payload: JSON.parse(String(row.payload_json || '{}')), actorIds: JSON.parse(String(row.actor_ids_json || '[]')) })) })
}
