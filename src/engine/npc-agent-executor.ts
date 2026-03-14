import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { AgentPatch } from '@/domain/agents'
import { extractWorldKnowledge, generateAgentContext } from './world-knowledge'
import { AgentDecisionMaker } from './agent-decision-maker'
import { CognitiveBiasSystem } from './cognitive-bias-system'
import { generateAgentDecisionViaLLM, type LLMDecisionResult } from '@/server/llm/agent-decision-llm'

/**
 * NPC Agent Executor - 并行执行 NPC agents 的决策和行动
 * 优先使用 LLM 做决策，失败时 fallback 到规则引擎
 */

type AgentDecision = {
  agentId: string
  action: {
    type: string
    target?: string
    intensity: number
  }
  reasoning?: string
  inner_monologue?: string
  dialogue?: string
  behavior_description?: string
}

// 规则引擎作为 fallback
const fallbackDecisionMaker = new AgentDecisionMaker()
const biasSystem = new CognitiveBiasSystem()

/**
 * 获取行动的友好标签
 */
function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    'rest': '休息',
    'reflect': '反思',
    'relax': '放松',
    'pursue_goal': '追求目标',
    'socialize': '社交',
    'interact': '互动',
    'help': '帮助',
    'compete': '竞争',
    'avoid': '避免冲突',
    'react_to_pressure': '应对压力',
    'explore': '探索',
  }
  return labels[actionType] || actionType
}

/**
 * 规则引擎 fallback 决策
 */
function makeRuleFallbackDecision(agent: PersonalAgentState, world: WorldSlice): AgentDecision {
  const decision = fallbackDecisionMaker.makeDecision({
    world,
    agent,
    narratives: world.narratives.patterns,
    recentEvents: world.events.slice(-20)
  })

  const biases = biasSystem.assignBiases(agent)
  const { modified_decision, effects } = biasSystem.applyBiasToDecision(
    agent,
    decision,
    {
      world,
      alternatives: [],
      history: (agent.action_history || []).map(a => ({
        type: a.type as any,
        intensity: 0.5,
        reason: '',
      })),
    },
    biases
  )

  const appliedEffects = effects.filter(e => e.applied)
  const biasNote = appliedEffects.length > 0
    ? ` [偏差: ${appliedEffects.map(e => e.impact_description).join('; ')}]`
    : ''

  return {
    agentId: agent.genetics.seed,
    action: {
      type: modified_decision.type,
      target: modified_decision.target,
      intensity: modified_decision.intensity,
    },
    reasoning: (modified_decision.reason || '') + biasNote,
  }
}

/**
 * 为单个 NPC agent 生成决策
 * 优先 LLM，失败 fallback 到规则引擎
 */
async function makeAgentDecision(agent: PersonalAgentState, world: WorldSlice): Promise<AgentDecision> {
  try {
    const llmResult = await generateAgentDecisionViaLLM(agent, world)
    console.log(`[LLM Agent] ${agent.identity.name}: ${llmResult.action.type} - ${llmResult.behavior_description.substring(0, 50)}...`)
    return {
      agentId: agent.genetics.seed,
      action: llmResult.action,
      reasoning: llmResult.reasoning,
      inner_monologue: llmResult.inner_monologue,
      dialogue: llmResult.dialogue,
      behavior_description: llmResult.behavior_description,
    }
  } catch (error) {
    console.warn(`[LLM Agent] ${agent.identity.name} LLM 失败，降级到规则引擎:`, (error as Error).message)
    return makeRuleFallbackDecision(agent, world)
  }
}

/**
 * 将 agent 决策转换为世界补丁，并更新 agent 状态
 */
