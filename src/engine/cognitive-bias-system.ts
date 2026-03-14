/**
 * 认知偏差系统 - 最能提升真实性
 * 核心：Agents 不是完全理性的，会受到各种认知偏差的影响
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { AgentAction } from './agent-decision-maker'

export type BiasType = 
  | 'confirmation'      // 确认偏差
  | 'anchoring'         // 锚定效应
  | 'availability'      // 可得性启发
  | 'groupthink'        // 群体思维
  | 'sunk_cost'         // 沉没成本谬误
  | 'optimism'          // 乐观偏差
  | 'loss_aversion'     // 损失厌恶

export type CognitiveBias = {
  type: BiasType
  strength: number  // 偏差强度 [0-1]
  description: string
  triggers: string[]  // 触发条件
}

export type BiasEffect = {
  bias_type: BiasType
  applied: boolean
  impact_description: string
  decision_change: number  // 决策改变程度 [-1, 1]
}

export class CognitiveBiasSystem {
  // 为 agent 分配认知偏差
  assignBiases(agent: PersonalAgentState): CognitiveBias[] {
    const biases: CognitiveBias[] = []
    
    // 基于个性分配偏差
    // 高开放性 → 较少确认偏差
    if (agent.persona.openness < 0.5) {
      biases.push({
        type: 'confirmation',
        strength: 0.7 - agent.persona.openness,
        description: '倾向于寻找支持自己观点的信息',
        triggers: ['decision_making', 'information_processing']
      })
    }
    
    // 低稳定性 → 更强的可得性启发
    if (agent.persona.stability < 0.5) {
      biases.push({
        type: 'availability',
        strength: 0.8 - agent.persona.stability,
        description: '基于容易想起的信息做判断',
        triggers: ['risk_assessment', 'probability_estimation']
      })
    }
    
    // 高依恋 → 群体思维
    if (agent.persona.attachment > 0.6) {
      biases.push({
        type: 'groupthink',
        strength: agent.persona.attachment * 0.7,
        description: '为了和谐而压制异议',
        triggers: ['group_decision', 'social_pressure']
      })
    }
    
    // 低主动性 → 沉没成本谬误
    if (agent.persona.agency < 0.5) {
      biases.push({
        type: 'sunk_cost',
        strength: 0.7 - agent.persona.agency,
        description: '因为已投入而继续错误决策',
        triggers: ['project_continuation', 'relationship_maintenance']
      })
    }
    
    // 高开放性 + 高主动性 → 乐观偏差
    if (agent.persona.openness > 0.6 && agent.persona.agency > 0.6) {
      biases.push({
        type: 'optimism',
        strength: (agent.persona.openness + agent.persona.agency) / 2 * 0.6,
        description: '高估好结果的概率',
        triggers: ['planning', 'risk_taking']
      })
    }
    
    // 所有人都有损失厌恶（程度不同）
    biases.push({
      type: 'loss_aversion',
      strength: 0.5 + Math.random() * 0.3,
      description: '损失的痛苦大于获得的快乐',
      triggers: ['trade', 'risk_decision']
    })
    
    // 锚定效应（普遍存在）
    biases.push({
      type: 'anchoring',
      strength: 0.4 + Math.random() * 0.4,
      description: '过度依赖第一印象',
      triggers: ['first_impression', 'negotiation']
    })
    
    return biases
  }
  
  /**
   * 应用偏差到决策
   */
  applyBiasToDecision(
    agent: PersonalAgentState,
    decision: AgentAction,
    context: {
      world: WorldSlice
      alternatives: AgentAction[]
      history: AgentAction[]
    },
    biases: CognitiveBias[]
  ): {
    modified_decision: AgentAction
    effects: BiasEffect[]
  } {
    let modifiedDecision = { ...decision }
    const effects: BiasEffect[] = []
    
    for (const bias of biases) {
      const effect = this.applySpecificBias(
        bias,
        modifiedDecision,
        agent,
        context
      )
      
      if (effect.applied) {
        effects.push(effect)
        // 修改决策
        modifiedDecision = this.modifyDecision(modifiedDecision, effect)
      }
    }
    
    return { modified_decision: modifiedDecision, effects }
  }
  
  /**
   * 应用特定偏差
   */
  private applySpecificBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    switch (bias.type) {
      case 'confirmation':
        return this.applyConfirmationBias(bias, decision, agent, context)
      
      case 'anchoring':
        return this.applyAnchoringBias(bias, decision, agent, context)
      
      case 'availability':
        return this.applyAvailabilityBias(bias, decision, agent, context)
      
      case 'groupthink':
        return this.applyGroupthinkBias(bias, decision, agent, context)
      
      case 'sunk_cost':
        return this.applySunkCostBias(bias, decision, agent, context)
      
      case 'optimism':
        return this.applyOptimismBias(bias, decision, agent, context)
      
      case 'loss_aversion':
        return this.applyLossAversionBias(bias, decision, agent, context)
      
      default:
        return {
          bias_type: bias.type,
          applied: false,
          impact_description: '未应用',
          decision_change: 0
        }
    }
  }
  
  /**
   * 确认偏差：倾向于选择支持现有信念的行动
   */
  private applyConfirmationBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 检查决策是否与核心信念一致
    if (!agent.core_belief) {
      return { bias_type: 'confirmation', applied: false, impact_description: '', decision_change: 0 }
    }
    
    const beliefKeywords = agent.core_belief.toLowerCase().split(' ')
    const decisionAligned = beliefKeywords.some(keyword =>
      decision.reason.toLowerCase().includes(keyword)
    )
    
    if (decisionAligned) {
      // 强化与信念一致的决策
      return {
        bias_type: 'confirmation',
        applied: true,
        impact_description: `强化了与信念"${agent.core_belief}"一致的决策`,
        decision_change: bias.strength * 0.3
      }
    }
    
    return { bias_type: 'confirmation', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 锚定效应：过度依赖第一印象
   */
  private applyAnchoringBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 如果有目标，检查第一印象
    if (decision.target) {
      const firstImpression = agent.relations[decision.target]
      
      if (firstImpression !== undefined) {
        // 第一印象影响当前决策
        if (firstImpression > 0.5 && decision.type === 'compete') {
          return {
            bias_type: 'anchoring',
            applied: true,
            impact_description: `因为对${decision.target}的好印象，降低了竞争倾向`,
            decision_change: -bias.strength * 0.4
          }
        } else if (firstImpression < -0.5 && decision.type === 'help') {
          return {
            bias_type: 'anchoring',
            applied: true,
            impact_description: `因为对${decision.target}的坏印象，降低了帮助倾向`,
            decision_change: -bias.strength * 0.4
          }
        }
      }
    }
    
    return { bias_type: 'anchoring', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 可得性启发：基于容易想起的信息
   */
  private applyAvailabilityBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 检查最近的记忆
    const recentMemories = agent.memory_short.slice(-5)
    
    // 如果最近有负面记忆，倾向于避免风险
    const hasNegativeMemory = recentMemories.some(m =>
      m.emotional_weight < -0.5
    )
    
    if (hasNegativeMemory && (decision.type === 'explore' || decision.type === 'compete')) {
      return {
        bias_type: 'availability',
        applied: true,
        impact_description: '因为最近的负面经历，倾向于避免风险',
        decision_change: -bias.strength * 0.5
      }
    }
    
    return { bias_type: 'availability', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 群体思维：为了和谐而压制异议
   */
  private applyGroupthinkBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 检查是否有多数人支持某个行动
    const { world } = context
    
    // 简化：如果大多数朋友都在做某事，倾向于跟随
    const friends = Object.entries(agent.relations)
      .filter(([_, value]) => value > 0.5)
      .map(([name, _]) => name)
    
    if (friends.length >= 3) {
      // 假设朋友们倾向于合作
      if (decision.type !== 'cooperate' && decision.type !== 'help') {
        return {
          bias_type: 'groupthink',
          applied: true,
          impact_description: '为了与群体保持一致，倾向于合作',
          decision_change: bias.strength * 0.4
        }
      }
    }
    
    return { bias_type: 'groupthink', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 沉没成本谬误：因为已投入而继续
   */
  private applySunkCostBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 检查是否有长期目标
    const { history } = context
    
    // 如果过去一直在追求某个目标，即使不合理也继续
    const pursuingGoal = history.filter(a => a.type === 'pursue_goal').length
    
    if (pursuingGoal >= 3 && decision.type !== 'pursue_goal') {
      return {
        bias_type: 'sunk_cost',
        applied: true,
        impact_description: '因为已经投入很多，倾向于继续追求目标',
        decision_change: bias.strength * 0.5
      }
    }
    
    return { bias_type: 'sunk_cost', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 乐观偏差：高估好结果的概率
   */
  private applyOptimismBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 对于风险行动，高估成功概率
    if (decision.type === 'explore' || decision.type === 'compete') {
      return {
        bias_type: 'optimism',
        applied: true,
        impact_description: '乐观地高估了成功的可能性',
        decision_change: bias.strength * 0.3
      }
    }
    
    return { bias_type: 'optimism', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 损失厌恶：损失的痛苦 > 获得的快乐
   */
  private applyLossAversionBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // 如果决策可能导致损失，倾向于避免
    if (decision.type === 'compete' || decision.type === 'explore') {
      // 检查当前状态
      if (agent.vitals.energy < 0.4 || agent.vitals.stress > 0.6) {
        return {
          bias_type: 'loss_aversion',
          applied: true,
          impact_description: '害怕损失当前状态，倾向于保守',
          decision_change: -bias.strength * 0.6
        }
      }
    }
    
    return { bias_type: 'loss_aversion', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * 修改决策
   */
  private modifyDecision(
    decision: AgentAction,
    effect: BiasEffect
  ): AgentAction {
    // 调整决策强度
    const newIntensity = Math.max(0, Math.min(1, decision.intensity + effect.decision_change))
    
    return {
      ...decision,
      intensity: newIntensity,
      reason: `${decision.reason}（受${this.getBiasName(effect.bias_type)}影响）`
    }
  }
  
  /**
   * 获取偏差名称
   */
  private getBiasName(type: BiasType): string {
    const names: Record<BiasType, string> = {
      confirmation: '确认偏差',
      anchoring: '锚定效应',
      availability: '可得性启发',
      groupthink: '群体思维',
      sunk_cost: '沉没成本谬误',
      optimism: '乐观偏差',
      loss_aversion: '损失厌恶'
    }
    return names[type]
  }
  
  /**
   * 检测偏差触发
   */
  detectBiasTrigger(
    context: string,
    bias: CognitiveBias
  ): boolean {
    return bias.triggers.some(trigger =>
      context.toLowerCase().includes(trigger.toLowerCase())
    )
  }
  
  /**
   * 获取统计信息
   */
  getStats(agents: PersonalAgentState[]): {
    bias_distribution: Map<BiasType, number>
    avg_bias_strength: number
    most_common_bias: BiasType
  } {
    const distribution = new Map<BiasType, number>()
    let totalStrength = 0
    let totalCount = 0
    
    for (const agent of agents) {
      const biases = this.assignBiases(agent)
      
      for (const bias of biases) {
        distribution.set(bias.type, (distribution.get(bias.type) || 0) + 1)
        totalStrength += bias.strength
        totalCount++
      }
    }
    
    const mostCommon = Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])[0]
    
    return {
      bias_distribution: distribution,
      avg_bias_strength: totalCount > 0 ? totalStrength / totalCount : 0,
      most_common_bias: mostCommon ? mostCommon[0] : 'confirmation'
    }
  }
}
