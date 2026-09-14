import { NextResponse } from 'next/server'
import { resumeTickWorkflow } from '@/server/tick-workflow-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; tick: string } }) {
  const tick = Number(params.tick)
  if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
  const run = resumeTickWorkflow(params.id, tick)
  return run ? NextResponse.json({ run }) : NextResponse.json({ error: 'Tick 不存在' }, { status: 404 })
}
