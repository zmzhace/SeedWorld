import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { AgentPatch } from '@/domain/agents'
import { extractWorldKnowledge, generateAgentContext } from './world-knowledge'
import { AgentDecisionMaker } from './agent-decision-maker'

/**
 * NPC Agent Executor - 并行执行 NPC agents 的决策和行动
 */

type AgentDecision = {
  agentId: string
  action: {
    type: string
    target?: string
    intensity: number
  }
  reasoning?: string
}

// 创建全局决策制定器实例
const decisionMaker = new AgentDecisionMaker()

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
 * 为单个 NPC agent 生成决策
 * 使用 AgentDecisionMaker 做出个性化决策
 */
function makeAgentDecision(agent: PersonalAgentState, world: WorldSlice): AgentDecision {
  // 使用 AgentDecisionMaker 做决策
  const decision = decisionMaker.makeDecision({
    world,
    agent,
    narratives: world.narratives.patterns,
    recentEvents: world.events.slice(-20)
  })
  
  return {
    agentId: agent.genetics.seed,
    action: {
      type: decision.type,
      target: decision.target,
      intensity: decision.intensity,
    },
    reasoning: decision.reason,
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
  
  // 生成事件（包含职业和决策理由）
  const occupationLabel = agent.occupation ? `[${agent.occupation}]` : ''
  const actionLabel = getActionLabel(action.type)
  const targetLabel = action.target ? ` → ${action.target}` : ''
  
  const event = {
    id: `agent-${agent.genetics.seed}-${world.tick}`,
    kind: 'micro' as const,
    summary: `${agent.identity.name}${occupationLabel} ${actionLabel}${targetLabel}`,
    conflict: action.type === 'compete',
  }
  
  const patch: AgentPatch = {
    timeDelta: 0,
    events: [event],
    rulesDelta: [],
    notes: [decision.reasoning || ''],
    meta: {
      agentId: decision.agentId,
      actionType: action.type,
      intensity: action.intensity,
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
