/**
 * 涌现属性检测器 - 最能发现惊喜
 * 核心：自动检测系统中涌现的新属性和模式
 */

import type { WorldSlice, PersonalAgentState } from '@/domain/world'

export type EmergenceType =
  | 'phase_transition'      // 相变
  | 'critical_point'        // 临界点
  | 'self_organization'     // 自组织
  | 'synchronization'       // 同步
  | 'collective_behavior'   // 集体行为

export type EmergentProperty = {
  id: string
  type: EmergenceType
  description: string
  detected_at: number
  strength: number  // 涌现强度 [0-1]
  participants: string[]  // 参与者
  indicators: Map<string, number>  // 指标
  significance: number  // 重要性 [0-1]
  novelty: number  // 新颖性 [0-1]
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
   * 检测涌现属性
   */
  detectEmergence(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    // 更新历史窗口
    this.updateHistory(world)
    
    const newProperties: EmergentProperty[] = []
    
    // 1. 检测相变
    const phaseTransitions = this.detectPhaseTransition(world, history)
    newProperties.push(...phaseTransitions)
    
    // 2. 检测临界点
    const criticalPoints = this.detectCriticalPoint(world, history)
    newProperties.push(...criticalPoints)
    
    // 3. 检测自组织
    const selfOrganizations = this.detectSelfOrganization(world)
    newProperties.push(...selfOrganizations)
    
    // 4. 检测同步
    const synchronizations = this.detectSynchronization(world)
    newProperties.push(...synchronizations)
    
    // 5. 检测集体行为
    const collectiveBehaviors = this.detectCollectiveBehavior(world)
    newProperties.push(...collectiveBehaviors)
    
    // 添加到已检测列表
    this.detectedProperties.push(...newProperties)
    
    return newProperties
  }
  
  /**
   * 更新历史窗口
   */
  private updateHistory(world: WorldSlice): void {
    this.historyWindow.push(world)
    
    if (this.historyWindow.length > this.maxHistorySize) {
      this.historyWindow.shift()
    }
  }
  
  /**
   * 检测相变（系统状态的突变）
   */
  private detectPhaseTransition(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    const properties: EmergentProperty[] = []
    
    if (history.length < 5) return properties
    
    // 检测平均能量的突变
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
        description: `系统能量发生剧烈变化（${energyChange > 0 ? '上升' : '下降'}）`,
        detected_at: world.tick,
        strength: Math.min(1, energyChange / 0.5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.8,
        novelty: 0.9
      })
    }
    
    // 检测社交网络密度的突变
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
        description: `社交网络结构发生重大变化`,
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
   * 检测临界点（小变化导致大影响）
   */
  private detectCriticalPoint(
    world: WorldSlice,
    history: WorldSlice[]
  ): EmergentProperty[] {
    const properties: EmergentProperty[] = []
    
    if (history.length < 3) return properties
    
    // 检测级联效应
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
        description: `系统达到临界点，小事件引发连锁反应`,
        detected_at: world.tick,
        strength: Math.min(1, cascadeEvents.length / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.9,
        novelty: 0.85
      })
    }
    
    // 检测情绪传染
    const emotionalAgents = world.agents.npcs.filter(a => a.emotion.intensity > 0.7)
    const emotionClusters = this.detectEmotionClusters(world.agents.npcs)
    
    if (emotionClusters.length > 0 && emotionalAgents.length > world.agents.npcs.length * 0.5) {
      const indicators = new Map<string, number>()
      indicators.set('emotional_agents_ratio', emotionalAgents.length / world.agents.npcs.length)
      indicators.set('cluster_count', emotionClusters.length)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'critical_point',
        description: `情绪在群体中快速传播`,
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
   * 检测自组织（秩序的自发形成）
   */
  private detectSelfOrganization(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []
    
    // 检测社群形成
    const communities = this.detectCommunities(world.agents.npcs)
    
    if (communities.length >= 2) {
      const indicators = new Map<string, number>()
      indicators.set('community_count', communities.length)
      indicators.set('avg_community_size', communities.reduce((sum, c) => sum + c.length, 0) / communities.length)
      indicators.set('modularity', this.calculateModularity(communities, world.agents.npcs))
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `Agents 自发形成了 ${communities.length} 个社群`,
        detected_at: world.tick,
        strength: Math.min(1, communities.length / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.8,
        novelty: 0.7
      })
    }
    
    // 检测等级结构
    const hierarchy = this.detectHierarchy(world.agents.npcs)
    
    if (hierarchy.levels > 2) {
      const indicators = new Map<string, number>()
      indicators.set('hierarchy_levels', hierarchy.levels)
      indicators.set('top_agents', hierarchy.topAgents.length)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `形成了 ${hierarchy.levels} 层的社会等级结构`,
        detected_at: world.tick,
        strength: Math.min(1, hierarchy.levels / 5),
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.75,
        novelty: 0.65
      })
    }
    
    // 检测角色分化
    const roles = this.detectRoleDifferentiation(world.agents.npcs)
    
    if (roles.size >= 3) {
      const indicators = new Map<string, number>()
      indicators.set('role_count', roles.size)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'self_organization',
        description: `Agents 分化出 ${roles.size} 种不同的社会角色`,
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
   * 检测同步（agents 行为的同步）
   */
  private detectSynchronization(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []
    
    // 检测情绪同步
    const emotionSync = this.calculateEmotionSynchronization(world.agents.npcs)
    
    if (emotionSync > 0.7) {
      const indicators = new Map<string, number>()
      indicators.set('emotion_sync', emotionSync)
      
      const dominantEmotion = this.getDominantEmotion(world.agents.npcs)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'synchronization',
        description: `群体情绪同步为"${dominantEmotion}"`,
        detected_at: world.tick,
        strength: emotionSync,
        participants: world.agents.npcs.map(a => a.genetics.seed),
        indicators,
        significance: 0.75,
        novelty: 0.7
      })
    }
    
    // 检测行为同步
    const behaviorSync = this.calculateBehaviorSynchronization(world.agents.npcs)
    
    if (behaviorSync > 0.6) {
      const indicators = new Map<string, number>()
      indicators.set('behavior_sync', behaviorSync)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'synchronization',
        description: `Agents 的行为模式高度同步`,
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
   * 检测集体行为
   */
  private detectCollectiveBehavior(world: WorldSlice): EmergentProperty[] {
    const properties: EmergentProperty[] = []
    
    // 检测群体迁移
    const migration = this.detectMigration(world.agents.npcs)
    
    if (migration.participants.length > world.agents.npcs.length * 0.3) {
      const indicators = new Map<string, number>()
      indicators.set('migration_size', migration.participants.length)
      indicators.set('migration_ratio', migration.participants.length / world.agents.npcs.length)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `${migration.participants.length} 个 agents 发生集体迁移`,
        detected_at: world.tick,
        strength: migration.participants.length / world.agents.npcs.length,
        participants: migration.participants,
        indicators,
        significance: 0.8,
        novelty: 0.85
      })
    }
    
    // 检测集体决策
    const collectiveDecision = this.detectCollectiveDecision(world.agents.npcs)
    
    if (collectiveDecision.consensus > 0.7) {
      const indicators = new Map<string, number>()
      indicators.set('consensus_level', collectiveDecision.consensus)
      indicators.set('participants', collectiveDecision.participants.length)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `群体达成共识：${collectiveDecision.decision}`,
        detected_at: world.tick,
        strength: collectiveDecision.consensus,
        participants: collectiveDecision.participants,
        indicators,
        significance: 0.75,
        novelty: 0.7
      })
    }
    
    // 检测群体极化
    const polarization = this.detectPolarization(world.agents.npcs)
    
    if (polarization.strength > 0.6) {
      const indicators = new Map<string, number>()
      indicators.set('polarization_strength', polarization.strength)
      indicators.set('faction_count', polarization.factions.length)
      
      properties.push({
        id: `emergence-${this.propertyCounter++}`,
        type: 'collective_behavior',
        description: `群体分裂为 ${polarization.factions.length} 个对立阵营`,
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
  
  // ===== 辅助方法 =====
  
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
      
      // 找到情绪相似的 agents
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
    // 基于关系网络计算中心性
    const centrality = new Map<string, number>()
    
    for (const agent of agents) {
      const incomingPositive = agents.filter(a =>
        a.relations[agent.genetics.seed] > 0.5
      ).length
      
      centrality.set(agent.genetics.seed, incomingPositive)
    }
    
    const sorted = Array.from(centrality.entries()).sort((a, b) => b[1] - a[1])
    
    // 简化：根据中心性分层
    const maxCentrality = sorted[0]?.[1] || 0
    const levels = maxCentrality > 0 ? Math.ceil(maxCentrality / 2) : 1
    
    const topAgents = sorted.slice(0, Math.ceil(agents.length * 0.2)).map(([id]) => id)
    
    return { levels, topAgents }
  }
  
  private detectRoleDifferentiation(agents: PersonalAgentState[]): Map<string, string[]> {
    const roles = new Map<string, string[]>()
    
    for (const agent of agents) {
      // 基于职业分类
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
    // 简化：基于最近行动的相似性
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
    // 简化：检测能量低的 agents（可能在寻找资源）
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
    // 检测共同目标
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
      decision: '无共识',
      consensus: 0,
      participants: []
    }
  }
  
  private detectPolarization(agents: PersonalAgentState[]): {
    strength: number
    factions: string[][]
  } {
    // 基于关系网络检测对立阵营
    const factions: string[][] = []
    const visited = new Set<string>()
    
    for (const agent of agents) {
      if (visited.has(agent.genetics.seed)) continue
      
      const faction: string[] = [agent.genetics.seed]
      visited.add(agent.genetics.seed)
      
      // 找到朋友
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
    
    // 计算阵营间的敌意
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
    // 简化的模块度计算
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
   * 获取统计信息
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
   * 获取所有检测到的属性
   */
  getAllProperties(): EmergentProperty[] {
    return this.detectedProperties
  }
  
  /**
   * 获取最近的涌现属性
   */
  getRecentProperties(count: number = 10): EmergentProperty[] {
    return this.detectedProperties.slice(-count)
  }
}
