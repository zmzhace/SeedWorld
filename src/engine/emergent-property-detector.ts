/**
 * Emergent property detector — best at finding surprises
 * Core: automatically detect emergent properties and patterns in the system
 */

import type { WorldSlice, PersonalAgentState } from '@/domain/world'

export type EmergenceType =
  | 'phase_transition'      // phase transition
  | 'critical_point'        // critical point
  | 'self_organization'     // self-organization
  | 'synchronization'       // synchronization
  | 'collective_behavior'   // collective behavior

export type EmergentProperty = {
  id: string
  type: EmergenceType
  description: string
  detected_at: number
  strength: number  // emergence strength [0-1]
  participants: string[]  // participants
  indicators: Map<string, number>  // indicators
  significance: number  // significance [0-1]
  novelty: number  // novelty [0-1]
}

export type EmergenceIndicator = {
  name: string
  value: number
  threshold: number
  description: string
}

export class EmergentPropertyDetector {
  private detectedProperties: EmergentProperty[] = []
  private propertyCounter = 0
  private historyWindow: WorldSlice[] = []
  private readonly maxHistorySize = 20

  /**
   * Detect emergent properties
   */
  detectEmergence(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    // Update history window
    this.updateHistory(world)

    const newProperties: EmergentProperty[] = []

    // 1. Detect phase transitions (use internal historyWindow, not the external history param)
    const phaseTransitions = this.detectPhaseTransition(world, this.historyWindow)
    newProperties.push(...phaseTransitions)

    // 2. Detect critical points (use internal historyWindow, not the external history param)
    const criticalPoints = this.detectCriticalPoint(world, this.historyWindow)
    newProperties.push(...criticalPoints)

    // 3. Detect self-organization
    const selfOrganizations = this.detectSelfOrganization(world)
    newProperties.push(...selfOrganizations)

    // 4. Detect synchronization
    const synchronizations = this.detectSynchronization(world)
    newProperties.push(...synchronizations)

    // 5. Detect collective behavior
    const collectiveBehaviors = this.detectCollectiveBehavior(world)
    newProperties.push(...collectiveBehaviors)

    // Add to detected list
    this.detectedProperties.push(...newProperties)

    return newProperties
  }

  /**
   * Update history window
   */
  private updateHistory(world: WorldSlice): void {
    this.historyWindow.push(world)

    if (this.historyWindow.length > this.maxHistorySize) {
      this.historyWindow.shift()
    }
  }

  /**
   * Detect phase transitions (abrupt changes in system state)
   */
  private detectPhaseTransition(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    const properties: EmergentProperty[] = []

    if (history.length < 5) return properties

    // Detect abrupt change in average energy
    const recentEnergies = history.slice(-5).map(w =>
      this.calculateAverageEnergy(w.agents.npcs)
    )

    const energyChange = Math.abs(recentEnergies[recentEnergies.length - 1] - recentEnergies[0])

    if (energyChange > 0.4) {
      const indicators = new Map<string, number>()
      indicators.set('energy_change', energyChange)
      indicators.set('rate_of_change', energyChange / 5)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'phase_transition',
        description: `System energy shifted dramatically (${energyChange > 0 ? 'rising' : 'falling'})`,
        detected_at: world.tick,
        strength: Math.min(1, energyChange / 0.5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.8,
        novelty: 0.9
      })
    }

    // Detect abrupt change in social network density
    const recentDensities = history.slice(-5).map(w =>
      this.calculateNetworkDensity(w.agents.npcs)
    )

    const densityChange = Math.abs(recentDensities[recentDensities.length - 1] - recentDensities[0])

