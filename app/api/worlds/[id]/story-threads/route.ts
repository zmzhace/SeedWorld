import { NextResponse } from 'next/server'
import { listStoryThreads, saveStoryThread } from '@/server/novel-repository'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const status = new URL(request.url).searchParams.get('status') as any
  return NextResponse.json({ threads: listStoryThreads(params.id, { status: status || undefined }) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    if (!body.title || !body.goal) return NextResponse.json({ error: 'title and goal are required' }, { status: 400 })
    const thread = saveStoryThread({ id: body.id, worldId: params.id, title: String(body.title), kind: String(body.kind || 'open_question'), status: body.status || 'active', goal: String(body.goal), pressure: Math.max(0, Math.min(1, Number(body.pressure || 0))), ownerEntityIds: Array.isArray(body.ownerEntityIds) ? body.ownerEntityIds.map(String) : [], parentThreadId: body.parentThreadId || undefined, anchorEventIds: Array.isArray(body.anchorEventIds) ? body.anchorEventIds.map(String) : [], lastAdvancedTick: body.lastAdvancedTick == null ? undefined : Number(body.lastAdvancedTick) })
    return NextResponse.json({ thread })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
