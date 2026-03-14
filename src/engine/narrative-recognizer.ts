/**
 * 叙事识别器 - 从事件流中识别叙事模式
 * 核心算法：基于事件聚类、情感分析、关系追踪
 */

import type {
  NarrativePattern,
  NarrativeType,
  NarrativeStatus,
  NarrativeEvent,
  NarrativePatternRule
} from '@/domain/narrative'
import type { WorldSlice } from '@/domain/world'
import { GraphRAGEngine } from './graph-rag-engine'

export class NarrativeRecognizer {
  // 叙事模式匹配规则
  private rules: NarrativePatternRule[] = [
    {
      type: 'conflict',
      min_events: 2,
      min_participants: 2,
      features: {
        sentiment_pattern: 'opposing',
        relationship_trend: 'weakening',
        emotional_intensity: 'high'
      },
      confidence_threshold: 0.6
    },
    {
      type: 'alliance',
      min_events: 2,
      min_participants: 2,
      features: {
        sentiment_pattern: 'aligned',
        relationship_trend: 'strengthening',
        emotional_intensity: 'medium'
      },
      confidence_threshold: 0.6
    },
    {
      type: 'transformation',
      min_events: 3,
      min_participants: 1,
      features: {
        emotional_intensity: 'high',
        temporal_pattern: 'escalating'
      },
      confidence_threshold: 0.7
    },
    {
      type: 'discovery',
      min_events: 1,
      min_participants: 1,
      features: {
        emotional_intensity: 'high'
      },
      confidence_threshold: 0.5
    }
  ]
  
  constructor(private graphRAG?: GraphRAGEngine) {}
  
  /**
   * 从事件流中识别叙事模式
   */
  async recognizePatterns(
    events: WorldSlice['events'],
    world: WorldSlice
  ): Promise<NarrativePattern[]> {
    // 1. 转换为叙事事件
    const narrativeEvents = this.convertToNarrativeEvents(events, world)
    
    // 2. 事件聚类：找到相关的事件序列
    const eventClusters = this.clusterEvents(narrativeEvents)
    
    // 3. 对每个聚类应用模式匹配
    const patterns: NarrativePattern[] = []
    
    for (const cluster of eventClusters) {
      // 尝试匹配每种叙事类型
      for (const rule of this.rules) {
        const pattern = this.matchPattern(cluster, rule, world.tick)
        if (pattern && pattern.confidence >= rule.confidence_threshold) {
          patterns.push(pattern)
        }
      }
    }
    
    // 4. 去重和合并相似模式
    const uniquePatterns = this.deduplicatePatterns(patterns)
    
    console.log(`[NarrativeRecognizer] Recognized ${uniquePatterns.length} patterns from ${events.length} events`)
    
    return uniquePatterns
  }
  
  /**
   * 追踪叙事发展
   */
  async trackNarrativeDevelopment(
    pattern: NarrativePattern,
    newEvents: WorldSlice['events'],
    world: WorldSlice
  ): Promise<NarrativePattern> {
    // 转换新事件
    const narrativeEvents = this.convertToNarrativeEvents(newEvents, world)
    
    // 找到与这个叙事相关的新事件
    const relevantEvents = narrativeEvents.filter(e =>
      this.isRelevantToNarrative(e, pattern)
    )
    
    if (relevantEvents.length === 0) {
      // 没有新事件，检查是否应该标记为休眠
      const ticksSinceUpdate = world.tick - pattern.updated_at
      if (ticksSinceUpdate > 50 && pattern.status !== 'concluded') {
        return {
          ...pattern,
          status: 'dormant'
        }
      }
      return pattern
    }
    
    // 更新叙事模式
    const updatedPattern: NarrativePattern = {
      ...pattern,
      event_ids: [...pattern.event_ids, ...relevantEvents.map(e => e.id)],
      emotional_arc: [
        ...pattern.emotional_arc,
        ...relevantEvents.map(e => e.sentiment)
      ],
      updated_at: world.tick
    }
    
    // 更新强度
    updatedPattern.intensity = this.calculateIntensity(updatedPattern)
    
    // 更新情感倾向
    updatedPattern.sentiment = this.calculateOverallSentiment(updatedPattern.emotional_arc)
    
    // 检测转折点
    const turningPoint = this.detectTurningPoint(
      pattern.emotional_arc,
      updatedPattern.emotional_arc
    )
    if (turningPoint) {
      updatedPattern.turning_points.push(relevantEvents[turningPoint].id)
    }
    
    // 更新状态
    updatedPattern.status = this.determineNarrativeStage(updatedPattern)
    
    // 检测解决
    if (this.isResolved(updatedPattern, relevantEvents)) {
      updatedPattern.resolution = relevantEvents[relevantEvents.length - 1].id
      updatedPattern.status = 'concluded'
    }
    
    return updatedPattern
  }
  