    if (densityChange > 0.3) {
      const indicators = new Map<string, number>()
      indicators.set('density_change', densityChange)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'phase_transition',
        description: `Social network structure changed significantly`,
        detected_at: world.tick,
        strength: Math.min(1, densityChange / 0.4),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.7,
        novelty: 0.8
      })
    }

    return properties
  }

  /**
   * Detect critical points (small changes causing large effects)
   */
  private detectCriticalPoint(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    const properties: EmergentProperty[] = []

    if (history.length < 3) return properties

    // Detect cascade effects
    const recentEvents = world.events.slice(-10)
    const cascadeEvents = recentEvents.filter(e =>
      e.type === 'agent_death' || e.type === 'agent_reincarnation' || e.type === 'major_conflict'
    )

    if (cascadeEvents.length >= 3) {
      const indicators = new Map<string, number>()
      indicators.set('cascade_size', cascadeEvents.length)
      indicators.set('cascade_rate', cascadeEvents.length / 10)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'critical_point',
        description: `System reached critical point — small events triggered chain reactions`,
        detected_at: world.tick,
        strength: Math.min(1, cascadeEvents.length / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.9,
        novelty: 0.85
      })
    }

    // Detect emotional contagion
    const emotionalAgents = world.agents.npcs.filter(a => a.emotion.intensity > 0.7)
    const emotionClusters = this.detectEmotionClusters(world.agents.npcs)

    if (emotionClusters.length > 0 && emotionalAgents.length > world.agents.npcs.length * 0.5) {
      const indicators = new Map<string, number>()
      indicators.set('emotional_agents_ratio', emotionalAgents.length / world.agents.npcs.length)
      indicators.set('cluster_count', emotionClusters.length)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'critical_point',
        description: `Emotions spreading rapidly through the group`,
        detected_at: world.tick,
        strength: emotionalAgents.length / world.agents.npcs.length,
        participants: emotionalAgents.map(a => a.genetics.seed),
        indicators,
        significance: 0.7,
        novelty: 0.75
      })
    }

    return properties
  }

  /**
   * Detect self-organization (spontaneous formation of order)
   */
  private detectSelfOrganization(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []

    // Detect community formation
    const communities = this.detectCommunities(world.agents.npcs)

    if (communities.length >= 2) {
      const indicators = new Map<string, number>()
      indicators.set('community_count', communities.length)
      indicators.set('avg_community_size', communities.reduce((sum, c) => sum + c.length, 0) / communities.length)
      indicators.set('modularity', this.calculateModularity(communities, world.agents.npcs))

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `Agents spontaneously formed ${communities.length} communities`,
        detected_at: world.tick,
        strength: Math.min(1, communities.length / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.8,
        novelty: 0.7
      })
    }

    // Detect hierarchy formation
    const hierarchy = this.detectHierarchy(world.agents.npcs)

    if (hierarchy.levels > 2) {
      const indicators = new Map<string, number>()
      indicators.set('hierarchy_levels', hierarchy.levels)
      indicators.set('top_agents', hierarchy.topAgents.length)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `A ${hierarchy.levels}-tier social hierarchy emerged`,
        detected_at: world.tick,
        strength: Math.min(1, hierarchy.levels / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.75,
        novelty: 0.65
      })
    }

    // Detect role differentiation
    const roles = this.detectRoleDifferentiation(world.agents.npcs)

    if (roles.size >= 3) {
      const indicators = new Map<string, number>()
      indicators.set('role_count', roles.size)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `Agents differentiated into ${roles.size} distinct social roles`,
        detected_at: world.tick,
        strength: Math.min(1, roles.size / 6),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.7,
        novelty: 0.8
      })
    }

    return properties
  }

  /**
   * Detect synchronization (agents behaving in sync)
   */
  private detectSynchronization(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []

    // Detect emotional synchronization
    const emotionSync = this.calculateEmotionSynchronization(world.agents.npcs)

    if (emotionSync > 0.7) {
      const indicators = new Map<string, number>()
      indicators.set('emotion_sync', emotionSync)

      const dominantEmotion = this.getDominantEmotion(world.agents.npcs)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'synchronization',
        description: `Group emotion synchronized to "${dominantEmotion}"`,
        detected_at: world.tick,
        strength: emotionSync,
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.75,
        novelty: 0.7
      })
    }

    // Detect behavioral synchronization
    const behaviorSync = this.calculateBehaviorSynchronization(world.agents.npcs)

    if (behaviorSync > 0.6) {
      const indicators = new Map<string, number>()
      indicators.set('behavior_sync', behaviorSync)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'synchronization',
        description: `Agent behavior patterns are highly synchronized`,
        detected_at: world.tick,
        strength: behaviorSync,
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.65,
        novelty: 0.6
      })
    }

    return properties
  }

  /**
   * Detect collective behavior
   */
  private detectCollectiveBehavior(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []

    // Detect group migration
    const migration = this.detectMigration(world.agents.npcs)

    if (migration.participants.length > world.agents.npcs.length * 0.3) {
      const indicators = new Map<string, number>()
      indicators.set('migration_size', migration.participants.length)
      indicators.set('migration_ratio', migration.participants.length / world.agents.npcs.length)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `${migration.participants.length} agents undergoing collective migration`,
        detected_at: world.tick,
        strength: migration.participants.length / world.agents.npcs.length,
        participants: migration.participants,
        indicators,
        significance: 0.8,
        novelty: 0.85
      })
    }

    // Detect collective decision-making
    const collectiveDecision = this.detectCollectiveDecision(world.agents.npcs)

    if (collectiveDecision.consensus > 0.7) {
      const indicators = new Map<string, number>()
      indicators.set('consensus_level', collectiveDecision.consensus)
      indicators.set('participants', collectiveDecision.participants.length)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `Group reached consensus: ${collectiveDecision.decision}`,
        detected_at: world.tick,
        strength: collectiveDecision.consensus,
        participants: collectiveDecision.participants,
        indicators,
        significance: 0.75,
        novelty: 0.7
      })
    }

    // Detect group polarization
    const polarization = this.detectPolarization(world.agents.npcs)

    if (polarization.strength > 0.6) {
      const indicators = new Map<string, number>()
      indicators.set('polarization_strength', polarization.strength)
      indicators.set('faction_count', polarization.factions.length)

      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `Group split into ${polarization.factions.length} opposing factions`,
        detected_at: world.tick,
        strength: polarization.strength,
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.85,
        novelty: 0.8
      })
    }

    return properties
  }

  // ===== Helper methods =====

  private calculateAverageEnergy(agents: PersonalAgentState[]): number {
    if (agents.length === 0) return 0
    return agents.reduce((sum, a) => sum + a.vitals.energy, 0) / agents.length
  }

  private calculateNetworkDensity(agents: PersonalAgentState[]): number {
    if (agents.length < 2) return 0

    let totalConnections = 0
    for (const agent of agents) {
      totalConnections += Object.values(agent.relations).filter(v => v > 0.3).length
    }

    const maxConnections = agents.length * (agents.length - 1)
    return totalConnections / maxConnections
  }

  private detectEmotionClusters(agents: PersonalAgentState[]): string[][] {
    const clusters: string[][] = []
    const visited = new Set<string>()

    for (const agent of agents) {
      if (visited.has(agent.genetics.seed)) continue

      const cluster: string[] = [agent.genetics.seed]
      visited.add(agent.genetics.seed)

      // Find agents with similar emotions
      for (const other of agents) {
        if (visited.has(other.genetics.seed)) continue

        if (agent.emotion.label === other.emotion.label &&
            Math.abs(agent.emotion.intensity - other.emotion.intensity) < 0.3) {
          cluster.push(other.genetics.seed)
          visited.add(other.genetics.seed)
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster)
      }
    }

    return clusters
  }

  private detectCommunities(agents: PersonalAgentState[]): string[][] {
    const communities: string[][] = []
    const visited = new Set<string>()

    for (const agent of agents) {
      if (visited.has(agent.genetics.seed)) continue

      const community = this.expandCommunity(agent, agents, visited)

      if (community.length >= 2) {
        communities.push(community)
      }
    }

    return communities
  }

  private expandCommunity(
    seed: PersonalAgentState,
    allAgents: PersonalAgentState[],
    visited: Set<string>
  ): string[] {
    const community: string[] = [seed.genetics.seed]
    visited.add(seed.genetics.seed)

    const queue = [seed]

    while (queue.length > 0) {
      const current = queue.shift()!

      for (const [targetId, value] of Object.entries(current.relations)) {
        if (value > 0.5 && !visited.has(targetId)) {
          const target = allAgents.find(a => a.genetics.seed === targetId)
          if (target) {
            community.push(targetId)
            visited.add(targetId)
            queue.push(target)
          }
        }
      }
    }

    return community
  }

  private detectHierarchy(agents: PersonalAgentState[]): {
    levels: number
    topAgents: string[]
  } {
    // Calculate centrality based on relationship network
    const centrality = new Map<string, number>()

    for (const agent of agents) {
      const incomingPositive = agents.filter(a =>
        a.relations[agent.genetics.seed] > 0.5
      ).length

      centrality.set(agent.genetics.seed, incomingPositive)
    }

    const sorted = Array.from(centrality.entries()).sort((a, b) => b[1] - a[1])

    // Simplified: stratify by centrality
    const maxCentrality = sorted[0]?.[1] || 0
    const levels = maxCentrality > 0 ? Math.ceil(maxCentrality / 2) : 1

    const topAgents = sorted.slice(0, Math.ceil(agents.length * 0.2)).map(([id]) => id)

    return { levels, topAgents }
  }

  private detectRoleDifferentiation(agents: PersonalAgentState[]): Map<string, string[]> {
    const roles = new Map<string, string[]>()

    for (const agent of agents) {
      // Classify by occupation
      if (agent.occupation) {
        const existing = roles.get(agent.occupation) || []
        existing.push(agent.genetics.seed)
        roles.set(agent.occupation, existing)
      }
    }

    return roles
  }

  private calculateEmotionSynchronization(agents: PersonalAgentState[]): number {
    if (agents.length < 2) return 0

    const emotionCounts = new Map<string, number>()

    for (const agent of agents) {
      const count = emotionCounts.get(agent.emotion.label) || 0
      emotionCounts.set(agent.emotion.label, count + 1)
    }

    const maxCount = Math.max(...emotionCounts.values())
    return maxCount / agents.length
  }

  private getDominantEmotion(agents: PersonalAgentState[]): string {
    const emotionCounts = new Map<string, number>()

    for (const agent of agents) {
      const count = emotionCounts.get(agent.emotion.label) || 0
      emotionCounts.set(agent.emotion.label, count + 1)
    }

    return Array.from(emotionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral'
  }

  private calculateBehaviorSynchronization(agents: PersonalAgentState[]): number {
    // Simplified: based on recent action similarity
    if (agents.length < 2) return 0

    const recentActions = agents.map(a => a.action_history.slice(-1)[0]?.type || 'none')
    const actionCounts = new Map<string, number>()

    for (const action of recentActions) {
      const count = actionCounts.get(action) || 0
      actionCounts.set(action, count + 1)
    }

    const maxCount = Math.max(...actionCounts.values())
    return maxCount / agents.length
  }

  private detectMigration(agents: PersonalAgentState[]): {
    participants: string[]
  } {
    // Simplified: detect low-energy agents (likely seeking resources)
    const lowEnergyAgents = agents.filter(a => a.vitals.energy < 0.3)

    return {
      participants: lowEnergyAgents.map(a => a.genetics.seed)
    }
  }

  private detectCollectiveDecision(agents: PersonalAgentState[]): {
    decision: string
    consensus: number
    participants: string[]
  } {
    // Detect shared goals
    const goalCounts = new Map<string, string[]>()

    for (const agent of agents) {
      for (const goal of agent.goals) {
        const existing = goalCounts.get(goal) || []
        existing.push(agent.genetics.seed)
        goalCounts.set(goal, existing)
      }
    }

    const mostCommon = Array.from(goalCounts.entries())
      .sort((a, b) => b[1].length - a[1].length)[0]

    if (mostCommon) {
      return {
        decision: mostCommon[0],
        consensus: mostCommon[1].length / agents.length,
        participants: mostCommon[1]
      }
    }

    return {
      decision: 'no consensus',
      consensus: 0,
      participants: []
    }
  }

  private detectPolarization(agents: PersonalAgentState[]): {
    strength: number
    factions: string[][]
  } {
    // Detect opposing factions based on relationship network
    const factions: string[][] = []
    const visited = new Set<string>()

    for (const agent of agents) {
      if (visited.has(agent.genetics.seed)) continue

      const faction: string[] = [agent.genetics.seed]
      visited.add(agent.genetics.seed)

      // Find friends
      for (const [targetId, value] of Object.entries(agent.relations)) {
        if (value > 0.5 && !visited.has(targetId)) {
          faction.push(targetId)
          visited.add(targetId)
        }
      }

      if (faction.length >= 2) {
        factions.push(faction)
      }
    }

    // Calculate inter-faction hostility
    let totalHostility = 0
    let pairCount = 0

    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        for (const agentId1 of factions[i]) {
          const agent1 = agents.find(a => a.genetics.seed === agentId1)
          if (!agent1) continue

          for (const agentId2 of factions[j]) {
            const relation = agent1.relations[agentId2] || 0
            if (relation < 0) {
              totalHostility += Math.abs(relation)
              pairCount++
            }
          }
        }
      }
    }

    const strength = pairCount > 0 ? totalHostility / pairCount : 0

    return { strength, factions }
  }

  private calculateModularity(
    communities: string[][],
    agents: PersonalAgentState[]
  ): number {
    // Simplified modularity calculation
    let internalEdges = 0
    let totalEdges = 0

    for (const community of communities) {
      for (const agentId of community) {
        const agent = agents.find(a => a.genetics.seed === agentId)
        if (!agent) continue

        for (const [targetId, value] of Object.entries(agent.relations)) {
          if (value > 0.3) {
            totalEdges++
            if (community.includes(targetId)) {
              internalEdges++
            }
          }
        }
      }
    }

    return totalEdges > 0 ? internalEdges / totalEdges : 0
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total_detected: this.detectedProperties.length,
      by_type: {
        phase_transition: this.detectedProperties.filter(p => p.type === 'phase_transition').length,
        critical_point: this.detectedProperties.filter(p => p.type === 'critical_point').length,
        self_organization: this.detectedProperties.filter(p => p.type === 'self_organization').length,
        synchronization: this.detectedProperties.filter(p => p.type === 'synchronization').length,
        collective_behavior: this.detectedProperties.filter(p => p.type === 'collective_behavior').length
      },
      avg_strength: this.detectedProperties.reduce((sum, p) => sum + p.strength, 0) / this.detectedProperties.length || 0,
      avg_novelty: this.detectedProperties.reduce((sum, p) => sum + p.novelty, 0) / this.detectedProperties.length || 0
    }
  }

  /**
   * Get all detected properties
   */
  getAllProperties(): EmergentProperty[] {
    return this.detectedProperties
  }

  /**
   * Get recent emergent properties
   */
  getRecentProperties(count: number = 10): EmergentProperty[] {
    return this.detectedProperties.slice(-count)
  }

  /**
   * Export snapshot (Map → Record serialization)
   */
  toSnapshot(): { detectedProperties: Array<Omit<EmergentProperty, 'indicators'> & { indicators: Record<string, number> }>; propertyCounter: number } {
    const detectedProperties = this.detectedProperties.map(p => ({
      ...p,
      indicators: Object.fromEntries(p.indicators),
    }))
    return { detectedProperties, propertyCounter: this.propertyCounter }
  }

  /**
   * Restore from snapshot
   */
  fromSnapshot(snapshot: { detectedProperties: Array<Omit<EmergentProperty, 'indicators'> & { indicators: Record<string, number> }>; propertyCounter: number }): void {
    this.detectedProperties = snapshot.detectedProperties.map(p => ({
      ...p,
      indicators: new Map(Object.entries(p.indicators)),
    }))
    this.propertyCounter = snapshot.propertyCounter
  }
}
