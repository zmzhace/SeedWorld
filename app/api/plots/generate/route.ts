import { NextResponse } from 'next/server'
import { generatePlotArc } from '@/server/llm/siming-generator'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const worldContext = body?.worldContext
    const agents = body?.agents || []
    const plotType = body?.plotType || 'main'
    
    if (!worldContext) {
      return NextResponse.json(
        { error: 'worldContext is required' },
        { status: 400 }
      )
    }

    if (agents.length === 0) {
      return NextResponse.json(
        { error: 'At least one agent is required' },
        { status: 400 }
      )
    }

    console.log('Generating plot with type:', plotType, 'agents:', agents.length)
    
    // Call Siming to generate plot
    const plot = await generatePlotArc({ worldContext, agents, plotType })
    
    console.log('Plot generated:', plot.title)
    
    return NextResponse.json({
      success: true,
      plot,
    })
  } catch (error) {
    console.error('Failed to generate plot:', error)
    return NextResponse.json(
      { error: 'Failed to generate plot: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