  /**
   * 转换为叙事事件
   */
  private convertToNarrativeEvents(
    events: WorldSlice['events'],
    world: WorldSlice
  ): NarrativeEvent[] {
    return events.map(event => {
      // 提取参与的 agents
      const agents = this.extractAgents(event, world)
      
      // 分析情感
      const sentiment = this.analyzeSentiment(event)
      const emotional_intensity = Math.abs(sentiment)
      
      // 生成描述
      const description = this.generateEventDescription(event)
      
      // 提取标签
      const tags = this.extractTags(event)
      
      // 分析关系影响
      const affects_relationships = this.analyzeRelationshipImpact(event, agents, world)
      
      return {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        tick: world.tick,
        agents,
        sentiment,
        emotional_intensity,
        description,
        tags,
        affects_relationships
      }
    })
  }
  
  /**
   * 事件聚类
   */
  private clusterEvents(events: NarrativeEvent[]): NarrativeEvent[][] {
    const clusters: NarrativeEvent[][] = []
    const visited = new Set<string>()
    
    for (const event of events) {
      if (visited.has(event.id)) continue
      
      const cluster: NarrativeEvent[] = [event]
      visited.add(event.id)
      
      // 找到相关事件
      for (const other of events) {
        if (visited.has(other.id)) continue
        
        if (this.areEventsRelated(event, other)) {
          cluster.push(other)
          visited.add(other.id)
        }
      }
      
      if (cluster.length >= 2) {
        clusters.push(cluster)
      }
    }
    
    return clusters
  }
  
  /**
   * 判断两个事件是否相关
   */
  private areEventsRelated(e1: NarrativeEvent, e2: NarrativeEvent): boolean {
    // 1. 涉及相同的 agents
    const commonAgents = e1.agents.filter(a => e2.agents.includes(a))
    if (commonAgents.length > 0) return true
    
    // 2. 时间接近（在 10 个 tick 内）
    if (Math.abs(e1.tick - e2.tick) <= 10) {
      // 3. 标签重叠
      const commonTags = e1.tags.filter(t => e2.tags.includes(t))
      if (commonTags.length > 0) return true
    }
    
    return false
  }
  
