import Anthropic from '@anthropic-ai/sdk'
import type { PlotArc, PlotStage, FateThread } from '@/domain/siming'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'

type GeneratePlotOptions = {
  worldContext: {
    environment: string
    social_context: any
    narrative_seed: string
  }
  agents: PersonalAgentState[]
  plotType: 'main' | 'side'
}

type PlotSpec = {
  title: string
  description: string
  protagonists: string[]
  antagonists: string[]
  supporting: string[]
  stages: Array<{
    name: string
    description: string
    objectives: string[]
  }>
  fate_threads: Array<{
    agent_seed: string
    destiny: string
    turning_points: Array<{
      event: string
      consequence: string
    }>
  }>
  trigger_conditions: string[]
  success_conditions: string[]
  failure_conditions: string[]
}

export async function generatePlotArc(options: GeneratePlotOptions): Promise<PlotArc> {
  const { worldContext, agents, plotType } = options

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  const agentList = agents.map(a => `- ${a.identity.name} (${a.genetics.seed}): 目标=${a.goals.join(', ')}`).join('\n')

  const systemPrompt = `你是司命真君，掌管命运与剧情的编织。

世界背景：
- 环境：${worldContext.environment}
- 核心叙事：${worldContext.narrative_seed}
- 社会背景：${JSON.stringify(worldContext.social_context)}

现有角色：
${agentList}

请编织一个${plotType === 'main' ? '主线' : '支线'}剧情，要求：
1. 剧情要符合世界背景和核心叙事
2. 充分利用现有角色的目标和特点
3. 设计3-5个剧情阶段，每个阶段有明确目标
4. 为关键角色编织命运线，包括转折点
5. 设定触发条件、成功条件和失败条件

返回 JSON 格式：
{
  "title": "剧情标题",
  "description": "剧情概述",
  "protagonists": ["主角seed1", "主角seed2"],
  "antagonists": ["对手seed"],
  "supporting": ["配角seed"],
  "stages": [
    {
      "name": "阶段名称",
      "description": "阶段描述",
      "objectives": ["目标1", "目标2"]
    }
  ],
  "fate_threads": [
    {
      "agent_seed": "角色seed",
      "destiny": "命运描述",
      "turning_points": [
        {
          "event": "转折事件",
          "consequence": "后果"
        }
      ]
    }
  ],
  "trigger_conditions": ["触发条件1"],
  "success_conditions": ["成功条件1"],
  "failure_conditions": ["失败条件1"]
}`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: systemPrompt }],
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

    console.log('Siming response:', responseText)

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse plot from response')
    }

    const spec: PlotSpec = JSON.parse(jsonMatch[0])

    // 转换为 PlotArc
    const plotArc: PlotArc = {
      id: `plot-${Date.now()}`,
      title: spec.title,
      description: spec.description,
      type: plotType,
      status: 'pending',
      protagonists: spec.protagonists,
      antagonists: spec.antagonists,
      supporting: spec.supporting,
      stages: spec.stages.map((s, i) => ({
        id: `stage-${i}`,
        name: s.name,
        description: s.description,
        objectives: s.objectives,
        completed: false,
        events: [],
      })),
      current_stage: 0,
      fate_threads: spec.fate_threads.map(ft => ({
        agent_seed: ft.agent_seed,
        destiny: ft.destiny,
        turning_points: ft.turning_points.map((tp, i) => ({
          tick: 0,  // 将在运行时确定
          event: tp.event,
          consequence: tp.consequence,
        })),
      })),
      trigger_conditions: spec.trigger_conditions,
      success_conditions: spec.success_conditions,
      failure_conditions: spec.failure_conditions,
      created_at: Date.now(),
    }

    return plotArc
  } catch (error) {
    console.error('Siming error:', error)
    throw error
  }
}
