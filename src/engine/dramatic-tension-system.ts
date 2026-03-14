/**
 * 戏剧张力系统 - 让故事最精彩
 * 核心：主动创造和维持戏剧张力，让故事更引人入胜
 */

import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import type { NarrativePattern } from '@/domain/narrative'

export type TensionType = 
  | 'suspense'       // 悬念
  | 'surprise'       // 惊奇
  | 'curiosity'      // 好奇
  | 'conflict'       // 冲突
  | 'time_pressure'  // 时间压力

export type DramaticTension = {
  id: string
  type: TensionType
  level: number  // 张力水平 [0-1]
  source: string  // 张力来源
  target_agents: string[]  // 受影响的 agents
  buildup_rate: number  // 累积速度
  release_condition: string  // 释放条件
  created_at: number  // 创建时间
  peak_at?: number  // 高潮时间
  resolved_at?: number  // 解决时间
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
   * 检测并创造张力
   */
  detectAndCreateTension(
    world: WorldSlice,
    narratives: NarrativePattern[]
  ): DramaticTension[] {
    const newTensions: DramaticTension[] = []
    
    // 1. 从冲突叙事创造张力
    const conflictNarratives = narratives.filter(n => n.type === 'conflict')
    for (const narrative of conflictNarratives) {
      if (narrative.status === 'developing') {
        const tension = this.createConflictTension(narrative, world.tick)
        newTensions.push(tension)
      }
    }
    
    // 2. 从 agent 关系创造张力
    for (const agent of world.agents.npcs) {
      // 检测负面关系
      for (const [target, value] of Object.entries(agent.relations)) {
        if (value < -0.7) {
          const tension = this.createRelationshipTension(agent, target, world.tick)
          newTensions.push(tension)
        }
      }
      
      // 检测目标冲突
      const conflictingGoals = this.detectGoalConflicts(agent, world.agents.npcs)
      for (const conflict of conflictingGoals) {
        const tension = this.createGoalConflictTension(agent, conflict, world.tick)
        newTensions.push(tension)
      }
    }
    
    // 3. 从资源稀缺创造张力
    const scarcityTension = this.createScarcityTension(world)
    if (scarcityTension) {
      newTensions.push(scarcityTension)
    }
    
    // 4. 创造悬念（随机事件）
    if (Math.random() < 0.1) {
      const suspenseTension = this.createSuspenseTension(world)
      newTensions.push(suspenseTension)
    }
    
    // 5. 创造时间压力
    const urgentNarratives = narratives.filter(n => 
      n.status === 'climax' || n.intensity > 0.8
    )
    for (const narrative of urgentNarratives) {
      const tension = this.createTimePressureTension(narrative, world.tick)
      newTensions.push(tension)
    }
    
    // 添加到系统
    for (const tension of newTensions) {
      this.tensions.set(tension.id, tension)
      this.events.push({
        tension_id: tension.id,
        tick: world.tick,
        type: 'created',
        description: `创建了${this.getTensionTypeName(tension.type)}张力`
      })
    }
    
    return newTensions
  }
  
  /**
   * 创建冲突张力
   */
  private createConflictTension(
    narrative: NarrativePattern,
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'conflict',
      level: narrative.intensity * 0.7,
      source: `叙事冲突: ${narrative.description}`,
      target_agents: narrative.participants,
      buildup_rate: 0.05,
      release_condition: '冲突解决或一方退出',
      created_at: currentTick,
      status: 'building'
    }
  }
  
  /**
   * 创建关系张力
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
      source: `${agent.identity.name} 与 ${target} 的关系恶化`,
      target_agents: [agent.genetics.seed, target],
      buildup_rate: 0.03,
      release_condition: '关系改善或爆发冲突',
      created_at: currentTick,
      status: 'building'
    }
  }
  
  /**
   * 检测目标冲突
   */
  private detectGoalConflicts(
    agent: PersonalAgentState,
    allAgents: PersonalAgentState[]
  ): Array<{ agent: PersonalAgentState; conflictingGoal: string }> {
    const conflicts: Array<{ agent: PersonalAgentState; conflictingGoal: string }> = []
    
    for (const otherAgent of allAgents) {
      if (otherAgent.genetics.seed === agent.genetics.seed) continue
      
      // 检查目标是否冲突
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
   * 判断目标是否冲突
   */
  private goalsConflict(goal1: string, goal2: string): boolean {
    // 简化：检查关键词冲突
    const competitiveKeywords = ['击败', '超越', '获得', '占据', '控制']
    
    for (const keyword of competitiveKeywords) {
      if (goal1.includes(keyword) && goal2.includes(keyword)) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * 创建目标冲突张力
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
      source: `${agent.identity.name} 与 ${conflict.agent.identity.name} 的目标冲突`,
      target_agents: [agent.genetics.seed, conflict.agent.genetics.seed],
      buildup_rate: 0.04,
      release_condition: '一方放弃目标或达成妥协',
      created_at: currentTick,
      status: 'building'
    }
  }
  
  /**
   * 创建稀缺性张力
   */
  private createScarcityTension(world: WorldSlice): DramaticTension | null {
    // 检查是否有资源压力
    const lowEnergyAgents = world.agents.npcs.filter(a => a.vitals.energy < 0.3)
    
    if (lowEnergyAgents.length > world.agents.npcs.length * 0.3) {
      return {
        id: `tension-${this.tensionCounter++}`,
        type: 'conflict',
        level: 0.7,
        source: '资源稀缺导致的竞争',
        target_agents: lowEnergyAgents.map(a => a.genetics.seed),
        buildup_rate: 0.06,
        release_condition: '资源补充或部分 agents 退出',
        created_at: world.tick,
        status: 'building'
      }
    }
    
    return null
  }
  
  /**
   * 创建悬念张力
   */
  private createSuspenseTension(world: WorldSlice): DramaticTension {
    const randomAgent = world.agents.npcs[Math.floor(Math.random() * world.agents.npcs.length)]
    
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'suspense',
      level: 0.4,
      source: `${randomAgent.identity.name} 的神秘行动`,
      target_agents: [randomAgent.genetics.seed],
      buildup_rate: 0.08,
      release_condition: '真相揭露',
      created_at: world.tick,
      status: 'building'
    }
  }
  
  /**
   * 创建时间压力张力
   */
  private createTimePressureTension(
    narrative: NarrativePattern,
    currentTick: number
  ): DramaticTension {
    return {
      id: `tension-${this.tensionCounter++}`,
      type: 'time_pressure',
      level: narrative.intensity,
      source: `${narrative.description} 进入关键时刻`,
      target_agents: narrative.participants,
      buildup_rate: 0.1,
      release_condition: '时限到达或提前解决',
      created_at: currentTick,
      status: 'building'
    }
  }
  
  /**
   * 累积张力
   */
  buildupTension(
    tensionId: string,
    events: WorldSlice['events'],
    currentTick: number
  ): void {
    const tension = this.tensions.get(tensionId)
    if (!tension || tension.status === 'released') return
    
    // 累积张力
    tension.level = Math.min(1, tension.level + tension.buildup_rate)
    
    // 检查是否达到高潮
    if (tension.level >= 0.9 && tension.status === 'building') {
      tension.status = 'peak'
      tension.peak_at = currentTick
      
      this.events.push({
        tension_id: tensionId,
        tick: currentTick,
        type: 'peak',
        description: `${this.getTensionTypeName(tension.type)}张力达到高潮`
      })
    }
    
    // 记录累积事件
    if (tension.level > 0.5 && Math.random() < 0.2) {
      this.events.push({
        tension_id: tensionId,
        tick: currentTick,
        type: 'buildup',
        description: `${this.getTensionTypeName(tension.type)}张力持续累积`
      })
    }
  }
  
  /**
   * 释放张力
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
      description: `张力释放: ${resolution}`
    })
  }
  
  /**
   * 检测张力释放条件
   */
  checkReleaseConditions(
    world: WorldSlice,
    narratives: NarrativePattern[]
  ): void {
    for (const [id, tension] of this.tensions) {
      if (tension.status === 'released') continue
      
      // 检查叙事是否已结束
      if (tension.type === 'conflict') {
        const relatedNarrative = narratives.find(n =>
          n.participants.some(p => tension.target_agents.includes(p))
        )
        
        if (relatedNarrative && relatedNarrative.status === 'concluded') {
          this.releaseTension(id, '冲突已解决', world.tick)
        }
      }
      
      // 检查关系是否改善
      if (tension.target_agents.length === 2) {
        const [agent1Id, agent2Id] = tension.target_agents
        const agent1 = world.agents.npcs.find(a => a.genetics.seed === agent1Id)
        
        if (agent1 && agent1.relations[agent2Id] > 0.5) {
          this.releaseTension(id, '关系改善', world.tick)
        }
      }
      
      // 高潮后自动衰减
      if (tension.status === 'peak' && tension.peak_at) {
        const ticksSincePeak = world.tick - tension.peak_at
        if (ticksSincePeak > 5) {
          tension.status = 'fading'
          tension.level = Math.max(0, tension.level - 0.1)
          
          if (tension.level < 0.1) {
            this.releaseTension(id, '张力自然消退', world.tick)
          }
        }
      }
    }
  }
  
  /**
   * 计算整体张力
   */
  calculateOverallTension(world: WorldSlice): number {
    const activeTensions = Array.from(this.tensions.values()).filter(
      t => t.status !== 'released'
    )
    
    if (activeTensions.length === 0) return 0
    
    // 加权平均
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
   * 获取张力节奏
   */
  getTensionRhythm(windowSize: number = 10): Array<{
    tick: number
    tension: number
  }> {
    const rhythm: Array<{ tick: number; tension: number }> = []
    
    // 从事件历史计算
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
   * 创建惊奇事件
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
      release_condition: '立即释放',
      created_at: world.tick,
      status: 'peak'
    }
    
    this.tensions.set(tension.id, tension)
    
    this.events.push({
      tension_id: tension.id,
      tick: world.tick,
      type: 'peak',
      description: `惊奇事件: ${description}`
    })
    
    // 惊奇事件立即释放
    setTimeout(() => {
      this.releaseTension(tension.id, '惊奇效果消退', world.tick + 1)
    }, 0)
    
    return tension
  }
  
  /**
   * 获取统计信息
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
   * 获取张力类型名称
   */
  private getTensionTypeName(type: TensionType): string {
    const names: Record<TensionType, string> = {
      suspense: '悬念',
      surprise: '惊奇',
      curiosity: '好奇',
      conflict: '冲突',
      time_pressure: '时间压力'
    }
    return names[type]
  }
  
  /**
   * 获取所有张力
   */
  getAllTensions(): Map<string, DramaticTension> {
    return this.tensions
  }
  
  /**
   * 获取活跃张力
   */
  getActiveTensions(): DramaticTension[] {
    return Array.from(this.tensions.values()).filter(
      t => t.status !== 'released'
    )
  }
}
