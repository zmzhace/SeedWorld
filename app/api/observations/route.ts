import { NextResponse } from 'next/server'
import { generateObservationSummary } from '@/server/llm/observation-generator'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const world: WorldSlice = body?.world
    const agent: PersonalAgentState = body?.agent

    if (!world || !agent) {
      return NextResponse.json(
        { success: false, error: 'Missing world or agent data' },
        { status: 400 }
      )
    }

    const summary = await generateObservationSummary({ world, agent })

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Observation generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate observation' },
      { status: 500 }
    )
  }
}
