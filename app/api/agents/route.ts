import { NextResponse } from 'next/server'
import { generatePersonalAgents } from '@/server/llm/agent-generator'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const prompt = String(body?.prompt ?? '')
    const count = Number(body?.count ?? 3)

    const agents = await generatePersonalAgents({ prompt, count })

    return NextResponse.json({ success: true, agents })
  } catch (error) {
    console.error('Agent generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate agents' },
      { status: 500 }
    )
  }
}