  /**
   * 模式匹配
   */
  private matchPattern(
    cluster: NarrativeEvent[],
    rule: NarrativePatternRule,
    currentTick: number
  ): NarrativePattern | null {
    // 检查基本条件
    if (cluster.length < rule.min_events) return null
    
    const participants = new Set(cluster.flatMap(e => e.agents))
    if (participants.size < rule.min_participants) return null
    
    // 检查特征
    const confidence = this.calculatePatternConfidence(cluster, rule)
    if (confidence < rule.confidence_threshold) return null
    
    // 创建叙事模式
    const emotional_arc = cluster.map(e => e.sentiment)
    const pattern: NarrativePattern = {
      id: `narrative-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: rule.type,
      participants: Array.from(participants),
      event_ids: cluster.map(e => e.id),
      intensity: this.calculateIntensity({ emotional_arc } as any),
      emotional_arc,
      sentiment: this.calculateOverallSentiment(emotional_arc),
      started_at: cluster[0].tick,
      updated_at: currentTick,
      status: 'emerging',
      catalyst: cluster[0].id,
      turning_points: [],
      tags: this.extractPatternTags(cluster, rule.type),
      confidence
    }
    
    return pattern
  }
  
  /**
   * 计算模式置信度
   */
  private calculatePatternConfidence(
    cluster: NarrativeEvent[],
    rule: NarrativePatternRule
  ): number {
    let score = 0
    let checks = 0
    
    // 检查情感模式
    if (rule.features.sentiment_pattern) {
      checks++
      if (this.checkSentimentPattern(cluster, rule.features.sentiment_pattern)) {
        score++
      }
    }
    
    // 检查关系趋势
    if (rule.features.relationship_trend) {
      checks++
      if (this.checkRelationshipTrend(cluster, rule.features.relationship_trend)) {
        score++
      }
    }
    
    // 检查情感强度
    if (rule.features.emotional_intensity) {
      checks++
      if (this.checkEmotionalIntensity(cluster, rule.features.emotional_intensity)) {
        score++
      }
    }
    
    // 检查时间模式
    if (rule.features.temporal_pattern) {
      checks++
      if (this.checkTemporalPattern(cluster, rule.features.temporal_pattern)) {
        score++
      }
    }
    
    return checks > 0 ? score / checks : 0
  }
  
  /**
   * 检查情感模式
   */
  private checkSentimentPattern(
    cluster: NarrativeEvent[],
    pattern: 'opposing' | 'aligned' | 'mixed'
  ): boolean {
    const sentiments = cluster.map(e => e.sentiment)
    
    if (pattern === 'opposing') {
      // 检查是否有相反的情感
      const hasPositive = sentiments.some(s => s > 0.3)
      const hasNegative = sentiments.some(s => s < -0.3)
      return hasPositive && hasNegative
    } else if (pattern === 'aligned') {
      // 检查情感是否一致
      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      return Math.abs(avgSentiment) > 0.5
    } else {
      // mixed
      return true
    }
  }
  
  /**
   * 检查关系趋势
   */
  private checkRelationshipTrend(
    cluster: NarrativeEvent[],
    trend: 'strengthening' | 'weakening' | 'volatile'
  ): boolean {
    const changes = cluster.flatMap(e => e.affects_relationships.map(r => r.change))
    if (changes.length === 0) return false
    
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length
    
    if (trend === 'strengthening') {
      return avgChange > 0.2
    } else if (trend === 'weakening') {
      return avgChange < -0.2
    } else {
      // volatile
      const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
      return variance > 0.3
    }
  }
  
  /**
   * 检查情感强度
   */
  private checkEmotionalIntensity(
    cluster: NarrativeEvent[],
    intensity: 'high' | 'medium' | 'low'
  ): boolean {
    const avgIntensity = cluster.reduce((sum, e) => sum + e.emotional_intensity, 0) / cluster.length
    
    if (intensity === 'high') {
      return avgIntensity > 0.7
    } else if (intensity === 'medium') {
      return avgIntensity > 0.4 && avgIntensity <= 0.7
    } else {
      return avgIntensity <= 0.4
    }
  }
  
  /**
   * 检查时间模式
   */
  private checkTemporalPattern(
    cluster: NarrativeEvent[],
    pattern: 'continuous' | 'episodic' | 'escalating'
  ): boolean {
    if (cluster.length < 2) return false
    
    const intervals = []
    for (let i = 1; i < cluster.length; i++) {
      intervals.push(cluster[i].tick - cluster[i - 1].tick)
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    
    if (pattern === 'continuous') {
      return avgInterval < 5 && variance < 10
    } else if (pattern === 'episodic') {
      return avgInterval > 10 || variance > 20
    } else {
      // escalating: 间隔越来越短
      return intervals[intervals.length - 1] < intervals[0]
    }
  }
  
  /**
   * 计算叙事强度
   */
  private calculateIntensity(pattern: Pick<NarrativePattern, 'emotional_arc'>): number {
    if (pattern.emotional_arc.length === 0) return 0
    
    // 基于情感强度和变化率
    const avgIntensity = pattern.emotional_arc.reduce((sum, e) => sum + Math.abs(e), 0) / pattern.emotional_arc.length
    
    // 计算变化率
    let totalChange = 0
    for (let i = 1; i < pattern.emotional_arc.length; i++) {
      totalChange += Math.abs(pattern.emotional_arc[i] - pattern.emotional_arc[i - 1])
    }
    const avgChange = pattern.emotional_arc.length > 1 ? totalChange / (pattern.emotional_arc.length - 1) : 0
    
    // 综合强度
    return Math.min(1, avgIntensity * 0.6 + avgChange * 0.4)
  }
  
  /**
   * 计算整体情感倾向
   */
  private calculateOverallSentiment(emotional_arc: number[]): number {
    if (emotional_arc.length === 0) return 0
    return emotional_arc.reduce((a, b) => a + b, 0) / emotional_arc.length
  }
  
  /**
   * 检测转折点
   */
  private detectTurningPoint(oldArc: number[], newArc: number[]): number | null {
    if (newArc.length <= oldArc.length) return null
    
    const newEvents = newArc.slice(oldArc.length)
    
    // 检查情感是否有显著变化
    const oldAvg = oldArc.reduce((a, b) => a + b, 0) / oldArc.length
    const newAvg = newEvents.reduce((a, b) => a + b, 0) / newEvents.length
    
    if (Math.abs(newAvg - oldAvg) > 0.5) {
      return 0  // 第一个新事件是转折点
    }
    
    return null
  }
  
  /**
   * 判断叙事阶段
   */
  private determineNarrativeStage(pattern: NarrativePattern): NarrativeStatus {
    const { emotional_arc, intensity, event_ids } = pattern
    
    // 计算最近的情感变化
    const recentArc = emotional_arc.slice(-5)
    const variance = recentArc.length > 1
      ? recentArc.reduce((sum, e, i, arr) => {
          if (i === 0) return 0
          return sum + Math.pow(e - arr[i - 1], 2)
        }, 0) / (recentArc.length - 1)
      : 0
    
    // 高强度 + 高波动 = 高潮
    if (intensity > 0.7 && variance > 0.5) {
      return 'climax'
    }
    
    // 低强度 + 低波动 = 解决中
    if (intensity < 0.3 && variance < 0.2) {
      return 'resolving'
    }
    
    // 刚开始
    if (event_ids.length < 3) {
      return 'emerging'
    }
    
    // 默认：发展中
    return 'developing'
  }
  
  /**
   * 检查是否已解决
   */
  private isResolved(pattern: NarrativePattern, recentEvents: NarrativeEvent[]): boolean {
    // 简单规则：情感趋于平稳且强度降低
    if (pattern.intensity < 0.2) {
      const recentIntensity = recentEvents.reduce((sum, e) => sum + e.emotional_intensity, 0) / recentEvents.length
      return recentIntensity < 0.3
    }
    return false
  }
  
  /**
   * 去重和合并相似模式
   */
  private deduplicatePatterns(patterns: NarrativePattern[]): NarrativePattern[] {
    const unique: NarrativePattern[] = []
    
    for (const pattern of patterns) {
      // 检查是否与现有模式重复
      const duplicate = unique.find(p =>
        this.arePatternsOverlapping(p, pattern)
      )
      
      if (duplicate) {
        // 合并到现有模式
        if (pattern.confidence > duplicate.confidence) {
          // 替换为置信度更高的
          const index = unique.indexOf(duplicate)
          unique[index] = pattern
        }
      } else {
        unique.push(pattern)
      }
    }
    
    return unique
  }
  
  /**
   * 检查两个模式是否重叠
   */
  private arePatternsOverlapping(p1: NarrativePattern, p2: NarrativePattern): boolean {
    // 相同类型
    if (p1.type !== p2.type) return false
    
    // 参与者重叠 > 50%
    const commonParticipants = p1.participants.filter(a => p2.participants.includes(a))
    const overlapRatio = commonParticipants.length / Math.min(p1.participants.length, p2.participants.length)
    
    return overlapRatio > 0.5
  }
  
  /**
   * 判断事件是否与叙事相关
   */
  private isRelevantToNarrative(event: NarrativeEvent, pattern: NarrativePattern): boolean {
    // 涉及相同的参与者
    return event.agents.some(a => pattern.participants.includes(a))
  }
  
  // ===== 辅助方法 =====
  
  private extractAgents(event: WorldSlice['events'][0], world: WorldSlice): string[] {
    const agents: string[] = []
    
    // 从 payload 中提取
    if (event.payload) {
      if (event.payload.agent_seed) {
        agents.push(String(event.payload.agent_seed))
      }
      if (event.payload.agent_name) {
        // 通过名字找到 agent
        const agent = world.agents.npcs.find(a => a.identity.name === event.payload!.agent_name)
        if (agent) agents.push(agent.genetics.seed)
      }
    }
    
    return agents
  }
  
  private analyzeSentiment(event: WorldSlice['events'][0]): number {
    // 简单的情感分析（基于事件类型）
    const sentimentMap: Record<string, number> = {
      'agent_death': -0.9,
      'agent_reincarnation': 0.3,
      'plot_completed': 0.8,
      'plot_failed': -0.7,
      'plot_triggered': 0.5,
      'micro': 0.0,
      'macro': 0.2
    }
    
    return sentimentMap[event.type] || 0
  }
  
  private generateEventDescription(event: WorldSlice['events'][0]): string {
    return `${event.type} at ${event.timestamp}`
  }
  
  private extractTags(event: WorldSlice['events'][0]): string[] {
    const tags: string[] = [event.type]
    
    if (event.payload) {
      if (event.payload.plot_title) tags.push('plot')
      if (event.payload.agent_name) tags.push('agent')
    }
    
    return tags
  }
  
  private analyzeRelationshipImpact(
    event: WorldSlice['events'][0],
    agents: string[],
    world: WorldSlice
  ): Array<{ agent1: string; agent2: string; change: number }> {
    // 简化：假设事件对关系有影响
    const impacts: Array<{ agent1: string; agent2: string; change: number }> = []
    
    if (agents.length >= 2) {
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          impacts.push({
            agent1: agents[i],
            agent2: agents[j],
            change: this.analyzeSentiment(event) * 0.1
          })
        }
      }
    }
    
    return impacts
  }
  
  private extractPatternTags(cluster: NarrativeEvent[], type: NarrativeType): string[] {
    const tags = new Set<string>([type])
    
    // 添加事件标签
    cluster.forEach(e => e.tags.forEach(t => tags.add(t)))
    
    return Array.from(tags)
  }
}
