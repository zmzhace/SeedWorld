import { NextResponse } from 'next/server'
import { listActorRuntime, upsertActorRuntime } from '@/server/novel-repository'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ actors: listActorRuntime(params.id) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    if (!body.actorId) return NextResponse.json({ error: 'actorId is required' }, { status: 400 })
    return NextResponse.json({ actor: upsertActorRuntime({ actorId: String(body.actorId), worldId: params.id, lifecycle: body.lifecycle || 'candidate', agencyScore: Number(body.agencyScore || 0), locked: Boolean(body.locked), currentSceneId: body.currentSceneId || undefined, lastActiveTick: body.lastActiveTick == null ? undefined : Number(body.lastActiveTick), promotionReason: body.promotionReason || undefined }) })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
