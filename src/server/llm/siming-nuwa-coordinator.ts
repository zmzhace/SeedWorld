/**
 * 司命-女娲协同系统
 * 
 * 司命编织剧情时，会检查是否有足够的 agents 来推动剧情
 * 如果不够，会让女娲自动补充所需的人物
 */

import Anthropic from '@anthropic-ai/sdk'
import type { PlotArc } from '@/domain/siming'
import type { PersonalAgentState } from '@/domain/world'
import { generatePersonalAgents } from './agent-generator'
import { generatePlotArc } from './siming-generator'

type CoordinationResult = {
  plot: PlotArc
  newAgents: PersonalAgentState[]
  coordination_log: string[]
}

/**
 * 司命编织剧情，必要时让女娲补充人物
 */
export async function coordinatePlotGeneration(options: {
  worldContext: {
    environment: string
    social_context: any
    narrative_seed: string
  }
  existingAgents: PersonalAgentState[]
  plotType: 'main' | 'side'
}): Promise<CoordinationResult> {
  const { worldContext, existingAgents, plotType } = options
  const log: string[] = []

  log.push(`司命开始编织${plotType === 'main' ? '主线' : '支线'}剧情...`)
  log.push(`当前世界有 ${existingAgents.length} 个 agents`)

  // 第一步：让司命分析剧情需求
  const requirements = await analyzeAgentRequirements({
    worldContext,
    existingAgents,
    plotType,
  })

  log.push(`司命分析：需要 ${requirements.required_roles.length} 种角色`)
  log.push(`缺少的角色：${requirements.missing_roles.join(', ')}`)

  // 第二步：如果缺少角色，让女娲补充
  let newAgents: PersonalAgentState[] = []
  if (requirements.missing_roles.length > 0) {
    log.push(`女娲开始造人，补充 ${requirements.missing_roles.length} 个角色...`)
    
    for (const roleDesc of requirements.missing_roles) {
      const agentPrompt = `基于世界背景，生成一个符合以下描述的人物：
世界环境：${worldContext.environment}
核心叙事：${worldContext.narrative_seed}
角色需求：${roleDesc}

要求：
1. 这个角色应该能够推动剧情发展
2. 与现有角色形成互补或冲突
3. 有明确的动机和目标`

      const agents = await generatePersonalAgents({
        prompt: agentPrompt,
        count: 1,
      })
      
      newAgents.push(...agents)
      log.push(`✓ 女娲创造了：${agents[0].identity.name}（${agents[0].occupation}）`)
    }
  } else {
    log.push('现有角色足够，无需补充')
  }

  // 第三步：用完整的角色列表生成剧情
  const allAgents = [...existingAgents, ...newAgents]
  log.push(`司命开始编织剧情，共 ${allAgents.length} 个角色参与...`)
  
  const plot = await generatePlotArc({
    worldContext,
    agents: allAgents,
    plotType,
  })

  log.push(`✓ 司命完成剧情编织：${plot.title}`)

  return {
    plot,
    newAgents,
    coordination_log: log,
  }
}

/**
 * 分析剧情所需的角色
 */
async function analyzeAgentRequirements(options: {
  worldContext: {
    environment: string
    social_context: any
    narrative_seed: string
  }
  existingAgents: PersonalAgentState[]
  plotType: 'main' | 'side'
}): Promise<{
  required_roles: string[]
  missing_roles: string[]
}> {
  const { worldContext, existingAgents, plotType } = options

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  const agentList = existingAgents.map(a => 
    `- ${a.identity.name}：${a.occupation || '未知职业'}，目标=${a.goals.slice(0, 2).join(', ')}`
  ).join('\n')

  const prompt = `你是司命真君，正在编织${plotType === 'main' ? '主线' : '支线'}剧情。

世界背景：
- 环境：${worldContext.environment}
- 核心叙事：${worldContext.narrative_seed}

现有角色：
${agentList || '（暂无角色）'}

请分析：
1. 这个剧情需要哪些类型的角色？（如：主角、对手、导师、盟友等）
2. 现有角色是否足够？如果不够，缺少什么类型的角色？

返回 JSON 格式：
{
  "required_roles": ["主角（有野心的年轻人）", "对手（权势人物）", "导师（智者）"],
  "missing_roles": ["对手（权势人物）", "导师（智者）"]
}

注意：
- required_roles 是剧情需要的所有角色类型
- missing_roles 是现有角色无法满足的，需要女娲补充的
- 如果现有角色足够，missing_roles 应该是空数组
- 角色描述要具体，包含职业特征和性格特点`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    let responseText = ''
    
    if (typeof response === 'string') {
      const lines = response.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            if (data.type === 'content_block_delta' && data.delta?.text) {
              responseText += data.delta.text
            }
          } catch (e) {}
        }
      }
    } else if (response.content && response.content.length > 0) {
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    }

    console.log('Siming requirements analysis:', responseText)

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // 如果解析失败，返回默认值
      return {
        required_roles: [],
        missing_roles: [],
      }
    }

    const result = JSON.parse(jsonMatch[0])
    return {
      required_roles: result.required_roles || [],
      missing_roles: result.missing_roles || [],
    }
  } catch (error) {
    console.error('Failed to analyze agent requirements:', error)
    // 出错时返回空数组，不阻塞流程
    return {
      required_roles: [],
      missing_roles: [],
    }
  }
}
