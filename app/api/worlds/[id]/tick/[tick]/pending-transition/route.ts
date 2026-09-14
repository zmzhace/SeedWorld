import { NextResponse } from 'next/server'
import { loadPendingTransition } from '@/server/narrative-control-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  return NextResponse.json({ transition: loadPendingTransition(params.id, tick) })
}
