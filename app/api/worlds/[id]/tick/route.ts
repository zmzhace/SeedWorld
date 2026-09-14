import { NextResponse } from 'next/server'
import { getLatestTickWorkflowStatus, startTickWorkflow } from '@/server/tick-workflow-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ run: getLatestTickWorkflowStatus(params.id) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const rawBody = await request.text()
    if (rawBody.trim()) {
      try { JSON.parse(rawBody) } catch { return NextResponse.json({ error: '请求体不是有效 JSON' }, { status: 400 }) }
    }
    const run = await startTickWorkflow(params.id)
    return NextResponse.json({ run }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = /不存在/.test(message) ? 404 : /请先|阻塞|确认/.test(message) ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
