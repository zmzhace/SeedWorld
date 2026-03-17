/**
 * Dramatic Tension System - makes stories compelling
 * Core: actively create and maintain dramatic tension for engaging narratives
 */

import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import type { NarrativePattern } from '@/domain/narrative'

export type TensionType =
  | 'suspense'       // suspense
  | 'surprise'       // surprise
  | 'curiosity'      // curiosity
  | 'conflict'       // conflict
  | 'time_pressure'  // time pressure

export type DramaticTension = {
  id: string
  type: TensionType
  level: number  // tension level [0-1]
  source: string  // tension source
  target_agents: string[]  // affected agents
  buildup_rate: number  // accumulation speed
  release_condition: string  // release condition
  created_at: number  // creation time
  peak_at?: number  // peak time
  resolved_at?: number  // resolution time
  status: 'building' | 'peak' | 'released' | 'fading'
}

export type TensionEvent = {
  tension_id: string
  tick: number
  type: 'created' | 'buildup' | 'peak' | 'released'
  description: string
}

export class DramaticTensionSystem {
  private tensions: Map<string, DramaticTension> = new Map()
  private events: TensionEvent[] = []
  private tensionCounter = 0

  /**
   * Detect and create tension
   */
  detectAndCreateTension(
    world: WorldSlice,
    narratives: NarrativePattern[]
  ): DramaticTension[] {
    const newTensions: DramaticTension[] = []

    // 1. Create tension from conflict narratives
    const conflictNarratives = narratives.filter(n => n.type === 'conflict')
    for (const narrative of conflictNarratives) {
      if (narrative.status === 'developing') {
        const tension = this.createConflictTension(narrative, world.tick)
        newTensions.push(tension)
      }
    }

    // 2. Create tension from agent relationships
    for (const agent of world.agents.npcs) {
      // Detect negative relationships
      for (const [target, value] of Object.entries(agent.relations)) {
        if (value < -0.7) {
          const tension = this.createRelationshipTension(agent, target, world.tick)
          newTensions.push(tension)
        }
      }

      // Detect goal conflicts
      const conflictingGoals = this.detectGoalConflicts(agent, world.agents.npcs)
      for (const conflict of conflictingGoals) {
        const tension = this.createGoalConflictTension(agent, conflict, world.tick)
        newTensions.push(tension)
      }
    }

    // 3. Create tension from resource scarcity
    const scarcityTension = this.createScarcityTension(world)
    if (scarcityTension) {
      newTensions.push(scarcityTension)
    }

    // 4. Create suspense (random events)
    if (world.agents.npcs.length > 0 && Math.random() < 0.1) {
      const suspenseTension = this.createSuspenseTension(world)
      newTensions.push(suspenseTension)
    }

    // 5. Create time pressure
    const urgentNarratives = narratives.filter(n =>
      n.status === 'climax' || n.intensity > 0.8
    )
    for (const narrative of urgentNarratives) {
      const tension = this.createTimePressureTension(narrative, world.tick)
      newTensions.push(tension)
    }

    // Add to system
    for (const tension of newTensions) {
      this.tensions.set(tension.id, tension)
      this.events.push({
        tension_id: tension.id,
        tick: world.tick,
        type: 'created',
        description: `Created ${tension.type} tension`
      })
    }

    return newTensions
  }

