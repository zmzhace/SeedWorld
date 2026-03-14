/**
 * 分层记忆系统 - Phase 5
 * 核心：实现工作记忆、短期记忆、长期记忆的三层架构
 * 兼容现有的 memory_short 和 memory_long
 */

import type { PersonalAgentState, Memory } from '@/domain/world'

export type WorkingMemory = {
  id: string
  content: string
  activation: number  // 激活度 [0-1]
  timestamp: string
  source: 'perception' | 'retrieval' | 'reasoning'
  expires_at: number  // 过期时间（tick）
}

export type ShortTermMemory = Memory & {
  consolidation_score: number  // 巩固分数 [0-1]
  rehearsal_count: number  // 复述次数
  last_accessed: number  // 最后访问时间
}

export type LongTermMemory = Memory & {
  schema_tags: string[]  // 图式标签
  episodic_context?: {  // 情景上下文
    location?: string
    participants?: string[]
    time_period?: string
  }
  semantic_links: string[]  // 语义链接（关联的其他记忆）
  consolidation_level: number  // 巩固程度 [0-1]
}

export type MemoryIndex = {
  by_importance: Map<number, string[]>  // 重要性索引
  by_emotion: Map<string, string[]>  // 情绪索引
  by_source: Map<string, string[]>  // 来源索引
  by_tag: Map<string, string[]>  // 标签索引
  by_time: Map<number, string[]>  // 时间索引
}

export class HierarchicalMemorySystem {
  private workingMemory: Map<string, WorkingMemory> = new Map()
  private shortTermMemory: Map<string, ShortTermMemory> = new Map()
  private longTermMemory: Map<string, LongTermMemory> = new Map()
  private memoryIndex: MemoryIndex = {
    by_importance: new Map(),
    by_emotion: new Map(),
    by_source: new Map(),
    by_tag: new Map(),
    by_time: new Map()
  }
  
  private readonly WORKING_MEMORY_CAPACITY = 7  // 米勒定律：7±2
  private readonly SHORT_TERM_CAPACITY = 50
  private readonly CONSOLIDATION_THRESHOLD = 0.7
  
  /**
   * 从现有 agent 迁移记忆
   */
  migrateFromAgent(agent: PersonalAgentState, currentTick: number): void {
    // 迁移短期记忆
    for (const mem of agent.memory_short) {
      const stm: ShortTermMemory = {
        ...mem,
        consolidation_score: mem.importance * mem.retrieval_strength,
        rehearsal_count: 0,
        last_accessed: currentTick
      }
      this.shortTermMemory.set(mem.id, stm)
      this.indexMemory(mem.id, stm, currentTick)
    }
    
    // 迁移长期记忆
    for (const mem of agent.memory_long) {
      const ltm: LongTermMemory = {
        ...mem,
        schema_tags: this.extractTags(mem.content),
        semantic_links: [],
        consolidation_level: 0.8
      }
      this.longTermMemory.set(mem.id, ltm)
      this.indexMemory(mem.id, ltm, currentTick)
    }
  }
  
  /**
   * 添加到工作记忆
   */
  addToWorkingMemory(
    content: string,
    source: WorkingMemory['source'],
    currentTick: number
  ): WorkingMemory {
    // 检查容量
    if (this.workingMemory.size >= this.WORKING_MEMORY_CAPACITY) {
      // 移除激活度最低的
      const lowest = Array.from(this.workingMemory.values())
        .sort((a, b) => a.activation - b.activation)[0]
      this.workingMemory.delete(lowest.id)
    }
    
    const wm: WorkingMemory = {
      id: `wm-${currentTick}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      activation: 1.0,
      timestamp: new Date().toISOString(),
      source,
      expires_at: currentTick + 3  // 3 ticks 后过期
    }
    
    this.workingMemory.set(wm.id, wm)
    return wm
  }
  
  /**
   * 添加到短期记忆
   */
  addToShortTermMemory(
    content: string,
    importance: number,
    emotional_weight: number,
    source: Memory['source'],
    currentTick: number
  ): ShortTermMemory {
    // 检查容量
    if (this.shortTermMemory.size >= this.SHORT_TERM_CAPACITY) {
      // 移除最不重要的
      const lowest = Array.from(this.shortTermMemory.values())
        .sort((a, b) => a.consolidation_score - b.consolidation_score)[0]
      this.shortTermMemory.delete(lowest.id)
      this.removeFromIndex(lowest.id)
    }
    
    const stm: ShortTermMemory = {
      id: `stm-${currentTick}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      importance,
      emotional_weight,
      source,
      timestamp: new Date().toISOString(),
      decay_rate: 0.1,
      retrieval_strength: 1.0,
      consolidation_score: importance * Math.abs(emotional_weight),
      rehearsal_count: 0,
      last_accessed: currentTick
    }
    
    this.shortTermMemory.set(stm.id, stm)
    this.indexMemory(stm.id, stm, currentTick)
    return stm
  }
  
