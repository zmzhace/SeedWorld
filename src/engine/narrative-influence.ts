/**
 * 叙事影响系统 - 让叙事影响 agents 的决策和行为
 * 核心：形成正反馈循环 - 叙事 → 影响 → 行为 → 事件 → 叙事
 */

import type { PersonalAgentState, MemoryRecord, WorldSlice } from '@/domain/world'
import type { NarrativePattern, NarrativeRole } from '@/domain/narrative'

export class NarrativeInfluenceSystem {
  /**
   * 应用叙事影响到 agent
   */
  applyNarrativeInfluence(
    agent: PersonalAgentState,
    narratives: NarrativePattern[],
    world: WorldSlice
  ): PersonalAgentState {
    // 1. 找到 agent 参与的叙事
    const participatingNarratives = narratives.filter(n =>
      n.participants.includes(agent.genetics.seed)
    )
    
    if (participatingNarratives.length === 0) {
      return agent
    }
    
    // 2. 更新 agent 的叙事角色
    const narrative_roles = this.updateNarrativeRoles(agent, participatingNarratives)
    
    // 3. 生成叙事相关的记忆
    const narrativeMemories = this.generateNarrativeMemories(
      agent,
      participatingNarratives,
      world.tick
    )
    
    // 4. 调整情感状态
    const emotion = this.adjustEmotionByNarrative(agent, participatingNarratives)
    
    // 5. 影响目标
    const goals = this.influenceGoals(agent, participatingNarratives)
    
    return {
      ...agent,
      narrative_roles,
      memory_short: [...agent.memory_short, ...narrativeMemories],
      emotion,
      goals
    }
  }
  
  /**
   * 更新 agent 的叙事角色
   */
  private updateNarrativeRoles(
    agent: PersonalAgentState,
    narratives: NarrativePattern[]
  ): PersonalAgentState['narrative_roles'] {
    const roles: PersonalAgentState['narrative_roles'] = agent.narrative_roles || {}
    
    for (const narrative of narratives) {
      const role = this.determineRole(agent, narrative)
      const involvement = this.calculateInvolvement(agent, narrative)
      const impact = this.calculateImpact(agent, narrative)
      
      roles[narrative.id] = { role, involvement, impact }
    }
    
    return roles
  }
  
  /**
   * 确定 agent 在叙事中的角色
   */
  private determineRole(
    agent: PersonalAgentState,
    narrative: NarrativePattern
  ): NarrativeRole['role'] {
    const agentId = agent.genetics.seed
    
    // 检查是否是主要参与者（前两名）
    const participantIndex = narrative.participants.indexOf(agentId)
    
    if (participantIndex === 0) {
      // 第一个参与者通常是主角
      return 'protagonist'
    } else if (participantIndex === 1 && narrative.type === 'conflict') {
      // 冲突中的第二个参与者是对手
      return 'antagonist'
    } else if (participantIndex === 1 && narrative.type === 'alliance') {
      // 联盟中的第二个参与者也是主角
      return 'protagonist'
    } else if (narrative.catalyst === narrative.event_ids[0]) {
      // 触发事件的参与者是催化剂
      return 'catalyst'
    } else if (participantIndex > 1) {
      // 其他参与者是配角
      return 'supporting'
    } else {
      // 默认是观察者
      return 'observer'
    }
  }
  
  /**
   * 计算参与度
   */
  private calculateInvolvement(
    agent: PersonalAgentState,
    narrative: NarrativePattern
  ): number {
    const agentId = agent.genetics.seed
    
    // 统计 agent 在叙事事件中的出现次数
    const totalEvents = narrative.event_ids.length
    // 简化：假设每个事件都涉及所有参与者
    const agentEvents = totalEvents
    
    return Math.min(1, agentEvents / Math.max(1, totalEvents))
  }
  
  /**
   * 计算影响力
   */
  private calculateImpact(
    agent: PersonalAgentState,
    narrative: NarrativePattern
  ): number {
    // 影响力基于叙事强度和 agent 的参与度
    const involvement = this.calculateInvolvement(agent, narrative)
    return narrative.intensity * involvement
  }
  
  /**
   * 生成叙事相关的记忆
   */
  generateNarrativeMemories(
    agent: PersonalAgentState,
    narratives: NarrativePattern[],
    currentTick: number
  ): MemoryRecord[] {
    const memories: MemoryRecord[] = []
    
    for (const narrative of narratives) {
      // 只为活跃的叙事生成记忆
      if (narrative.status !== 'developing' && narrative.status !== 'climax') {
        continue
      }
      
      const role = this.determineRole(agent, narrative)
      const impact = this.calculateImpact(agent, narrative)
      
      // 生成记忆内容
      const content = this.generateMemoryContent(agent, narrative, role)
      
      const memory: MemoryRecord = {
        id: `narrative-memory-${narrative.id}-${currentTick}`,
        content,
        importance: impact,
        emotional_weight: narrative.sentiment,
        source: 'social',
        timestamp: new Date().toISOString(),
        decay_rate: 0.02, // 叙事记忆衰减较慢
        retrieval_strength: impact
      }
      
      memories.push(memory)
    }
    
    return memories
  }
  
