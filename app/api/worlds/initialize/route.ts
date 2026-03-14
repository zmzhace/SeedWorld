import { NextResponse } from 'next/server'
import { generateInitialWorld } from '@/server/llm/world-generator'
import { generatePersonalAgents } from '@/server/llm/agent-generator'

/**
 * 完整的世界初始化流程（涌现式）：
 * 1. 盘古创世 - 生成初始世界状态
 * 2. 女娲造人 - 创建初始 Agents
 * 3. 让 Agents 自由互动，故事自然涌现
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

    console.log('=== 开始世界初始化（涌现式） ===')
    console.log('1. 盘古创世...')
    
    // 1. 盘古创世
    const world = await generateInitialWorld({ worldPrompt })
    if (worldId) {
      world.world_id = worldId
    }
    
    console.log('✓ 盘古创世完成')
    console.log('2. 女娲造人...')
    
    // 2. 女娲造人：使用 LLM 创建初始 Agents（5-10 个）
    const agentCount = 5 + Math.floor(Math.random() * 6) // 5-10 个
    const newAgents = await generatePersonalAgents({
      prompt: `${world.environment.description}\n\n社会背景：${JSON.stringify(world.social_context)}`,
      count: agentCount,
    })
    
    console.log(`✓ 女娲造人完成：创造了 ${newAgents.length} 个 Agents`)
    
    // 更新世界状态
    world.agents.npcs = newAgents
    
    world.events.push({
      id: `init-complete-${Date.now()}`,
      type: 'world_initialized',
      timestamp: new Date().toISOString(),
      payload: {
        agent_count: newAgents.length,
        agent_names: newAgents.map(a => a.identity.name),
        initialization_type: 'emergent',
      },
    })
    
    console.log('=== 世界初始化完成 ===')
    console.log('提示：故事将从 Agents 的自由互动中自然涌现')
    
    return NextResponse.json({
      success: true,
      world,
      summary: {
        agents_count: newAgents.length,
        agent_names: newAgents.map(a => a.identity.name),
        initialization_type: 'emergent',
        message: '世界已创建，Agents 将自由互动，故事自然涌现',
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
