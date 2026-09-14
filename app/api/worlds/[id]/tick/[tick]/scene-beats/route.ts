import { NextResponse } from 'next/server'
import { loadSceneBeats } from '@/server/scene-resolution-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  return NextResponse.json({ beats: loadSceneBeats(params.id, tick) })
}
