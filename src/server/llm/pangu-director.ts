import Anthropic from '@anthropic-ai/sdk'
import type { WorldSlice } from '@/domain/world'
import type { AgentPatch } from '@/domain/agents'

/**
 * 盘古导演 - 世界驱动 agent，负责推动故事线发展
 */

type StoryEvent = {
  type: 'macro' | 'environmental' | 'social'
  summary: string
  impact: {
    environment_change?: string
    social_pressure_added?: string
    narrative_shift?: string
    agent_goals_affected?: string[]
  }
  conflict: boolean
}

/**
 * 分析当前世界状态，生成故事线事件
 */
export async function generateStorylineEvent(world: WorldSlice): Promise<AgentPatch> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  // 提取世界背景
  const genesisEvent = world.events.find(e => e.type === 'world_created')
  const genesisPayload = genesisEvent?.payload as any
  
  // 分析最近的 agent 行动
  const recentEvents = world.events.slice(-10)
  const agentActions = recentEvents
    .filter(e => e.type !== 'tick' && e.type !== 'world_created')
    .map(e => e.payload?.summary || e.type)
  
  // 分析 agents 的目标
  const agentGoals = world.agents.npcs.map(npc => ({
    name: npc.identity.name,
    goals: npc.goals,
  }))

  const systemPrompt = `你是盘古，世界的驱动者。你的职责是观察世界状态，创造推动故事发展的事件。

世界背景：
- 核心叙事：${genesisPayload?.narrative_seed || ''}
- 环境：${world.environment.description}
- 当前 Tick：${world.tick}

社会背景：
- 重大事件：${world.social_context.macro_events.join(', ')}
- 主流叙事：${world.social_context.narratives.join(', ')}
- 社会压力：${world.social_context.pressures.join(', ')}

当前世界中的 Agents 及其目标：
${agentGoals.map(a => `- ${a.name}: ${a.goals.join(', ')}`).join('\n')}

最近发生的事件：
${agentActions.join('\n')}

基于以上信息，生成一个推动故事发展的事件。要求：
1. 事件应该与世界核心叙事相关
2. 事件应该影响 agents 的目标或行为
3. 事件可以改变环境或社会背景
4. 事件应该制造冲突或机遇，推动剧情发展
5. 每 5-10 个 tick 生成一个重大事件，其他时候可以是小事件或环境变化

返回 JSON 格式：
{
  "type": "macro" | "environmental" | "social",
  "summary": "事件的简短描述",
  "impact": {
    "environment_change": "环境如何改变（可选）",
    "social_pressure_added": "新增的社会压力（可选）",
    "narrative_shift": "叙事如何转变（可选）",
    "agent_goals_affected": ["受影响的 agent 名字"]
  },
  "conflict": true/false
}`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    })

    let responseText = ''
    
    // Handle SSE streaming format
    if (typeof response === 'string') {
      const lines = (response as string).split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            if (data.type === 'content_block_delta' && data.delta?.text) {
              responseText += data.delta.text
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } 
    // Handle standard format
    else if (response.content && response.content.length > 0) {
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // 如果没有生成事件，返回空补丁
      return {
        timeDelta: 0,
        events: [],
        rulesDelta: [],
        notes: ['No storyline event generated this tick'],
        meta: {},
      }
    }

    const storyEvent: StoryEvent = JSON.parse(jsonMatch[0])

    // 转换为 AgentPatch
    return {
      timeDelta: storyEvent.type === 'macro' ? 1 : 0,
      events: [
        {
          id: `pangu-${world.tick}`,
          kind: storyEvent.type === 'macro' ? 'macro' : 'micro',
          summary: storyEvent.summary,
          conflict: storyEvent.conflict,
        },
      ],
      rulesDelta: [],
      notes: [
        storyEvent.impact.environment_change || '',
        storyEvent.impact.social_pressure_added || '',
        storyEvent.impact.narrative_shift || '',
      ].filter(Boolean),
      meta: {
        impact: storyEvent.impact,
        type: storyEvent.type,
      },
    }
  } catch (error) {
    console.error('Pangu director error:', error)
    // 返回空补丁，不影响世界运行
    return {
      timeDelta: 0,
      events: [],
      rulesDelta: [],
      notes: ['Pangu director failed this tick'],
      meta: { error: (error as Error).message },
    }
  }
}

/**
 * 应用盘古事件的影响到世界
 */
export function applyPanguImpact(world: WorldSlice, patch: AgentPatch): WorldSlice {
  const impact = patch.meta?.impact as StoryEvent['impact'] | undefined
  if (!impact) return world

  let updatedWorld = { ...world }

  // 更新环境
  if (impact.environment_change) {
    updatedWorld = {
      ...updatedWorld,
      environment: {
        description: impact.environment_change,
      },
    }
  }

  // 添加社会压力
  if (impact.social_pressure_added) {
    updatedWorld = {
      ...updatedWorld,
      social_context: {
        ...updatedWorld.social_context,
        pressures: [
          ...updatedWorld.social_context.pressures,
          impact.social_pressure_added,
        ],
      },
    }
  }

  // 更新叙事
  if (impact.narrative_shift) {
    updatedWorld = {
      ...updatedWorld,
      social_context: {
        ...updatedWorld.social_context,
        narratives: [
          ...updatedWorld.social_context.narratives,
          impact.narrative_shift,
        ],
      },
    }
  }

  return updatedWorld
}