  /**
   * 巩固到长期记忆
   */
  consolidateToLongTerm(
    stmId: string,
    currentTick: number
  ): LongTermMemory | null {
    const stm = this.shortTermMemory.get(stmId)
    if (!stm) return null
    
    // 检查是否达到巩固阈值
    if (stm.consolidation_score < this.CONSOLIDATION_THRESHOLD) {
      return null
    }
    
    const ltm: LongTermMemory = {
      id: `ltm-${currentTick}-${Math.random().toString(36).substr(2, 9)}`,
      content: stm.content,
      importance: stm.importance,
      emotional_weight: stm.emotional_weight,
      source: stm.source,
      timestamp: stm.timestamp,
      decay_rate: 0.01,  // 长期记忆衰减慢
      retrieval_strength: stm.retrieval_strength * 0.8,
      schema_tags: this.extractTags(stm.content),
      semantic_links: this.findSemanticLinks(stm.content),
      consolidation_level: stm.consolidation_score
    }
    
    this.longTermMemory.set(ltm.id, ltm)
    this.indexMemory(ltm.id, ltm, currentTick)
    
    // 从短期记忆移除
    this.shortTermMemory.delete(stmId)
    this.removeFromIndex(stmId)
    
    return ltm
  }
  
  /**
   * 检索记忆（多层检索）
   */
  retrieve(
    query: {
      keywords?: string[]
      importance_min?: number
      emotion_range?: [number, number]
      source?: Memory['source']
      tags?: string[]
      time_range?: [number, number]
    },
    currentTick: number,
    limit: number = 10
  ): Array<WorkingMemory | ShortTermMemory | LongTermMemory> {
    const results: Array<{ memory: any; score: number; layer: string }> = []
    
    // 1. 搜索工作记忆（最高优先级）
    for (const wm of this.workingMemory.values()) {
      const score = this.calculateRetrievalScore(wm, query, currentTick)
      if (score > 0.3) {
        results.push({ memory: wm, score: score * 1.5, layer: 'working' })
      }
    }
    
    // 2. 搜索短期记忆
    for (const stm of this.shortTermMemory.values()) {
      const score = this.calculateRetrievalScore(stm, query, currentTick)
      if (score > 0.3) {
        results.push({ memory: stm, score, layer: 'short_term' })
        
        // 更新访问信息
        stm.last_accessed = currentTick
        stm.rehearsal_count++
        stm.consolidation_score = Math.min(1, stm.consolidation_score + 0.1)
      }
    }
    
    // 3. 搜索长期记忆
    for (const ltm of this.longTermMemory.values()) {
      const score = this.calculateRetrievalScore(ltm, query, currentTick)
      if (score > 0.3) {
        results.push({ memory: ltm, score: score * 0.8, layer: 'long_term' })
      }
    }
    
    // 按分数排序并返回
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.memory)
  }
  
  /**
   * 计算检索分数
   */
  private calculateRetrievalScore(
    memory: any,
    query: any,
    currentTick: number
  ): number {
    let score = 0
    
    // 关键词匹配
    if (query.keywords) {
      const matchCount = query.keywords.filter(kw =>
        memory.content.toLowerCase().includes(kw.toLowerCase())
      ).length
      score += (matchCount / query.keywords.length) * 0.4
    }
    
    // 重要性匹配
    if (query.importance_min !== undefined) {
      if (memory.importance >= query.importance_min) {
        score += 0.2
      }
    }
    
    // 情绪匹配
    if (query.emotion_range) {
      const [min, max] = query.emotion_range
      if (memory.emotional_weight >= min && memory.emotional_weight <= max) {
        score += 0.2
      }
    }
    
    // 来源匹配
    if (query.source && memory.source === query.source) {
      score += 0.1
    }
    
    // 标签匹配（长期记忆）
    if (query.tags && 'schema_tags' in memory) {
      const matchCount = query.tags.filter(tag =>
        memory.schema_tags.includes(tag)
      ).length
      score += (matchCount / query.tags.length) * 0.3
    }
    
    // 时间衰减
    const age = currentTick - parseInt(memory.id.split('-')[1] || '0')
    const timeFactor = Math.exp(-age * memory.decay_rate)
    score *= timeFactor
    
    // 检索强度
    score *= memory.retrieval_strength || 1
    
    return Math.min(1, score)
  }
  
  /**
   * 提取标签
   */
  private extractTags(content: string): string[] {
    const tags: string[] = []
    
    // 简单的关键词提取
    const keywords = [
      '冲突', '合作', '帮助', '竞争', '学习', '创造',
      '友谊', '敌对', '成功', '失败', '快乐', '悲伤',
      '目标', '计划', '决策', '行动'
    ]
    
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        tags.push(keyword)
      }
    }
    
    return tags
  }
  
  /**
   * 找到语义链接
   */
  private findSemanticLinks(content: string): string[] {
    const links: string[] = []
    
    // 在长期记忆中找相似内容
    for (const [id, ltm] of this.longTermMemory) {
      // 简单的相似度计算
      const similarity = this.calculateSimilarity(content, ltm.content)
      if (similarity > 0.5) {
        links.push(id)
      }
    }
    
    return links.slice(0, 5)  // 最多5个链接
  }
  
  /**
   * 计算相似度
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }
  
  /**
   * 索引记忆
   */
  private indexMemory(
    id: string,
    memory: ShortTermMemory | LongTermMemory,
    currentTick: number
  ): void {
    // 重要性索引
    const importanceKey = Math.floor(memory.importance * 10)
    const importanceList = this.memoryIndex.by_importance.get(importanceKey) || []
    importanceList.push(id)
    this.memoryIndex.by_importance.set(importanceKey, importanceList)
    
    // 情绪索引
    const emotionKey = memory.emotional_weight > 0 ? 'positive' : 
                       memory.emotional_weight < 0 ? 'negative' : 'neutral'
    const emotionList = this.memoryIndex.by_emotion.get(emotionKey) || []
    emotionList.push(id)
    this.memoryIndex.by_emotion.set(emotionKey, emotionList)
    
    // 来源索引
    const sourceList = this.memoryIndex.by_source.get(memory.source) || []
    sourceList.push(id)
    this.memoryIndex.by_source.set(memory.source, sourceList)
    
    // 标签索引（长期记忆）
    if ('schema_tags' in memory) {
      for (const tag of memory.schema_tags) {
        const tagList = this.memoryIndex.by_tag.get(tag) || []
        tagList.push(id)
        this.memoryIndex.by_tag.set(tag, tagList)
      }
    }
    
    // 时间索引
    const timeKey = Math.floor(currentTick / 10) * 10
    const timeList = this.memoryIndex.by_time.get(timeKey) || []
    timeList.push(id)
    this.memoryIndex.by_time.set(timeKey, timeList)
  }
  
  /**
   * 从索引移除
   */
  private removeFromIndex(id: string): void {
    // 从所有索引中移除
    for (const index of Object.values(this.memoryIndex)) {
      for (const [key, list] of index) {
        const filtered = list.filter(memId => memId !== id)
        if (filtered.length > 0) {
          index.set(key, filtered)
        } else {
          index.delete(key)
        }
      }
    }
  }
  
  /**
   * 记忆衰减
   */
  applyDecay(currentTick: number): void {
    // 工作记忆：移除过期的
    for (const [id, wm] of this.workingMemory) {
      if (currentTick >= wm.expires_at) {
        // 转移到短期记忆
        this.addToShortTermMemory(
          wm.content,
          0.5,
          0,
          'self',
          currentTick
        )
        this.workingMemory.delete(id)
      } else {
        // 激活度衰减
        wm.activation *= 0.8
      }
    }
    
    // 短期记忆：衰减检索强度
    for (const stm of this.shortTermMemory.values()) {
      stm.retrieval_strength *= (1 - stm.decay_rate)
      
      // 尝试巩固
      if (stm.consolidation_score >= this.CONSOLIDATION_THRESHOLD) {
        this.consolidateToLongTerm(stm.id, currentTick)
      }
      
      // 移除检索强度过低的
      if (stm.retrieval_strength < 0.1) {
        this.shortTermMemory.delete(stm.id)
        this.removeFromIndex(stm.id)
      }
    }
    
    // 长期记忆：缓慢衰减
    for (const ltm of this.longTermMemory.values()) {
      ltm.retrieval_strength *= (1 - ltm.decay_rate)
    }
  }
  
  /**
   * 复述记忆（增强巩固）
   */
  rehearseMemory(memoryId: string, currentTick: number): void {
    const stm = this.shortTermMemory.get(memoryId)
    if (stm) {
      stm.rehearsal_count++
      stm.consolidation_score = Math.min(1, stm.consolidation_score + 0.15)
      stm.retrieval_strength = Math.min(1, stm.retrieval_strength + 0.1)
      stm.last_accessed = currentTick
    }
  }
  
  /**
   * 导出到 agent 格式（兼容性）
   */
  exportToAgent(): {
    memory_short: Memory[]
    memory_long: Memory[]
  } {
    return {
      memory_short: Array.from(this.shortTermMemory.values()).map(stm => ({
        id: stm.id,
        content: stm.content,
        importance: stm.importance,
        emotional_weight: stm.emotional_weight,
        source: stm.source,
        timestamp: stm.timestamp,
        decay_rate: stm.decay_rate,
        retrieval_strength: stm.retrieval_strength
      })),
      memory_long: Array.from(this.longTermMemory.values()).map(ltm => ({
        id: ltm.id,
        content: ltm.content,
        importance: ltm.importance,
        emotional_weight: ltm.emotional_weight,
        source: ltm.source,
        timestamp: ltm.timestamp,
        decay_rate: ltm.decay_rate,
        retrieval_strength: ltm.retrieval_strength
      }))
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      working_memory: {
        count: this.workingMemory.size,
        capacity: this.WORKING_MEMORY_CAPACITY,
        utilization: this.workingMemory.size / this.WORKING_MEMORY_CAPACITY
      },
      short_term_memory: {
        count: this.shortTermMemory.size,
        capacity: this.SHORT_TERM_CAPACITY,
        utilization: this.shortTermMemory.size / this.SHORT_TERM_CAPACITY,
        avg_consolidation: Array.from(this.shortTermMemory.values())
          .reduce((sum, m) => sum + m.consolidation_score, 0) / this.shortTermMemory.size || 0,
        ready_for_consolidation: Array.from(this.shortTermMemory.values())
          .filter(m => m.consolidation_score >= this.CONSOLIDATION_THRESHOLD).length
      },
      long_term_memory: {
        count: this.longTermMemory.size,
        avg_consolidation: Array.from(this.longTermMemory.values())
          .reduce((sum, m) => sum + m.consolidation_level, 0) / this.longTermMemory.size || 0,
        total_semantic_links: Array.from(this.longTermMemory.values())
          .reduce((sum, m) => sum + m.semantic_links.length, 0)
      },
      index: {
        importance_buckets: this.memoryIndex.by_importance.size,
        emotion_categories: this.memoryIndex.by_emotion.size,
        source_types: this.memoryIndex.by_source.size,
        unique_tags: this.memoryIndex.by_tag.size,
        time_periods: this.memoryIndex.by_time.size
      }
    }
  }
}
