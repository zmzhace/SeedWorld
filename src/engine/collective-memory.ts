/**
 * 群体记忆系统 - 从个体记忆中涌现集体记忆
 * 核心概念：当多个 agents 有相似记忆时，形成群体记忆
 */

import type { PersonalAgentState, MemoryRecord, WorldSlice } from '@/domain/world'

export type CollectiveMemory = {
  id: string
  content: string  // 群体记忆的内容
  participants: string[]  // 参与者（拥有相似记忆的 agents）
  strength: number  // 记忆强度 [0-1]
  formed_at: number  // 形成时的 tick
  last_reinforced: number  // 最后强化时的 tick
  reinforcement_count: number  // 强化次数
  
  // 记忆类型
  type: 'event' | 'norm' | 'belief' | 'history'
  
  // 影响
  influence_on_behavior: number  // 对行为的影响 [0-1]
  influence_on_culture: number  // 对文化的影响 [0-1]
  
  // 演化
  original_content: string  // 原始内容
  evolution_history: Array<{
    tick: number
    content: string
    reason: string
  }>
}

export type CulturalNorm = {
  id: string
  description: string  // 规范描述
  strength: number  // 规范强度
  adherents: string[]  // 遵守者
  violators: string[]  // 违反者
  formed_from: string  // 来源的群体记忆 ID
}

export class CollectiveMemorySystem {
  private collectiveMemories: Map<string, CollectiveMemory> = new Map()
  private culturalNorms: Map<string, CulturalNorm> = new Map()
  
  /**
   * 检测群体记忆形成
   */
  detectCollectiveMemory(
    agents: PersonalAgentState[],
    currentTick: number,
    threshold: number = 0.7  // 相似度阈值
  ): CollectiveMemory[] {
    const newMemories: CollectiveMemory[] = []
    
    // 收集所有 agents 的记忆
    const allMemories: Array<{ agent: string; memory: MemoryRecord }> = []
    for (const agent of agents) {
      for (const memory of [...agent.memory_short, ...agent.memory_long]) {
        allMemories.push({ agent: agent.genetics.seed, memory })
      }
    }
    
    // 按内容分组（简化版：基于关键词）
    const memoryGroups = this.groupSimilarMemories(allMemories, threshold)
    
    // 检查每组是否形成群体记忆
    for (const group of memoryGroups) {
      if (group.length >= 3) {  // 至少 3 个 agents 有相似记忆
        const collectiveMemory = this.createCollectiveMemory(group, currentTick)
        newMemories.push(collectiveMemory)
        this.collectiveMemories.set(collectiveMemory.id, collectiveMemory)
      }
    }
    
    return newMemories
  }
  
  /**
   * 分组相似记忆
   */
  private groupSimilarMemories(
    memories: Array<{ agent: string; memory: MemoryRecord }>,
    threshold: number
  ): Array<Array<{ agent: string; memory: MemoryRecord }>> {
    const groups: Array<Array<{ agent: string; memory: MemoryRecord }>> = []
    const processed = new Set<string>()
    
    for (const item of memories) {
      if (processed.has(item.memory.id)) continue
      
      const group = [item]
      processed.add(item.memory.id)
      
      // 找到相似的记忆
      for (const other of memories) {
        if (processed.has(other.memory.id)) continue
        
        const similarity = this.calculateMemorySimilarity(
          item.memory.content,
          other.memory.content
        )
        
        if (similarity >= threshold) {
          group.push(other)
          processed.add(other.memory.id)
        }
      }
      
      if (group.length >= 2) {
        groups.push(group)
      }
    }
    
    return groups
  }
  
  /**
   * 计算记忆相似度（简化版：基于关键词重叠）
   */
  private calculateMemorySimilarity(content1: string, content2: string): number {
    // 提取关键词
    const words1 = new Set(content1.toLowerCase().split(/\s+/))
    const words2 = new Set(content2.toLowerCase().split(/\s+/))
    
    // 计算交集
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    
    // Jaccard 相似度
    const union = new Set([...words1, ...words2])
    return intersection.size / union.size
  }
  
