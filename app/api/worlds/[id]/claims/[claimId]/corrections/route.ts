import { NextResponse } from 'next/server'
import { correctClaim } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: { id: string; claimId: string } }) {
  try { const changed = correctClaim(params.id, params.claimId, await request.json()); return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: '命题不存在' }, { status: 404 }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
