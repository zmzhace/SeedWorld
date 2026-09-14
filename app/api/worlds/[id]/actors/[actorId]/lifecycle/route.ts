import { NextResponse } from 'next/server'
import { listActorRuntime, upsertActorRuntime } from '@/server/novel-repository'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: { id: string; actorId: string } }) {
  const current = listActorRuntime(params.id).find((actor) => actor.actorId === params.actorId)
  if (!current) return NextResponse.json({ error: '人物运行记录不存在' }, { status: 404 })
  try {
    const body = await request.json()
    if (body.lifecycle === 'dead' && current.locked) return NextResponse.json({ error: '锁定人物不能被自动改写生命周期' }, { status: 409 })
    const actor = upsertActorRuntime({ ...current, lifecycle: body.lifecycle || current.lifecycle, agencyScore: body.agencyScore == null ? current.agencyScore : Number(body.agencyScore), locked: body.locked == null ? current.locked : Boolean(body.locked), currentSceneId: body.currentSceneId === null ? undefined : body.currentSceneId || current.currentSceneId, lastActiveTick: body.lastActiveTick == null ? current.lastActiveTick : Number(body.lastActiveTick), promotionReason: body.reason || current.promotionReason })
    return NextResponse.json({ actor })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