  /**
   * 创建群体记忆
   */
  private createCollectiveMemory(
    group: Array<{ agent: string; memory: MemoryRecord }>,
    currentTick: number
  ): CollectiveMemory {
    // 合成群体记忆内容（取最常见的描述）
    const contents = group.map(g => g.memory.content)
    const synthesizedContent = this.synthesizeContent(contents)
    
    // 提取参与者
    const participants = group.map(g => g.agent)
    
    // 计算强度（基于参与者数量和记忆重要性）
    const avgImportance = group.reduce((sum, g) => sum + g.memory.importance, 0) / group.length
    const strength = Math.min(1, (participants.length / 10) * avgImportance)
    
    // 判断记忆类型（使用第一个记忆的 source 和 emotional_weight）
    const firstMemory = group[0].memory
    const type = this.classifyMemoryType(synthesizedContent, firstMemory.source, firstMemory.emotional_weight)
    
    return {
      id: `collective-${currentTick}-${Math.random().toString(36).substr(2, 9)}`,
      content: synthesizedContent,
      participants,
      strength,
      formed_at: currentTick,
      last_reinforced: currentTick,
      reinforcement_count: 1,
      type,
      influence_on_behavior: strength * 0.5,
      influence_on_culture: strength * 0.3,
      original_content: synthesizedContent,
      evolution_history: []
    }
  }
  
