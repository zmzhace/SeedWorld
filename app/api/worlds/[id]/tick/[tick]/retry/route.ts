import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { replanTickWorkflow } from '@/server/tick-workflow-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string; tick: string } }) {
  try {
    const tick = Number(params.tick)
    if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
    const db = getDatabase()
    const chapter = db.prepare('SELECT status FROM chapter_runs WHERE world_id=? AND tick=? ORDER BY created_at DESC LIMIT 1').get(params.id, tick) as { status: string } | undefined
    if (chapter?.status === 'failed') {
      return NextResponse.json({ error: '正文阶段已有保留草稿，请使用 retry-chapter 局部重试，避免重跑编剧会' }, { status: 409 })
    }
    return NextResponse.json({ run: replanTickWorkflow(params.id, tick) }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
