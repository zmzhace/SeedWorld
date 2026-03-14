import { NextResponse } from 'next/server'
import { generateInitialWorld } from '@/server/llm/world-generator'
import { coordinatePlotGeneration } from '@/server/llm/siming-nuwa-coordinator'

/**
 * 完整的世界初始化流程：
 * 1. 盘古创世
 * 2. 女娲造人（自动）
 * 3. 司命编织（自动）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const worldPrompt = String(body?.worldPrompt ?? '')
    const worldId = String(body?.worldId ?? '')
    
    if (!worldPrompt.trim()) {
      return NextResponse.json(
        { error: 'worldPrompt is required' },
        { status: 400 }
      )
    }

    console.log('=== 开始世界初始化 ===')
    console.log('1. 盘古创世...')
    
    // 1. 盘古创世
    const world = await generateInitialWorld({ worldPrompt })
    if (worldId) {
      world.world_id = worldId
    }
    
    console.log('✓ 盘古创世完成')
    console.log('2. 司命-女娲协同开始...')
    
    // 2. 司命-女娲协同：司命分析剧情需求，女娲补充所需角色
    const genesisEvent = world.events.find(e => e.type === 'world_created')
    const worldContext = {
      environment: world.environment.description,
      social_context: world.social_context,
      narrative_seed: String(genesisEvent?.payload?.narrative_seed || ''),
    }
    
    const coordination = await coordinatePlotGeneration({
      worldContext,
      existingAgents: [],  // 初始化时没有现有角色
      plotType: 'main',
    })
    
    console.log('✓ 司命-女娲协同完成')
    console.log(`  - 女娲创造了 ${coordination.newAgents.length} 个 agents`)
    console.log(`  - 司命编织了剧情：${coordination.plot.title}`)
    console.log('协同日志:')
    coordination.coordination_log.forEach(log => console.log(`  ${log}`))
    
    // 更新世界状态
    world.agents.npcs = coordination.newAgents
    world.plots = [coordination.plot]
    coordination.plot.status = 'active'  // 自动激活主线
    
    world.events.push({
      id: `nuwa-${Date.now()}`,
      type: 'agents_created',
      timestamp: new Date().toISOString(),
      payload: {
        count: coordination.newAgents.length,
        agent_names: coordination.newAgents.map(a => a.identity.name),
        auto_generated: true,
        coordinated: true,
      },
    })
    
    world.events.push({
      id: `siming-${Date.now()}`,
      type: 'plot_created',
      timestamp: new Date().toISOString(),
      payload: {
        plot_id: coordination.plot.id,
        plot_title: coordination.plot.title,
        plot_type: coordination.plot.type,
        auto_generated: true,
        coordinated: true,
      },
    })
    console.log('=== 世界初始化完成 ===')
    
    return NextResponse.json({
      success: true,
      world,
      summary: {
        agents_count: coordination.newAgents.length,
        plot_title: coordination.plot.title,
        coordination_log: coordination.coordination_log,
      },
    })
  } catch (error) {
    console.error('Failed to initialize world:', error)
    return NextResponse.json(
      { error: 'Failed to initialize world: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