  /**
   * 合成内容
   */
  private synthesizeContent(contents: string[]): string {
    // 简化：返回最长的内容（通常最详细）
    return contents.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    , contents[0])
  }
  
  /**
   * 分类记忆类型
   * Language-agnostic: uses source field and emotional_weight instead of keyword matching
   */
  private classifyMemoryType(
    _content: string,
    source?: MemoryRecord['source'],
    emotionalWeight?: number
  ): CollectiveMemory['type'] {
    // Classify based on structured fields rather than content keywords
    if (source === 'social') {
      return 'norm'
    } else if (source === 'self') {
      return 'belief'
    } else if (source === 'world' && (emotionalWeight === undefined || Math.abs(emotionalWeight) < 0.3)) {
      return 'history'
    } else {
      return 'event'
    }
  }
  
  /**
   * 传播群体记忆
   */
  propagateMemory(
    memory: CollectiveMemory,
    agents: PersonalAgentState[],
    currentTick: number
  ): PersonalAgentState[] {
    return agents.map(agent => {
      // 检查 agent 是否应该接收这个记忆
      if (this.shouldReceiveMemory(agent, memory)) {
        // 创建个体记忆
        const individualMemory: MemoryRecord = {
          id: `propagated-${memory.id}-${agent.genetics.seed}`,
          content: `collective memory: ${memory.content}`,
          importance: memory.strength * 0.8,
          emotional_weight: 0,
          source: 'social',
          timestamp: new Date().toISOString(),
          decay_rate: 0.01,  // 群体记忆衰减很慢
          retrieval_strength: memory.strength
        }
        
        return {
          ...agent,
          memory_long: [...agent.memory_long, individualMemory]
        }
      }
      
      return agent
    })
  }
  
  /**
   * 判断 agent 是否应该接收记忆
   */
  private shouldReceiveMemory(
    agent: PersonalAgentState,
    memory: CollectiveMemory
  ): boolean {
    // 如果已经是参与者，不需要再接收
    if (memory.participants.includes(agent.genetics.seed)) {
      return false
    }
    
    // 基于社交关系：如果与参与者有关系，更可能接收
    const hasRelationWithParticipants = memory.participants.some(
      participant => agent.relations[participant] !== undefined
    )
    
    if (hasRelationWithParticipants) {
      return Math.random() < memory.strength
    }
    
    // 否则，基于记忆强度随机决定
    return Math.random() < memory.strength * 0.3
  }
  
  /**
   * 强化群体记忆
   */
  reinforceMemory(
    memoryId: string,
    newEvidence: string,
    currentTick: number
  ): CollectiveMemory | null {
    const memory = this.collectiveMemories.get(memoryId)
    if (!memory) return null
    
    // 增加强化次数
    memory.reinforcement_count++
    memory.last_reinforced = currentTick
    
    // 增加强度
    memory.strength = Math.min(1, memory.strength + 0.1)
    
    // 记录演化
    memory.evolution_history.push({
      tick: currentTick,
      content: memory.content,
      reason: 'reinforced'
    })
    
    return memory
  }
  
  /**
   * 群体记忆演化
   */
  evolveMemory(
    memory: CollectiveMemory,
    newEvents: Array<{ content: string; tick: number }>,
    currentTick: number
  ): CollectiveMemory {
    // 检查新事件是否与记忆相关
    const relevantEvents = newEvents.filter(event =>
      this.calculateMemorySimilarity(memory.content, event.content) > 0.5
    )
    
    if (relevantEvents.length === 0) {
      // 没有相关事件，记忆衰减
      memory.strength = Math.max(0, memory.strength - 0.05)
      return memory
    }
    
    // 有相关事件，记忆演化
    const newContent = this.synthesizeContent([
      memory.content,
      ...relevantEvents.map(e => e.content)
    ])
    
    if (newContent !== memory.content) {
      memory.evolution_history.push({
        tick: currentTick,
        content: memory.content,
        reason: 'evolved based on new events'
      })
      
      memory.content = newContent
      memory.last_reinforced = currentTick
    }
    
    return memory
  }
  
  /**
   * 从群体记忆中提取文化规范
   */
  extractCulturalNorms(
    memories: CollectiveMemory[]
  ): CulturalNorm[] {
    const norms: CulturalNorm[] = []
    
    for (const memory of memories) {
      if (memory.type === 'norm' && memory.strength > 0.6) {
        const norm: CulturalNorm = {
          id: `norm-${memory.id}`,
          description: memory.content,
          strength: memory.strength,
          adherents: [...memory.participants],
          violators: [],
          formed_from: memory.id
        }
        
        norms.push(norm)
        this.culturalNorms.set(norm.id, norm)
      }
    }
    
    return norms
  }
  
  /**
   * 检查 agent 是否违反文化规范
   */
  checkNormViolation(
    agent: PersonalAgentState,
    action: string,
    norms: CulturalNorm[]
  ): CulturalNorm | null {
    for (const norm of norms) {
      // 简化：基于关键词检查
      if (this.isActionViolatingNorm(action, norm.description)) {
        return norm
      }
    }
    
    return null
  }
  
  /**
   * 判断行动是否违反规范
   * Language-agnostic: compares action/norm content similarity instead of keyword matching
   */
  private isActionViolatingNorm(action: string, normDescription: string): boolean {
    // Use content similarity to determine if an action conflicts with a norm
    const similarity = this.calculateMemorySimilarity(action, normDescription)
    return similarity > 0.4
  }
  
  /**
   * 获取所有群体记忆
   */
  getAllCollectiveMemories(): CollectiveMemory[] {
    return Array.from(this.collectiveMemories.values())
  }
  
  /**
   * 获取所有文化规范
   */
  getAllCulturalNorms(): CulturalNorm[] {
    return Array.from(this.culturalNorms.values())
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const memories = this.getAllCollectiveMemories()
    const norms = this.getAllCulturalNorms()

    return {
      total_memories: memories.length,
      strong_memories: memories.filter(m => m.strength > 0.7).length,
      total_norms: norms.length,
      strong_norms: norms.filter(n => n.strength > 0.7).length,
      avg_participants: memories.reduce((sum, m) => sum + m.participants.length, 0) / Math.max(1, memories.length),
      memory_types: {
        event: memories.filter(m => m.type === 'event').length,
        norm: memories.filter(m => m.type === 'norm').length,
        belief: memories.filter(m => m.type === 'belief').length,
        history: memories.filter(m => m.type === 'history').length
      }
    }
  }

  /**
   * Serialize all internal state to a snapshot
   */
  toSnapshot(): {
    collectiveMemories: Array<[string, CollectiveMemory]>
    culturalNorms: Array<[string, CulturalNorm]>
  } {
    return {
      collectiveMemories: Array.from(this.collectiveMemories.entries()),
      culturalNorms: Array.from(this.culturalNorms.entries())
    }
  }

  /**
   * Restore internal state from a snapshot
   */
  fromSnapshot(snapshot: {
    collectiveMemories: Array<[string, CollectiveMemory]>
    culturalNorms: Array<[string, CulturalNorm]>
  }): void {
    this.collectiveMemories = new Map(snapshot.collectiveMemories)
    this.culturalNorms = new Map(snapshot.culturalNorms)
  }
}
