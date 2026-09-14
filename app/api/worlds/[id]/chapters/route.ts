import { NextResponse } from 'next/server'
import { getChapter, getLatestChapterRun, listChapters, startChapterRun } from '@/server/chapter-service'
export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const run = startChapterRun({ worldId: params.id, tickFrom: Number(body.tickFrom ?? 0), tickTo: Number(body.tickTo ?? body.tickFrom ?? 0), tick: body.tick == null ? undefined : Number(body.tick), contractId: body.contractId, povEntityId: body.povEntityId, goal: body.goal, requiredEvents: body.requiredEvents, eventIds: Array.isArray(body.eventIds) ? body.eventIds.map(String) : undefined })
    return NextResponse.json({ runId: run.id, run }, { status: 202 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const run = getLatestChapterRun(params.id)
  const chapters = listChapters(params.id)
  if (!run) return NextResponse.json({ run: null, chapters })
  if (run.status === 'completed' && run.chapterId) {
    return NextResponse.json({ run, chapter: getChapter(run.chapterId), chapters })
  }
  return NextResponse.json({ run, chapters })
}
