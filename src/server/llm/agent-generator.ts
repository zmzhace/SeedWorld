import Anthropic from '@anthropic-ai/sdk'
import type { PersonalAgentState } from '@/domain/world'
import { createPersonalAgent } from '@/domain/agents'
import { createAnthropicClient, getModel } from './anthropic'

type GenerateAgentsOptions = {
  prompt: string
  count: number
}

type AgentSpec = {
  seed: string
  persona: {
    openness: number
    stability: number
    attachment: number
    agency: number
    empathy: number
  }
  vitals: {
    energy: number
    stress: number
    sleep_debt: number
    focus: number
    aging_index: number
  }
  backstory?: string
  goals?: string[]
  
  // 个性化字段 - 由 LLM 根据世界背景动态生成
  occupation?: string  // 职业
  voice?: string  // 说话风格
  approach?: string  // 做事方式
  expertise?: string[]  // 专长领域
  core_belief?: string  // 核心信念
}

export async function generatePersonalAgents(
  options: GenerateAgentsOptions
): Promise<PersonalAgentState[]> {
  const { prompt, count } = options

  const client = createAnthropicClient()

  const model = getModel()

  const systemPrompt = `你是女娲，负责为世界创造生动的人物。根据世界背景和描述，生成 ${count} 个独特的 agents。

世界背景：${prompt}

为每个 agent 提供：
1. seed：唯一标识符（kebab-case，描述性的）
2. persona：性格特质（openness, stability, attachment, agency, empathy）值为 0-1
3. vitals：生命状态（energy, stress, sleep_debt, focus, aging_index）值为 0-1
4. backstory：简短的背景故事
5. goals：2-3 个具体的、可执行的目标

**重要 - 个性化字段（受 agency-agents 启发）：**
6. occupation：职业（根据世界背景动态创造，可以是任何职业，不限于传统分类）
   - 例如：蛊师、元石商人、寨主、流浪修士、情报贩子、炼器师等
   - 职业应该符合世界设定，具有独特性和创造性
7. voice：说话风格（简短描述，如"直接果断"、"圆滑世故"、"神秘莫测"）
8. approach：做事方式（如"利益优先，善于权衡"、"冲动行事，重视情义"）
9. expertise：专长领域（3-5 个具体技能，如["蛊虫培育", "毒物鉴定", "山地追踪"]）
10. core_belief：核心信念（一句话，驱动角色行为的核心价值观）

**创造性要求：**
- 每个 agent 应该有鲜明的个性和独特的职业
- 职业应该根据世界背景创造，不要使用通用模板
- 说话风格和做事方式应该与职业和性格一致
- 专长应该具体且实用，不要太抽象
- 核心信念应该能解释角色的动机

返回 JSON 数组：
[
  {
    "seed": "cunning-gu-master",
    "persona": { "openness": 0.7, "stability": 0.6, "attachment": 0.4, "agency": 0.8, "empathy": 0.3 },
    "vitals": { "energy": 0.8, "stress": 0.3, "sleep_debt": 0.1, "focus": 0.7, "aging_index": 0.2 },
    "backstory": "在南疆山寨长大的蛊师，因家族被灭而踏上复仇之路",
    "goals": ["掌握六转蛊虫", "查明家族灭门真相", "建立自己的势力"],
    "occupation": "复仇蛊师",
    "voice": "冷静克制，言辞锋利",
    "approach": "谨慎布局，不择手段达成目标",
    "expertise": ["蛊虫培育", "毒物炼制", "暗杀技巧", "情报收集"],
    "core_belief": "复仇是我存在的唯一意义"
  }
]`

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: systemPrompt,
      },
    ],
  })

  // Handle both standard and streaming responses
  let responseText = ''
  
  // Parse SSE format or standard format
  if (typeof response === 'string') {
    // Parse SSE format
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
  } else if (response.content && response.content.length > 0) {
    // Standard Anthropic format
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text
      }
    }
  }

  if (!responseText) {
    throw new Error('No text content in response')
  }

  console.log('Agent generator response:', responseText)

  // Extract JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse agent specifications from response')
  }

  const specs: AgentSpec[] = JSON.parse(jsonMatch[0])

  // Convert specs to PersonalAgentState
  return specs.map((spec) => {
    const agent = createPersonalAgent(spec.seed)
    return {
      ...agent,
      persona: spec.persona,
      vitals: spec.vitals,
      goals: spec.goals || [],
      occupation: spec.occupation,
      voice: spec.voice,
      approach: spec.approach,
      expertise: spec.expertise,
      core_belief: spec.core_belief,
      success_metrics: {
        // 初始化成功指标为 0
        wealth: 0,
        reputation: 0,
        power: 0,
        knowledge: 0,
      },
    }
  })
}
