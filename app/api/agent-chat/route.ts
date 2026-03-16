import { NextResponse } from 'next/server'
import { handleAgentChat } from '@/server/agent-chat'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = String(body?.message ?? '')
    const agentSeed = String(body?.agentSeed ?? '')
    const world = body?.world

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    if (!agentSeed) {
      return NextResponse.json({ error: 'agentSeed is required' }, { status: 400 })
    }

    if (!world) {
      return NextResponse.json({ error: 'world is required' }, { status: 400 })
    }

    const result = await handleAgentChat({ message, agentSeed, world })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Agent Chat API] Error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Failed to process agent chat', detail: (error as Error).message },
      { status: 500 },
    )
  }
}