function decisionToPatch(decision: AgentDecision, agent: PersonalAgentState, world: WorldSlice): { patch: AgentPatch; updatedAgent: PersonalAgentState } {
  const { action } = decision
  
  // 复制 agent 状态
  const updatedAgent = { ...agent }
  
  // 根据行动类型更新 agent 状态
  switch (action.type) {
    case 'rest':
    case 'reflect':
      // 休息/反思恢复能量，降低压力
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.min(1, updatedAgent.vitals.energy + 0.2 * action.intensity),
        stress: Math.max(0, updatedAgent.vitals.stress - 0.15 * action.intensity),
        sleep_debt: Math.max(0, updatedAgent.vitals.sleep_debt - 0.1),
      }
      updatedAgent.emotion = {
        label: '放松',
        intensity: 0.3,
      }
      break
      
    case 'relax':
      // 放松降低压力
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        stress: Math.max(0, updatedAgent.vitals.stress - 0.2 * action.intensity),
        energy: Math.max(0, updatedAgent.vitals.energy - 0.05),
      }
      updatedAgent.emotion = {
        label: '平静',
        intensity: 0.4,
      }
      break
      
    case 'pursue_goal':
      // 追求目标消耗能量，增加压力，但提升专注
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.15 * action.intensity),
        stress: Math.min(1, updatedAgent.vitals.stress + 0.1 * action.intensity),
        focus: Math.min(1, updatedAgent.vitals.focus + 0.1),
      }
      updatedAgent.emotion = {
        label: '专注',
        intensity: action.intensity,
      }
      // 有概率完成目标
      if (Math.random() < 0.1 * action.intensity) {
        updatedAgent.goals = updatedAgent.goals.slice(1) // 移除第一个目标
        if (updatedAgent.success_metrics) {
          updatedAgent.success_metrics.power = (updatedAgent.success_metrics.power || 0) + 1
        }
      }
      break
      
    case 'socialize':
    case 'interact':
      // 社交/互动降低压力，消耗少量能量，建立关系
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.08),
        stress: Math.max(0, updatedAgent.vitals.stress - 0.1),
      }
      updatedAgent.emotion = {
        label: '愉快',
        intensity: 0.6,
      }
      // 建立或增强关系
      if (action.target) {
        updatedAgent.relations = {
          ...updatedAgent.relations,
          [action.target]: Math.min(1, (updatedAgent.relations[action.target] || 0) + 0.1),
        }
        if (updatedAgent.success_metrics) {
          updatedAgent.success_metrics.reputation = (updatedAgent.success_metrics.reputation || 0) + 1
        }
      }
      break
      
    case 'help':
      // 帮助他人消耗能量，但增强关系和声誉
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.12),
        stress: Math.max(0, updatedAgent.vitals.stress - 0.05),
      }
      updatedAgent.emotion = {
        label: '满足',
        intensity: 0.7,
      }
      if (action.target) {
        updatedAgent.relations = {
          ...updatedAgent.relations,
          [action.target]: Math.min(1, (updatedAgent.relations[action.target] || 0) + 0.2),
        }
        if (updatedAgent.success_metrics) {
          updatedAgent.success_metrics.reputation = (updatedAgent.success_metrics.reputation || 0) + 2
        }
      }
      break
      
    case 'compete':
      // 竞争消耗大量能量，增加压力，可能恶化关系
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.2 * action.intensity),
        stress: Math.min(1, updatedAgent.vitals.stress + 0.15 * action.intensity),
        focus: Math.min(1, updatedAgent.vitals.focus + 0.15),
      }
      updatedAgent.emotion = {
        label: '紧张',
        intensity: action.intensity,
      }
      if (action.target) {
        updatedAgent.relations = {
          ...updatedAgent.relations,
          [action.target]: Math.max(-1, (updatedAgent.relations[action.target] || 0) - 0.1),
        }
        // 有概率获得权力
        if (Math.random() < 0.2 * action.intensity && updatedAgent.success_metrics) {
          updatedAgent.success_metrics.power = (updatedAgent.success_metrics.power || 0) + 1
        }
      }
      break
      
    case 'avoid':
      // 避免冲突，降低压力但也降低专注
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        stress: Math.max(0, updatedAgent.vitals.stress - 0.15),
        focus: Math.max(0, updatedAgent.vitals.focus - 0.1),
      }
      updatedAgent.emotion = {
        label: '谨慎',
        intensity: 0.5,
      }
      break
      
    case 'react_to_pressure':
      // 对压力做出反应，增加压力和情绪强度
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        stress: Math.min(1, updatedAgent.vitals.stress + 0.15 * action.intensity),
        energy: Math.max(0, updatedAgent.vitals.energy - 0.1),
      }
      updatedAgent.emotion = {
        label: '焦虑',
        intensity: action.intensity,
      }
      break
      
    case 'explore':
      // 探索消耗能量，增加知识
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.1),
        focus: Math.min(1, updatedAgent.vitals.focus + 0.05),
      }
      updatedAgent.emotion = {
        label: '好奇',
        intensity: action.intensity,
      }
      if (updatedAgent.success_metrics) {
        updatedAgent.success_metrics.knowledge = (updatedAgent.success_metrics.knowledge || 0) + 1
      }
      break
      
    default:
      // 默认：轻微消耗能量
      updatedAgent.vitals = {
        ...updatedAgent.vitals,
        energy: Math.max(0, updatedAgent.vitals.energy - 0.05),
      }
  }
  
  // 所有行动都会轻微增加衰老
  updatedAgent.vitals.aging_index = Math.min(1, updatedAgent.vitals.aging_index + 0.001)

  // 记录行动到 action_history（用于 persona drift）
  updatedAgent.action_history = [
    ...(updatedAgent.action_history || []),
    { type: action.type, timestamp: new Date().toISOString() }
  ]

  // 将决策生成为短期记忆（使用 LLM 的丰富描述）
  const actionLabel = getActionLabel(action.type)
  const targetLabel = action.target ? `对象: ${action.target}` : ''
  const memoryContent = decision.behavior_description
    || `${actionLabel}${targetLabel ? ' ' + targetLabel : ''}${decision.reasoning ? ' - ' + decision.reasoning : ''}`

  updatedAgent.memory_short = [
    ...(updatedAgent.memory_short || []),
    {
      id: `decision-${agent.genetics.seed}-${world.tick}`,
      content: memoryContent,
      importance: action.intensity * 0.5,
      emotional_weight: updatedAgent.emotion.intensity * 0.3,
      source: 'self' as const,
      timestamp: new Date().toISOString(),
      decay_rate: 0.1,
      retrieval_strength: 0.6,
    }
  ].slice(-20) // 保留最近 20 条

  // 写入 LLM 决策的丰富输出
  updatedAgent.last_action_description = decision.behavior_description
  updatedAgent.last_dialogue = decision.dialogue
  updatedAgent.last_inner_monologue = decision.inner_monologue

  // 生成事件（使用 LLM 的行为描述）
  const occupationLabel = agent.occupation ? `[${agent.occupation}]` : ''
  const eventSummary = decision.behavior_description
    || `${agent.identity.name}${occupationLabel} ${actionLabel}${action.target ? ` → ${action.target}` : ''}`

  const event = {
    id: `agent-${agent.genetics.seed}-${world.tick}`,
    kind: 'micro' as const,
    summary: eventSummary,
    conflict: action.type === 'compete',
  }
  
  const notes: string[] = []
  if (decision.reasoning) notes.push(decision.reasoning)
  if (decision.inner_monologue) notes.push(`💭 ${decision.inner_monologue}`)
  if (decision.dialogue) notes.push(`💬 ${decision.dialogue}`)

  const patch: AgentPatch = {
    timeDelta: 0,
    events: [event],
    rulesDelta: [],
    notes,
    meta: {
      agentId: decision.agentId,
      actionType: action.type,
      intensity: action.intensity,
      dialogue: decision.dialogue,
      inner_monologue: decision.inner_monologue,
    },
  }
  
  return { patch, updatedAgent }
}

