import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { recordTransmission } from '@/server/transmission-service'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url); const from = Number(url.searchParams.get('from') || 0); const to = Number(url.searchParams.get('to') || Number.MAX_SAFE_INTEGER)
  return NextResponse.json(getDatabase().prepare('SELECT * FROM transmissions WHERE world_id=? AND tick BETWEEN ? AND ? ORDER BY tick,id LIMIT 500').all(params.id, from, to))
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try { const body = await request.json(); return NextResponse.json(recordTransmission({ ...body, worldId: params.id })) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