  /**
   * 生成记忆内容
   */
  private generateMemoryContent(
    agent: PersonalAgentState,
    narrative: NarrativePattern,
    role: NarrativeRole['role']
  ): string {
    const narrativeTypeNames: Record<string, string> = {
      conflict: '冲突',
      alliance: '联盟',
      romance: '浪漫关系',
      betrayal: '背叛',
      discovery: '发现',
      transformation: '转变',
      quest: '探索',
      mystery: '谜团',
      tragedy: '悲剧',
      triumph: '胜利'
    }
    
    const roleDescriptions: Record<string, string> = {
      protagonist: '我是主角',
      antagonist: '我是对手',
      supporting: '我在旁协助',
      observer: '我在观察',
      catalyst: '我触发了这一切'
    }
    
    const typeName = narrativeTypeNames[narrative.type] || '事件'
    const roleDesc = roleDescriptions[role] || '我参与了'
    const otherParticipants = narrative.participants.filter(p => p !== agent.genetics.seed)
    
    let content = `${roleDesc}，正在经历一场${typeName}`
    
    if (otherParticipants.length > 0) {
      content += `，涉及 ${otherParticipants.slice(0, 2).join('、')}`
      if (otherParticipants.length > 2) {
        content += ` 等 ${otherParticipants.length} 人`
      }
    }
    
    // 根据叙事状态添加描述
    if (narrative.status === 'climax') {
      content += '。事态已经到了关键时刻'
    } else if (narrative.status === 'developing') {
      content += '。事情还在发展中'
    }
    
    // 根据情感添加描述
    if (narrative.sentiment > 0.5) {
      content += '，感觉还不错'
    } else if (narrative.sentiment < -0.5) {
      content += '，让我感到不安'
    }
    
    return content
  }
  
  /**
   * 根据叙事调整情感
   */
  private adjustEmotionByNarrative(
    agent: PersonalAgentState,
    narratives: NarrativePattern[]
  ): PersonalAgentState['emotion'] {
    if (narratives.length === 0) {
      return agent.emotion
    }
    
    // 计算所有叙事的平均情感和强度
    let totalSentiment = 0
    let totalIntensity = 0
    
    for (const narrative of narratives) {
      const impact = this.calculateImpact(agent, narrative)
      totalSentiment += narrative.sentiment * impact
      totalIntensity += narrative.intensity * impact
    }
    
    const avgSentiment = totalSentiment / narratives.length
    const avgIntensity = totalIntensity / narratives.length
    
    // 根据情感选择标签
    let label = agent.emotion.label
    
    if (avgIntensity > 0.7) {
      if (avgSentiment > 0.5) {
        label = 'excited'
      } else if (avgSentiment < -0.5) {
        label = 'anxious'
      } else {
        label = 'tense'
      }
    } else if (avgIntensity > 0.4) {
      if (avgSentiment > 0.3) {
        label = 'hopeful'
      } else if (avgSentiment < -0.3) {
        label = 'worried'
      } else {
        label = 'uncertain'
      }
    }
    
    return {
      label,
      intensity: Math.min(1, agent.emotion.intensity + avgIntensity * 0.3)
    }
  }
  
  /**
   * 影响 agent 的目标
   */
  private influenceGoals(
    agent: PersonalAgentState,
    narratives: NarrativePattern[]
  ): string[] {
    const goals = [...agent.goals]
    
    for (const narrative of narratives) {
      const role = this.determineRole(agent, narrative)
      
      // 根据叙事类型和角色添加目标
      if (narrative.type === 'conflict' && role === 'protagonist') {
        const conflictGoal = `解决与 ${narrative.participants[1] || '对手'} 的冲突`
        if (!goals.includes(conflictGoal)) {
          goals.push(conflictGoal)
        }
      } else if (narrative.type === 'alliance' && role === 'protagonist') {
        const allianceGoal = `维护与 ${narrative.participants[1] || '盟友'} 的联盟`
        if (!goals.includes(allianceGoal)) {
          goals.push(allianceGoal)
        }
      } else if (narrative.type === 'quest' && role === 'protagonist') {
        const questGoal = `完成探索任务`
        if (!goals.includes(questGoal)) {
          goals.push(questGoal)
        }
      } else if (narrative.type === 'transformation' && role === 'protagonist') {
        const transformGoal = `完成自我转变`
        if (!goals.includes(transformGoal)) {
          goals.push(transformGoal)
        }
      }
    }
    
    // 限制目标数量
    return goals.slice(-5)
  }
  
  /**
   * 计算叙事对 agent 的总体影响
   */
  calculateNarrativeImpact(
    agent: PersonalAgentState,
    narrative: NarrativePattern
  ): number {
    const involvement = this.calculateInvolvement(agent, narrative)
    const intensity = narrative.intensity
    const emotionalWeight = Math.abs(narrative.sentiment)
    
    return (involvement * 0.4 + intensity * 0.4 + emotionalWeight * 0.2)
  }
  
  /**
   * 获取 agent 最关注的叙事
   */
  getMostInfluentialNarrative(
    agent: PersonalAgentState,
    narratives: NarrativePattern[]
  ): NarrativePattern | null {
    const participatingNarratives = narratives.filter(n =>
      n.participants.includes(agent.genetics.seed)
    )
    
    if (participatingNarratives.length === 0) {
      return null
    }
    
    // 按影响力排序
    const sorted = participatingNarratives.sort((a, b) => {
      const impactA = this.calculateNarrativeImpact(agent, a)
      const impactB = this.calculateNarrativeImpact(agent, b)
      return impactB - impactA
    })
    
    return sorted[0]
  }
}