  /**
   * Create conflict tension
   */
  private createConflictTension(
    narrative: NarrativePattern,
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'conflict',
      level: narrative.intensity * 0.7,
      source: `Narrative conflict: ${narrative.type} (${narrative.participants.length} participants)`,
      target_agents: narrative.participants,
      buildup_rate: 0.05,
      release_condition: 'Conflict resolved or one party withdraws',
      created_at: currentTick,
      status: 'building'
    }
  }

  /**
   * Create relationship tension
   */
  private createRelationshipTension(
    agent: PersonalAgentState,
    target: string,
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'conflict',
      level: 0.6,
      source: `Deteriorating relationship between ${agent.identity.name} and ${target}`,
      target_agents: [agent.genetics.seed, target],
      buildup_rate: 0.03,
      release_condition: 'Relationship improves or conflict erupts',
      created_at: currentTick,
      status: 'building'
    }
  }

  /**
   * Detect goal conflicts
   */
  private detectGoalConflicts(
    agent: PersonalAgentState,
    allAgents: PersonalAgentState[]
  ): Array<{ agent: PersonalAgentState; conflictingGoal: string }> {
    const conflicts: Array<{ agent: PersonalAgentState; conflictingGoal: string }> = []

    for (const otherAgent of allAgents) {
      if (otherAgent.genetics.seed === agent.genetics.seed) continue

      // Check if goals conflict
      for (const goal of agent.goals) {
        for (const otherGoal of otherAgent.goals) {
          if (this.goalsConflict(goal, otherGoal)) {
            conflicts.push({
              agent: otherAgent,
              conflictingGoal: otherGoal
            })
          }
        }
      }
    }

    return conflicts
  }

  /**
   * Determine if goals conflict (language-agnostic)
   */
  private goalsConflict(goal1: string, goal2: string): boolean {
    // Language-agnostic: goals conflict if they are similar (potential competition)
    // Simple heuristic: if goals share significant overlap, they may conflict
    const words1 = new Set(goal1.toLowerCase().split(/\s+/))
    const words2 = new Set(goal2.toLowerCase().split(/\s+/))
    let overlap = 0
    for (const w of words1) {
      if (words2.has(w) && w.length > 2) overlap++
    }
    return overlap >= 2
  }

  /**
   * Create goal conflict tension
   */
  private createGoalConflictTension(
    agent: PersonalAgentState,
    conflict: { agent: PersonalAgentState; conflictingGoal: string },
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'conflict',
      level: 0.5,
      source: `Goal conflict between ${agent.identity.name} and ${conflict.agent.identity.name}`,
      target_agents: [agent.genetics.seed, conflict.agent.genetics.seed],
      buildup_rate: 0.04,
      release_condition: 'One party abandons goal or compromise reached',
      created_at: currentTick,
      status: 'building'
    }
  }

  /**
   * Create scarcity tension
   */
  private createScarcityTension(world: WorldSlice): DramaticTension | null {
    // Check for resource pressure
    const lowEnergyAgents = world.agents.npcs.filter(a => a.vitals.energy < 0.3)

    if (lowEnergyAgents.length > world.agents.npcs.length * 0.3) {
      return {
        id: `tension-${this.tensionCounter++}`,
        type: 'conflict',
        level: 0.7,
        source: 'Competition due to resource scarcity',
        target_agents: lowEnergyAgents.map(a => a.genetics.seed),
        buildup_rate: 0.06,
        release_condition: 'Resources replenished or some agents withdraw',
        created_at: world.tick,
        status: 'building'
      }
    }

    return null
  }

  /**
   * Create suspense tension
   */
  private createSuspenseTension(world: WorldSlice): DramaticTension {
    const randomAgent = world.agents.npcs[Math.floor(Math.random() * world.agents.npcs.length)]

    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'suspense',
      level: 0.4,
      source: `Mysterious activity of ${randomAgent.identity.name}`,
      target_agents: [randomAgent.genetics.seed],
      buildup_rate: 0.08,
      release_condition: 'Truth revealed',
      created_at: world.tick,
      status: 'building'
    }
  }

  /**
   * Create time pressure tension
   */
  private createTimePressureTension(
    narrative: NarrativePattern,
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'time_pressure',
      level: narrative.intensity,
      source: `${narrative.type} narrative reaching critical moment`,
      target_agents: narrative.participants,
      buildup_rate: 0.1,
      release_condition: 'Deadline reached or resolved early',
      created_at: currentTick,
      status: 'building'
    }
  }

  /**
   * Build up tension
   */
  buildupTension(
    tensionId: string,
    events: WorldSlice['events'],
    currentTick: number
  ): void {
    const tension = this.tensions.get(tensionId)
    if (!tension || tension.status === 'released') return

    // Accumulate tension
    tension.level = Math.min(1, tension.level + tension.buildup_rate)

    // Check if peak reached
    if (tension.level >= 0.9 && tension.status === 'building') {
      tension.status = 'peak'
      tension.peak_at = currentTick

      this.events.push({
        tension_id: tensionId,
        tick: currentTick,
        type: 'peak',
        description: `${tension.type} tension reached peak`
      })
    }

    // Record buildup event
    if (tension.level > 0.5 && Math.random() < 0.2) {
      this.events.push({
        tension_id: tensionId,
        tick: currentTick,
        type: 'buildup',
        description: `${tension.type} tension building up`
      })
    }
  }

  /**
   * Release tension
   */
  releaseTension(
    tensionId: string,
    resolution: string,
    currentTick: number
  ): void {
    const tension = this.tensions.get(tensionId)
    if (!tension) return

    tension.status = 'released'
    tension.resolved_at = currentTick
    tension.level = 0

    this.events.push({
      tension_id: tensionId,
      tick: currentTick,
      type: 'released',
      description: `Tension released: ${resolution}`
    })
  }

  /**
   * Check tension release conditions
   */
  checkReleaseConditions(
    world: WorldSlice,
    narratives: NarrativePattern[]
  ): void {
    for (const [id, tension] of this.tensions) {
      if (tension.status === 'released') continue

      // Check if narrative has concluded
      if (tension.type === 'conflict') {
        const relatedNarrative = narratives.find(n =>
          n.participants.some(p => tension.target_agents.includes(p))
        )

        if (relatedNarrative && relatedNarrative.status === 'concluded') {
          this.releaseTension(id, 'Conflict resolved', world.tick)
        }
      }

      // Check if relationship improved
      if (tension.target_agents.length === 2) {
        const [agent1Id, agent2Id] = tension.target_agents
        const agent1 = world.agents.npcs.find(a => a.genetics.seed === agent1Id)

        if (agent1 && agent1.relations[agent2Id] > 0.5) {
          this.releaseTension(id, 'Relationship improved', world.tick)
        }
      }

      // Auto-decay after peak
      if (tension.status === 'peak' && tension.peak_at) {
        const ticksSincePeak = world.tick - tension.peak_at
        if (ticksSincePeak > 5) {
          tension.status = 'fading'
          tension.level = Math.max(0, tension.level - 0.1)

          if (tension.level < 0.1) {
            this.releaseTension(id, 'Tension naturally faded', world.tick)
          }
        }
      }
    }
  }

  /**
   * Calculate overall tension
   */
  calculateOverallTension(world: WorldSlice): number {
    const activeTensions = Array.from(this.tensions.values()).filter(
      t => t.status !== 'released'
    )

    if (activeTensions.length === 0) return 0

    // Weighted average
    const totalWeight = activeTensions.reduce((sum, t) => {
      const weight = t.status === 'peak' ? 2 : 1
      return sum + t.level * weight
    }, 0)

    const totalWeightCount = activeTensions.reduce((sum, t) => {
      return sum + (t.status === 'peak' ? 2 : 1)
    }, 0)

    return totalWeight / totalWeightCount
  }

  /**
   * Get tension rhythm
   */
  getTensionRhythm(windowSize: number = 10): Array<{
    tick: number
    tension: number
  }> {
    const rhythm: Array<{ tick: number; tension: number }> = []

    // Calculate from event history
    const recentEvents = this.events.slice(-windowSize)

    const tickMap = new Map<number, number>()
    for (const event of recentEvents) {
      const current = tickMap.get(event.tick) || 0

      switch (event.type) {
        case 'created':
          tickMap.set(event.tick, current + 0.2)
          break
        case 'buildup':
          tickMap.set(event.tick, current + 0.1)
          break
        case 'peak':
          tickMap.set(event.tick, current + 0.5)
          break
        case 'released':
          tickMap.set(event.tick, current - 0.3)
          break
      }
    }

    for (const [tick, tension] of tickMap) {
      rhythm.push({ tick, tension })
    }

    return rhythm.sort((a, b) => a.tick - b.tick)
  }

  /**
   * Create surprise event
   */
  createSurprise(
    world: WorldSlice,
    description: string
  ): DramaticTension {
    const randomAgents = world.agents.npcs
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(a => a.genetics.seed)

    const tension: DramaticTension = {
      id: `tension-${this.tensionCounter++}`,
      type: 'surprise',
      level: 0.8,
      source: description,
      target_agents: randomAgents,
      buildup_rate: 0,
      release_condition: 'Immediate release',
      created_at: world.tick,
      status: 'peak'
    }

    this.tensions.set(tension.id, tension)

    this.events.push({
      tension_id: tension.id,
      tick: world.tick,
      type: 'peak',
      description: `Surprise event: ${description}`
    })

    // Surprise events release immediately
    setTimeout(() => {
      this.releaseTension(tension.id, 'Surprise effect faded', world.tick + 1)
    }, 0)

    return tension
  }

  /**
   * Get statistics
   */
  getStats() {
    const tensions = Array.from(this.tensions.values())

    return {
      total_tensions: tensions.length,
      active_tensions: tensions.filter(t => t.status !== 'released').length,
      peak_tensions: tensions.filter(t => t.status === 'peak').length,
      avg_tension_level: tensions.reduce((sum, t) => sum + t.level, 0) / tensions.length || 0,
      tension_by_type: {
        suspense: tensions.filter(t => t.type === 'suspense').length,
        surprise: tensions.filter(t => t.type === 'surprise').length,
        curiosity: tensions.filter(t => t.type === 'curiosity').length,
        conflict: tensions.filter(t => t.type === 'conflict').length,
        time_pressure: tensions.filter(t => t.type === 'time_pressure').length
      }
    }
  }

  /**
   * Get all tensions
   */
  getAllTensions(): Map<string, DramaticTension> {
    return this.tensions
  }

  /**
   * Get active tensions
   */
  getActiveTensions(): DramaticTension[] {
    return Array.from(this.tensions.values()).filter(
      t => t.status !== 'released'
    )
  }

  /**
   * Update from LLM feedback (system_feedback.tension_effect)
   */
  updateFromLLMFeedback(
    agentId: string,
    tensionEffect: 'building' | 'releasing' | 'neutral',
    currentTick: number
  ): void {
    if (tensionEffect === 'neutral') return

    // Find tensions involving this agent
    const agentTensions = Array.from(this.tensions.values()).filter(
      t => t.target_agents.includes(agentId) && t.status !== 'released'
    )

    if (tensionEffect === 'building') {
      if (agentTensions.length > 0) {
        // Build up existing tensions
        for (const tension of agentTensions) {
          tension.level = Math.min(1, tension.level + 0.05)
          if (tension.level >= 0.9 && tension.status === 'building') {
            tension.status = 'peak'
            tension.peak_at = currentTick
          }
        }
      } else {
        // Create a new tension
        const tension: DramaticTension = {
          id: `tension-${this.tensionCounter++}`,
          type: 'suspense',
          level: 0.4,
          source: `Tension building around agent ${agentId}`,
          target_agents: [agentId],
          buildup_rate: 0.05,
          release_condition: 'Situation resolved',
          created_at: currentTick,
          status: 'building',
        }
        this.tensions.set(tension.id, tension)
      }
    } else if (tensionEffect === 'releasing') {
      for (const tension of agentTensions) {
        this.releaseTension(tension.id, 'LLM-reported tension release', currentTick)
      }
    }
  }

  /**
   * Export snapshot
   */
  toSnapshot(): { tensions: Record<string, DramaticTension>; events: TensionEvent[]; tensionCounter: number } {
    const tensions: Record<string, DramaticTension> = {}
    for (const [id, t] of this.tensions) {
      tensions[id] = t
    }
    return { tensions, events: this.events, tensionCounter: this.tensionCounter }
  }

  /**
   * Restore from snapshot
   */
  fromSnapshot(snapshot: { tensions: Record<string, DramaticTension>; events: TensionEvent[]; tensionCounter: number }): void {
    this.tensions.clear()
    for (const [id, t] of Object.entries(snapshot.tensions)) {
      this.tensions.set(id, t)
    }
    this.events = snapshot.events
    this.tensionCounter = snapshot.tensionCounter
  }
}
