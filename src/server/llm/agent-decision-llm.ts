import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import { createAnthropicClient, getModel } from './anthropic'
import { extractWorldKnowledge } from '@/engine/world-knowledge'

/**
 * LLM Agent 决策结果
 */
export type LLMDecisionResult = {
  action: {
    type: string
    target?: string
    intensity: number
  }
  reasoning: string
  inner_monologue: string
  dialogue?: string
  behavior_description: string
}

const VALID_ACTION_TYPES = [
  'rest', 'reflect', 'relax', 'pursue_goal', 'socialize',
  'interact', 'help', 'compete', 'avoid', 'react_to_pressure', 'explore',
]

/**
 * 构建 agent 的完整上下文 prompt
 */
function buildAgentPrompt(agent: PersonalAgentState, world: WorldSlice): string {
  const knowledge = extractWorldKnowledge(world)

  // 其他 agent 信息（带关系）
  const otherAgents = world.agents.npcs
    .filter(a => a.genetics.seed !== agent.genetics.seed)
    .map(a => {
      const rel = agent.relations[a.genetics.seed]
      const relLabel = rel != null
        ? rel > 0.5 ? '友好' : rel > 0 ? '一般' : rel > -0.5 ? '冷淡' : '敌对'
        : '陌生'
      const occLabel = a.occupation ? `（${a.occupation}）` : ''
      return `- ${a.identity.name}${occLabel}：关系${relLabel}${rel != null ? `(${rel.toFixed(1)})` : ''}`
    })
    .join('\n')

  // 近期记忆
  const recentMemories = [...agent.memory_short]
    .slice(-5)
    .map(m => `- ${m.content}`)
    .join('\n')

  // 近期世界事件
  const recentEvents = world.events
    .slice(-10)
    .map(e => {
      const payload = e.payload as Record<string, unknown> | undefined
      return `- [${e.type}] ${payload?.summary || e.id}`
    })
    .join('\n')

  // 当前叙事
  const activeNarratives = world.narratives.patterns
    .filter(p => p.participants.includes(agent.genetics.seed) && (p.status === 'developing' || p.status === 'climax'))
    .map(p => `- ${p.type}（${p.status}）：参与者 ${p.participants.join(', ')}，强度 ${p.intensity.toFixed(1)}`)
    .join('\n')

  return `你是「${agent.identity.name}」。

## 你的身份
- 职业：${agent.occupation || '无'}
- 说话风格：${agent.voice || '普通'}
- 做事方式：${agent.approach || '普通'}
- 专长：${agent.expertise?.join('、') || '无'}
- 核心信念：${agent.core_belief || '无'}

## 你的当前状态
- 能量：${(agent.vitals.energy * 100).toFixed(0)}%
- 压力：${(agent.vitals.stress * 100).toFixed(0)}%
- 专注：${(agent.vitals.focus * 100).toFixed(0)}%
- 情绪：${agent.emotion.label}（强度 ${(agent.emotion.intensity * 100).toFixed(0)}%）

## 你的目标
${agent.goals.length > 0 ? agent.goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '暂无明确目标'}

## 你的近期记忆
${recentMemories || '无'}

## 世界背景
- 环境：${knowledge.environment.description}
- 核心叙事：${knowledge.narrative_seed}
- 社会压力：${knowledge.social.pressures.join('、')}
- 重大事件：${knowledge.social.macro_events.join('、')}

## 周围的人
${otherAgents || '无人'}

## 近期发生的事
${recentEvents || '无'}

## 你参与的叙事线
${activeNarratives || '无'}

## 可选行动
- rest：休息恢复
- reflect：反思冥想
- pursue_goal：追求你的目标
- socialize/interact：与某人社交互动
- help：帮助某人
- compete：与某人竞争对抗
- avoid：回避冲突
- explore：探索环境
- react_to_pressure：应对外部压力

请以「${agent.identity.name}」的身份，根据你的性格、信念、当前状态和周围环境，决定你现在要做什么。

返回严格 JSON 格式：
{
  "action": {
    "type": "行动类型（从可选行动中选一个）",
    "target": "目标人物名字（如果行动涉及他人，用 seed 标识）",
    "intensity": 0.7
  },
  "reasoning": "你为什么做这个决定（第三人称简述）",
  "inner_monologue": "你的内心独白（第一人称，符合你的性格和说话风格）",
  "dialogue": "你说出的话（如果这个行动涉及说话；没有则省略此字段）",
  "behavior_description": "具体行为描述（第三人称，生动描写你做了什么）"
}

只返回 JSON，不要其他内容。`
}

/**
 * 解析 LLM 返回的 JSON
 */
function parseLLMResponse(responseText: string): LLMDecisionResult | null {
  try {
    // 尝试提取 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    // 校验必要字段
    if (!parsed.action?.type || !parsed.behavior_description) return null

    // 规范化 action type
    const actionType = VALID_ACTION_TYPES.includes(parsed.action.type)
      ? parsed.action.type
      : 'reflect'

    return {
      action: {
        type: actionType,
        target: parsed.action.target || undefined,
        intensity: Math.max(0, Math.min(1, Number(parsed.action.intensity) || 0.5)),
      },
      reasoning: parsed.reasoning || '',
      inner_monologue: parsed.inner_monologue || '',
      dialogue: parsed.dialogue || undefined,
      behavior_description: parsed.behavior_description,
    }
  } catch {
    return null
  }
}

/**
 * 通过 LLM 为 agent 生成决策
 */
export async function generateAgentDecisionViaLLM(
  agent: PersonalAgentState,
  world: WorldSlice
): Promise<LLMDecisionResult> {
  const client = createAnthropicClient()
  const model = getModel()
  const prompt = buildAgentPrompt(agent, world)

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  // 处理 SSE 流式格式（中转站可能返回字符串）
  let responseText = ''
  if (typeof response === 'string') {
    const lines = (response as string).split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6))
          if (data.type === 'content_block_delta' && data.delta?.text) {
            responseText += data.delta.text
          }
        } catch {
          // skip
        }
      }
    }
  } else if (response.content?.length > 0) {
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text
      }
    }
  }

  if (!responseText) {
    throw new Error('LLM returned empty response')
  }

  const result = parseLLMResponse(responseText)
  if (!result) {
    throw new Error('Failed to parse LLM decision: ' + responseText.substring(0, 200))
  }

  return result
}
