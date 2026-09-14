import { NextResponse } from 'next/server'
import { discardTickWorkflow } from '@/server/tick-workflow-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string; tick: string } }) {
  try {
    const tick = Number(params.tick)
    if (!Number.isInteger(tick)) return NextResponse.json({ error: 'Tick 无效' }, { status: 400 })
    return NextResponse.json(discardTickWorkflow(params.id, tick))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: /不存在/.test(message) ? 404 : 409 })
  }
}
