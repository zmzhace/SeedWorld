/**
 * Cognitive bias system - most effective at improving realism
 * Core: Agents are not fully rational, they are affected by various cognitive biases
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { AgentAction } from './agent-decision-maker'

export type BiasType = 
  | 'confirmation'      // confirmation bias
  | 'anchoring'         // anchoring effect
  | 'availability'      // availability heuristic
  | 'groupthink'        // groupthink
  | 'sunk_cost'         // sunk cost fallacy
  | 'optimism'          // optimism bias
  | 'loss_aversion'     // loss aversion

export type CognitiveBias = {
  type: BiasType
  strength: number  // bias strength [0-1]
  description: string
  triggers: string[]  // trigger conditions
}

export type BiasEffect = {
  bias_type: BiasType
  applied: boolean
  impact_description: string
  decision_change: number  // degree of decision change [-1, 1]
}

export class CognitiveBiasSystem {
  // Assign cognitive biases to agent
  assignBiases(agent: PersonalAgentState): CognitiveBias[] {
    const biases: CognitiveBias[] = []

    // Based on personality traits
    // High openness -> less confirmation bias
    if (agent.persona.openness < 0.5) {
      biases.push({
        type: 'confirmation',
        strength: 0.7 - agent.persona.openness,
        description: 'Tends to seek information supporting own views',
        triggers: ['decision_making', 'information_processing']
      })
    }

    // Low stability -> stronger availability heuristic
    if (agent.persona.stability < 0.5) {
      biases.push({
        type: 'availability',
        strength: 0.8 - agent.persona.stability,
        description: 'Judges based on easily recalled information',
        triggers: ['risk_assessment', 'probability_estimation']
      })
    }

    // High attachment -> groupthink
    if (agent.persona.attachment > 0.6) {
      biases.push({
        type: 'groupthink',
        strength: agent.persona.attachment * 0.7,
        description: 'Suppresses dissent for group harmony',
        triggers: ['group_decision', 'social_pressure']
      })
    }

    // Low agency -> sunk cost fallacy
    if (agent.persona.agency < 0.5) {
      biases.push({
        type: 'sunk_cost',
        strength: 0.7 - agent.persona.agency,
        description: 'Continues wrong decisions due to prior investment',
        triggers: ['project_continuation', 'relationship_maintenance']
      })
    }

    // High openness + high agency -> optimism bias
    if (agent.persona.openness > 0.6 && agent.persona.agency > 0.6) {
      biases.push({
        type: 'optimism',
        strength: (agent.persona.openness + agent.persona.agency) / 2 * 0.6,
        description: 'Overestimates probability of good outcomes',
        triggers: ['planning', 'risk_taking']
      })
    }

    // Everyone has loss aversion (varying degrees)
    biases.push({
      type: 'loss_aversion',
      strength: 0.5 + Math.random() * 0.3,
      description: 'Pain of loss exceeds joy of gain',
      triggers: ['trade', 'risk_decision']
    })

    // Anchoring effect (universal)
    biases.push({
      type: 'anchoring',
      strength: 0.4 + Math.random() * 0.4,
      description: 'Over-relies on first impressions',
      triggers: ['first_impression', 'negotiation']
    })
    
    return biases
  }
  
  /**
   * Apply biases to decision
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
        // Modify decision
        modifiedDecision = this.modifyDecision(modifiedDecision, effect)
      }
    }
    
    return { modified_decision: modifiedDecision, effects }
  }
  
  /**
   * Apply specific bias
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
          impact_description: 'Not applied',
          decision_change: 0
        }
    }
  }
  
  /**
   * Confirmation bias: tends to choose actions supporting existing beliefs
   */
  private applyConfirmationBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // Check if decision aligns with core belief
    if (!agent.core_belief) {
      return { bias_type: 'confirmation', applied: false, impact_description: '', decision_change: 0 }
    }
    
    const beliefKeywords = agent.core_belief.toLowerCase().split(' ')
    const decisionAligned = beliefKeywords.some(keyword =>
      decision.reason.toLowerCase().includes(keyword)
    )
    
    if (decisionAligned) {
      // Reinforce decision aligned with belief
      return {
        bias_type: 'confirmation',
        applied: true,
        impact_description: `Reinforced decision aligned with belief "${agent.core_belief}"`,
        decision_change: bias.strength * 0.3
      }
    }
    
    return { bias_type: 'confirmation', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Anchoring effect: over-relies on first impressions
   */
  private applyAnchoringBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // If there's a target, check first impression
    if (decision.target) {
      const firstImpression = agent.relations[decision.target]
      
      if (firstImpression !== undefined) {
        // First impression affects current decision
        if (firstImpression > 0.5 && decision.type === 'compete') {
          return {
            bias_type: 'anchoring',
            applied: true,
            impact_description: `Reduced competitive tendency due to positive impression of ${decision.target}`,
            decision_change: -bias.strength * 0.4
          }
        } else if (firstImpression < -0.5 && decision.type === 'help') {
          return {
            bias_type: 'anchoring',
            applied: true,
            impact_description: `Reduced helping tendency due to negative impression of ${decision.target}`,
            decision_change: -bias.strength * 0.4
          }
        }
      }
    }
    
    return { bias_type: 'anchoring', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Availability heuristic: judges based on easily recalled information
   */
  private applyAvailabilityBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // Check recent memories
    const recentMemories = agent.memory_short.slice(-5)
    
    // If recent negative memories, tend to avoid risk
    const hasNegativeMemory = recentMemories.some(m =>
      m.emotional_weight < -0.5
    )
    
    if (hasNegativeMemory && (decision.type === 'explore' || decision.type === 'compete')) {
      return {
        bias_type: 'availability',
        applied: true,
        impact_description: 'Tends to avoid risk due to recent negative experiences',
        decision_change: -bias.strength * 0.5
      }
    }
    
    return { bias_type: 'availability', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Groupthink: suppresses dissent for harmony
   */
  private applyGroupthinkBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // Check if majority supports a certain action
    const { world } = context
    
    // Simplified: if most friends are doing something, tend to follow
    const friends = Object.entries(agent.relations)
      .filter(([_, value]) => value > 0.5)
      .map(([name, _]) => name)
    
    if (friends.length >= 3) {
      // Assume friends tend to cooperate
      if ((decision.type as string) !== 'cooperate' && decision.type !== 'help') {
        return {
          bias_type: 'groupthink',
          applied: true,
          impact_description: 'Tends to cooperate to stay aligned with group',
          decision_change: bias.strength * 0.4
        }
      }
    }
    
    return { bias_type: 'groupthink', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Sunk cost fallacy: continues due to prior investment
   */
  private applySunkCostBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // Check if there's a long-term goal
    const { history } = context
    
    // If been pursuing a goal for a while, continue even if unreasonable
    const pursuingGoal = history.filter((a: AgentAction) => a.type === 'pursue_goal').length
    
    if (pursuingGoal >= 3 && decision.type !== 'pursue_goal') {
      return {
        bias_type: 'sunk_cost',
        applied: true,
        impact_description: 'Tends to continue pursuing goal due to prior investment',
        decision_change: bias.strength * 0.5
      }
    }
    
    return { bias_type: 'sunk_cost', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Optimism bias: overestimates probability of good outcomes
   */
  private applyOptimismBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // For risky actions, overestimate success probability
    if (decision.type === 'explore' || decision.type === 'compete') {
      return {
        bias_type: 'optimism',
        applied: true,
        impact_description: 'Optimistically overestimated chance of success',
        decision_change: bias.strength * 0.3
      }
    }
    
    return { bias_type: 'optimism', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Loss aversion: pain of loss > joy of gain
   */
  private applyLossAversionBias(
    bias: CognitiveBias,
    decision: AgentAction,
    agent: PersonalAgentState,
    context: any
  ): BiasEffect {
    // If decision may cause loss, tend to avoid
    if (decision.type === 'compete' || decision.type === 'explore') {
      // Check current state
      if (agent.vitals.energy < 0.4 || agent.vitals.stress > 0.6) {
        return {
          bias_type: 'loss_aversion',
          applied: true,
          impact_description: 'Fears losing current state, tends to be conservative',
          decision_change: -bias.strength * 0.6
        }
      }
    }
    
    return { bias_type: 'loss_aversion', applied: false, impact_description: '', decision_change: 0 }
  }
  
  /**
   * Modify decision
   */
  private modifyDecision(
    decision: AgentAction,
    effect: BiasEffect
  ): AgentAction {
    // Adjust decision intensity
    const newIntensity = Math.max(0, Math.min(1, decision.intensity + effect.decision_change))
    
    return {
      ...decision,
      intensity: newIntensity,
      reason: `${decision.reason} (affected by ${effect.bias_type})`
    }
  }
  
  /**
   * Get bias name
   */
  private getBiasName(type: BiasType): string {
    const names: Record<BiasType, string> = {
      confirmation: 'confirmation bias',
      anchoring: 'anchoring effect',
      availability: 'availability heuristic',
      groupthink: 'groupthink',
      sunk_cost: 'sunk cost fallacy',
      optimism: 'optimism bias',
      loss_aversion: 'loss aversion'
    }
    return names[type]
  }
  
  /**
   * Detect bias trigger
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
   * Get statistics
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

  /**
   * Record LLM-perceived bias (system_feedback.perceived_bias)
   * Analysis layer — tracks what biases agents self-report
   */
  private perceivedBiases: Map<string, { bias: string; tick: number }[]> = new Map()

  recordBias(agentId: string, biasName: string, tick: number): void {
    const history = this.perceivedBiases.get(agentId) || []
    history.push({ bias: biasName, tick })
    // Keep last 20 entries
    if (history.length > 20) history.shift()
    this.perceivedBiases.set(agentId, history)
  }

  getPerceivedBiases(agentId: string): { bias: string; tick: number }[] {
    return this.perceivedBiases.get(agentId) || []
  }

  toSnapshot(): { perceivedBiases: Record<string, { bias: string; tick: number }[]> } {
    const perceivedBiases: Record<string, { bias: string; tick: number }[]> = {}
    for (const [agentId, entries] of this.perceivedBiases) {
      perceivedBiases[agentId] = entries
    }
    return { perceivedBiases }
  }

  fromSnapshot(snapshot: { perceivedBiases: Record<string, { bias: string; tick: number }[]> }): void {
    this.perceivedBiases.clear()
    for (const [agentId, entries] of Object.entries(snapshot.perceivedBiases)) {
      this.perceivedBiases.set(agentId, entries)
    }
  }
}
