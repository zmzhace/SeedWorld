import { NextResponse } from 'next/server'
import { coordinatePlotGeneration } from '@/server/llm/siming-nuwa-coordinator'

/**
 * 司命-女娲协同生成剧情
 * 
 * 司命会分析剧情需求，如果角色不够会让女娲补充
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { worldContext, existingAgents, plotType } = body

    if (!worldContext || !existingAgents) {
      return NextResponse.json(
        { error: 'worldContext and existingAgents are required' },
        { status: 400 }
      )
    }

    console.log('=== 司命-女娲协同开始 ===')
    console.log(`剧情类型: ${plotType || 'main'}`)
    console.log(`现有 agents: ${existingAgents.length}`)

    const result = await coordinatePlotGeneration({
      worldContext,
      existingAgents,
      plotType: plotType || 'main',
    })

    console.log('=== 协同完成 ===')
    console.log(`生成剧情: ${result.plot.title}`)
    console.log(`新增 agents: ${result.newAgents.length}`)
    console.log('协同日志:')
    result.coordination_log.forEach(log => console.log(`  ${log}`))

    return NextResponse.json({
      success: true,
      plot: result.plot,
      newAgents: result.newAgents,
      coordination_log: result.coordination_log,
    })
  } catch (error) {
    console.error('Failed to coordinate plot generation:', error)
    return NextResponse.json(
      { error: 'Failed to coordinate plot generation: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