/**
 * 并行执行所有 NPC agents
 */
export async function executeNpcAgents(
  world: WorldSlice
): Promise<Array<{ agentId: string; patch: AgentPatch; updatedAgent: PersonalAgentState }>> {
  const { npcs } = world.agents
  
  if (npcs.length === 0) {
    return []
  }
  
  // 并行为所有 agents 生成决策
  const decisions = await Promise.all(
    npcs.map(async (agent) => {
      try {
        return makeAgentDecision(agent, world)
      } catch (error) {
        console.error(`Failed to make decision for agent ${agent.identity.name}:`, error)
        return null
      }
    })
  )
  
  // 过滤掉失败的决策
  const validDecisions = decisions.filter((d): d is AgentDecision => d !== null)
  
  // 并行将决策转换为补丁和更新的 agent
  const results = await Promise.all(
    validDecisions.map(async (decision) => {
      const agent = npcs.find(a => a.genetics.seed === decision.agentId)
      if (!agent) return null
      
      try {
        const { patch, updatedAgent } = decisionToPatch(decision, agent, world)
        return {
          agentId: decision.agentId,
          patch,
          updatedAgent,
        }
      } catch (error) {
        console.error(`Failed to create patch for agent ${agent.identity.name}:`, error)
        return null
      }
    })
  )
  
  // 过滤掉失败的结果
  return results.filter((r): r is { agentId: string; patch: AgentPatch; updatedAgent: PersonalAgentState } => r !== null)
}
