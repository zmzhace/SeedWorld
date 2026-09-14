import { NextResponse } from 'next/server'
import { listStoryThreads, saveStoryThread } from '@/server/novel-repository'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: { id: string; threadId: string } }) {
  const current = listStoryThreads(params.id, { limit: 100 }).find((thread) => thread.id === params.threadId)
  if (!current) return NextResponse.json({ error: '故事线不存在' }, { status: 404 })
  try {
    const body = await request.json()
    const thread = saveStoryThread({ ...current, status: body.status || current.status, title: body.title || current.title, goal: body.goal || current.goal, pressure: body.pressure == null ? current.pressure : Math.max(0, Math.min(1, Number(body.pressure))), ownerEntityIds: Array.isArray(body.ownerEntityIds) ? body.ownerEntityIds.map(String) : current.ownerEntityIds, anchorEventIds: Array.isArray(body.anchorEventIds) ? body.anchorEventIds.map(String) : current.anchorEventIds, lastAdvancedTick: body.lastAdvancedTick == null ? current.lastAdvancedTick : Number(body.lastAdvancedTick) })
    return NextResponse.json({ thread })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
