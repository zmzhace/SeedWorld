/**
 * Reputation system - produces the richest social dynamics
 * Core: actions affect reputation, reputation affects how others treat you
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type ReputationDimension = {
  trustworthiness: number  // trustworthiness [0-1]
  competence: number       // competence [0-1]
  benevolence: number      // benevolence [0-1]
  status: number           // status [0-1]
  influence: number        // influence [0-1]
}

export type ReputationEvent = {
  tick: number
  action_type: string
  impact: Partial<ReputationDimension>
  witnesses: string[]  // witnesses
  description: string
}

export type Reputation = ReputationDimension & {
  agent_id: string
  history: ReputationEvent[]
  last_updated: number
  decay_rate: number  // decay rate
}

export type ReputationQuery = {
  observer_id: string  // observer
  target_id: string    // target
  perspective: Reputation  // reputation from observer's perspective
  confidence: number   // confidence level
}

export class ReputationSystem {
  private reputations: Map<string, Reputation> = new Map()
  private socialNetwork: Map<string, Set<string>> = new Map()  // social network graph
  
  /**
   * Initialize agent reputation
   */
  initializeReputation(agent: PersonalAgentState): Reputation {
    const reputation: Reputation = {
      agent_id: agent.genetics.seed,
      trustworthiness: 0.5,
      competence: 0.5,
      benevolence: 0.5,
      status: 0.3,
      influence: 0.2,
      history: [],
      last_updated: 0,
      decay_rate: 0.01
    }
    
    this.reputations.set(agent.genetics.seed, reputation)
    return reputation
  }
  
  /**
   * Update reputation (based on action)
   */
  updateReputation(
    agent: PersonalAgentState,
    action: {
      type: string
      target?: string
      success: boolean
      witnesses: string[]
    },
    currentTick: number
  ): Reputation {
    let reputation = this.reputations.get(agent.genetics.seed)
    if (!reputation) {
      reputation = this.initializeReputation(agent)
    }
    
    // Calculate reputation impact based on action type
    const impact = this.calculateReputationImpact(action, agent)
    
    // Apply impact
    reputation.trustworthiness = this.clamp(
      reputation.trustworthiness + (impact.trustworthiness || 0)
    )
    reputation.competence = this.clamp(
      reputation.competence + (impact.competence || 0)
    )
    reputation.benevolence = this.clamp(
      reputation.benevolence + (impact.benevolence || 0)
    )
    reputation.status = this.clamp(
      reputation.status + (impact.status || 0)
    )
    reputation.influence = this.clamp(
      reputation.influence + (impact.influence || 0)
    )
    
    // Record event
    const event: ReputationEvent = {
      tick: currentTick,
      action_type: action.type,
      impact,
      witnesses: action.witnesses,
      description: this.generateEventDescription(action, agent)
    }
    
    reputation.history.push(event)
    reputation.last_updated = currentTick
    
    // Propagate reputation (through witnesses)
    this.propagateReputation(agent.genetics.seed, event, action.witnesses)
    
    return reputation
  }
  
  /**
   * Calculate action's impact on reputation
   */
  private calculateReputationImpact(
    action: { type: string; target?: string; success: boolean },
    agent: PersonalAgentState
  ): Partial<ReputationDimension> {
    const impact: Partial<ReputationDimension> = {}
    
    switch (action.type) {
      case 'help':
        impact.benevolence = action.success ? 0.05 : -0.02
        impact.trustworthiness = action.success ? 0.03 : 0
        impact.status = 0.02
        break
        
      case 'compete':
        impact.competence = action.success ? 0.05 : -0.03
        impact.status = action.success ? 0.04 : -0.02
        impact.benevolence = -0.01
        break
        
      case 'betray':
        impact.trustworthiness = -0.15
        impact.benevolence = -0.10
        impact.status = -0.05
        break
        
      case 'cooperate':
        impact.trustworthiness = 0.04
        impact.benevolence = 0.03
        impact.influence = 0.02
        break
        
      case 'lead':
        impact.influence = action.success ? 0.06 : -0.03
        impact.status = action.success ? 0.05 : -0.02
        impact.competence = action.success ? 0.03 : 0
        break
        
      case 'teach':
        impact.competence = 0.04
        impact.benevolence = 0.03
        impact.influence = 0.02
        break
        
      case 'deceive':
        impact.trustworthiness = -0.10
        impact.benevolence = -0.05
        break
        
      case 'achieve_goal':
        impact.competence = 0.05
        impact.status = 0.03
        break
        
      case 'fail_goal':
        impact.competence = -0.03
        break
        
      default:
        // Default minor impact
        impact.trustworthiness = action.success ? 0.01 : -0.01
    }
    
    return impact
  }
  
  /**
   * Propagate reputation (through social network)
   */
  private propagateReputation(
    agentId: string,
    event: ReputationEvent,
    witnesses: string[]
  ): void {
    const decayFactor = 0.3

    // Witnesses propagate to their friends
    for (const witness of witnesses) {
      const friends = this.socialNetwork.get(witness) || new Set()

      // Propagate to friends (with decay)
      for (const friend of friends) {
        // Don't propagate back to the original agent or to other witnesses
        if (friend === agentId || witnesses.includes(friend)) continue

        let reputation = this.reputations.get(agentId)
        if (!reputation) continue

        // Apply decayed impact
        const decayedImpact: Partial<ReputationDimension> = {}
        for (const [dim, delta] of Object.entries(event.impact)) {
          if (typeof delta === 'number') {
            const decayedDelta = delta * decayFactor
            const safeDim = dim as keyof ReputationDimension
            reputation[safeDim] = this.clamp(reputation[safeDim] + decayedDelta)
            decayedImpact[safeDim] = decayedDelta
          }
        }

        // Record hearsay event
        const hearsayEvent: ReputationEvent = {
          tick: event.tick,
          action_type: 'hearsay',
          impact: decayedImpact,
          witnesses: [friend],
          description: `Heard from others: ${event.description}`,
        }
        reputation.history.push(hearsayEvent)
      }
    }
  }
  
  /**
   * Query reputation (from observer's perspective)
   */
  queryReputation(
    observerId: string,
    targetId: string,
    world: WorldSlice
  ): ReputationQuery {
    const baseReputation = this.reputations.get(targetId)
    
    if (!baseReputation) {
      // No reputation info, return defaults
      return {
        observer_id: observerId,
        target_id: targetId,
        perspective: {
          agent_id: targetId,
          trustworthiness: 0.5,
          competence: 0.5,
          benevolence: 0.5,
          status: 0.3,
          influence: 0.2,
          history: [],
          last_updated: 0,
          decay_rate: 0.01
        },
        confidence: 0.1  // low confidence
      }
    }
    
    // Calculate observer's perspective
    const perspective = this.calculatePerspective(
      observerId,
      targetId,
      baseReputation,
      world
    )
    
    // Calculate confidence level
    const confidence = this.calculateConfidence(observerId, targetId, baseReputation)
    
    return {
      observer_id: observerId,
      target_id: targetId,
      perspective,
      confidence
    }
  }
  
  /**
   * Calculate reputation from observer's perspective
   */
  private calculatePerspective(
    observerId: string,
    targetId: string,
    baseReputation: Reputation,
    world: WorldSlice
  ): Reputation {
    // Base reputation
    const perspective = { ...baseReputation }
    
    // Adjust based on observer-target relationship
    const observer = world.agents.npcs.find(a => a.genetics.seed === observerId)
    if (observer) {
      const relationship = observer.relations[targetId] || 0
      
      // Good relationship overestimates reputation
      if (relationship > 0.5) {
        perspective.trustworthiness = Math.min(1, perspective.trustworthiness + 0.1)
        perspective.benevolence = Math.min(1, perspective.benevolence + 0.1)
      } else if (relationship < -0.5) {
        // Bad relationship underestimates reputation
        perspective.trustworthiness = Math.max(0, perspective.trustworthiness - 0.1)
        perspective.benevolence = Math.max(0, perspective.benevolence - 0.1)
      }
    }
    
    return perspective
  }
  
  /**
   * Calculate confidence level
   */
  private calculateConfidence(
    observerId: string,
    targetId: string,
    reputation: Reputation
  ): number {
    // Based on number of historical events
    const eventCount = reputation.history.length
    let confidence = Math.min(1, eventCount / 20)
    
    // Based on whether observer is a direct witness
    const directWitness = reputation.history.some(event =>
      event.witnesses.includes(observerId)
    )
    
    if (directWitness) {
      confidence = Math.min(1, confidence + 0.3)
    }
    
    // Based on time decay
    const ticksSinceUpdate = Date.now() - reputation.last_updated
    const timeFactor = Math.exp(-ticksSinceUpdate / 1000)
    confidence *= timeFactor
    
    return confidence
  }
  
  /**
   * Reputation decay (over time)
   */
  applyDecay(currentTick: number): void {
    for (const [agentId, reputation] of this.reputations) {
      const ticksSinceUpdate = currentTick - reputation.last_updated
      
      if (ticksSinceUpdate > 10) {
        // Decay towards neutral value
        reputation.trustworthiness = this.decayTowards(reputation.trustworthiness, 0.5, reputation.decay_rate)
        reputation.competence = this.decayTowards(reputation.competence, 0.5, reputation.decay_rate)
        reputation.benevolence = this.decayTowards(reputation.benevolence, 0.5, reputation.decay_rate)
        reputation.status = this.decayTowards(reputation.status, 0.3, reputation.decay_rate)
        reputation.influence = this.decayTowards(reputation.influence, 0.2, reputation.decay_rate)
      }
    }
  }
  
  /**
   * Decay towards target value
   */
  private decayTowards(current: number, target: number, rate: number): number {
    return current + (target - current) * rate
  }
  
  /**
   * Update social network
   */
  updateSocialNetwork(world: WorldSlice): void {
    this.socialNetwork.clear()
    
    for (const agent of world.agents.npcs) {
      const friends = new Set<string>()
      
      // Relationship > 0.3 counts as friend
      for (const [target, value] of Object.entries(agent.relations)) {
        if (value > 0.3) {
          friends.add(target)
        }
      }
      
      this.socialNetwork.set(agent.genetics.seed, friends)
    }
  }
  
  /**
   * Get reputation ranking
   */
  getReputationRanking(dimension: keyof ReputationDimension): Array<{
    agent_id: string
    score: number
  }> {
    return Array.from(this.reputations.values())
      .map(rep => ({
        agent_id: rep.agent_id,
        score: rep[dimension]
      }))
      .sort((a, b) => b.score - a.score)
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const reputations = Array.from(this.reputations.values())
    
    return {
      total_agents: reputations.length,
      avg_trustworthiness: this.average(reputations.map(r => r.trustworthiness)),
      avg_competence: this.average(reputations.map(r => r.competence)),
      avg_benevolence: this.average(reputations.map(r => r.benevolence)),
      avg_status: this.average(reputations.map(r => r.status)),
      avg_influence: this.average(reputations.map(r => r.influence)),
      total_events: reputations.reduce((sum, r) => sum + r.history.length, 0)
    }
  }
  
  // Helper methods
  private clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(max, value))
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }
  
  private generateEventDescription(
    action: { type: string; target?: string; success: boolean },
    agent: PersonalAgentState
  ): string {
    const name = agent.identity.name
    const result = action.success ? 'success' : 'failure'

    switch (action.type) {
      case 'help':
        return `${name} helped ${action.target || 'others'} (${result})`
      case 'compete':
        return `${name} competed with ${action.target || 'others'} (${result})`
      case 'betray':
        return `${name} betrayed ${action.target || 'others'}`
      case 'cooperate':
        return `${name} cooperated with ${action.target || 'others'} (${result})`
      case 'lead':
        return `${name} led an action (${result})`
      case 'teach':
        return `${name} taught ${action.target || 'others'}`
      case 'deceive':
        return `${name} deceived ${action.target || 'others'}`
      default:
        return `${name} performed ${action.type} (${result})`
    }
  }
  
  /**
   * Get all reputations
   */
  getAllReputations(): Map<string, Reputation> {
    return this.reputations
  }

  /**
   * Get overall influence score for an agent (used by other systems)
   */
  getInfluence(agentId: string): number {
    const rep = this.reputations.get(agentId)
    if (!rep) return 0
    return rep.influence
  }

  /**
   * Update reputation from LLM feedback (system_feedback.reputation_impact)
   */
  updateFromLLMFeedback(
    agentId: string,
    impacts: { dimension: string; delta: number; reason: string }[],
    witnesses: string[],
    currentTick: number
  ): void {
    let reputation = this.reputations.get(agentId)
    if (!reputation) {
      reputation = {
        agent_id: agentId,
        trustworthiness: 0.5,
        competence: 0.5,
        benevolence: 0.5,
        status: 0.3,
        influence: 0.2,
        history: [],
        last_updated: 0,
        decay_rate: 0.01,
      }
      this.reputations.set(agentId, reputation)
    }

    const impact: Partial<ReputationDimension> = {}
    const reasons: string[] = []

    for (const { dimension, delta, reason } of impacts) {
      const safeDelta = this.clamp(delta, -0.15, 0.15)
      const dim = dimension as keyof ReputationDimension
      if (dim in reputation && typeof reputation[dim] === 'number') {
        reputation[dim] = this.clamp(reputation[dim] + safeDelta)
        impact[dim] = safeDelta
        if (reason) reasons.push(reason)
      }
    }

    reputation.history.push({
      tick: currentTick,
      action_type: 'llm_feedback',
      impact,
      witnesses,
      description: reasons.join('; ') || 'LLM-reported reputation change',
    })
    reputation.last_updated = currentTick

    this.propagateReputation(agentId, reputation.history[reputation.history.length - 1], witnesses)
  }

  /**
   * Export snapshot (JSON serializable)
   */
  toSnapshot(): { reputations: Record<string, Reputation>; socialNetwork: Record<string, string[]> } {
    const reputations: Record<string, Reputation> = {}
    for (const [id, rep] of this.reputations) {
      reputations[id] = rep
    }
    const socialNetwork: Record<string, string[]> = {}
    for (const [id, friends] of this.socialNetwork) {
      socialNetwork[id] = Array.from(friends)
    }
    return { reputations, socialNetwork }
  }

  /**
   * Restore from snapshot
   */
  fromSnapshot(snapshot: { reputations: Record<string, Reputation>; socialNetwork: Record<string, string[]> }): void {
    this.reputations.clear()
    for (const [id, rep] of Object.entries(snapshot.reputations)) {
      this.reputations.set(id, rep)
    }
    this.socialNetwork.clear()
    for (const [id, friends] of Object.entries(snapshot.socialNetwork)) {
      this.socialNetwork.set(id, new Set(friends))
    }
  }
}
