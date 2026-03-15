/**
 * 故事弧检测器 - 从叙事模式中识别完整的故事结构
 * 基于经典的三幕剧结构和情感曲线分析
 */

import type {
  NarrativePattern,
  StoryArc,
  StoryArcStage,
  NarrativeStatus
} from '@/domain/narrative'

export class StoryArcDetector {
  /**
   * 从叙事模式中检测故事弧
   */
  async detectArcs(patterns: NarrativePattern[]): Promise<StoryArc[]> {
    if (patterns.length === 0) return []
    
    // 1. 按参与者分组
    const patternGroups = this.groupPatternsByParticipants(patterns)
    
    // 2. 为每组检测故事弧
    const arcs: StoryArc[] = []
    
    for (const group of patternGroups) {
      const arc = this.detectArcFromGroup(group)
      if (arc) {
        arcs.push(arc)
      }
    }
    
    // 3. 识别主线和支线
    this.classifyArcs(arcs)
    
    console.log(`[StoryArcDetector] Detected ${arcs.length} story arcs`)
    
    return arcs
  }
  
  /**
   * 按参与者分组叙事模式
   */
  private groupPatternsByParticipants(
    patterns: NarrativePattern[]
  ): NarrativePattern[][] {
    const groups: NarrativePattern[][] = []
    const processed = new Set<string>()
    
    for (const pattern of patterns) {
      if (processed.has(pattern.id)) continue
      
      // 找到所有涉及相同参与者的模式
      const group = patterns.filter(p => {
        if (processed.has(p.id)) return false
        
        // 检查参与者重叠
        const overlap = p.participants.filter(a =>
          pattern.participants.includes(a)
        )
        return overlap.length > 0
      })
      
      group.forEach(p => processed.add(p.id))
      
      if (group.length >= 2) {
        groups.push(group)
      }
    }
    
    return groups
  }
  
  /**
   * 从一组模式中检测故事弧
   */
  private detectArcFromGroup(patterns: NarrativePattern[]): StoryArc | null {
    if (patterns.length < 2) return null
    
    // 按时间排序
    const sorted = patterns.sort((a, b) => a.started_at - b.started_at)
    
    // 分析故事结构
    const structure = this.analyzeStructure(sorted)
    
    // 如果没有明确的结构，返回 null
    if (!structure.setup.length && !structure.rising.length) {
      return null
    }
    
    // 提取参与者
    const allParticipants = new Set(sorted.flatMap(p => p.participants))
    const { protagonists, antagonists, supporting } = this.identifyRoles(sorted)
    
    // 计算情感曲线
    const emotional_curve = this.calculateEmotionalCurve(sorted)
    
    // 计算节奏
    const pacing = this.calculatePacing(sorted)
    
    // 确定当前阶段
    const current_stage = this.determineCurrentStage(structure)
    
    // 确定状态
    const status = this.determineArcStatus(structure, sorted)
    
    // 计算完整度
    const completeness = this.calculateCompleteness(structure)
    
    // 生成标题
    const title = this.generateArcTitle(sorted, protagonists)
    
    const arc: StoryArc = {
      id: `arc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'main',  // 暂时都标记为主线，后续分类
      title,
      structure,
      protagonists,
      antagonists,
      supporting,
      emotional_curve,
      pacing,
      current_stage,
      status,
      completeness,
      started_at: sorted[0].started_at,
      updated_at: sorted[sorted.length - 1].updated_at,
      concluded_at: status === 'concluded' ? sorted[sorted.length - 1].updated_at : undefined
    }
    
    return arc
  }
  
  /**
   * 分析故事结构（三幕剧）
   */
  private analyzeStructure(patterns: NarrativePattern[]): StoryArc['structure'] {
    const structure: StoryArc['structure'] = {
      setup: [],
      rising: [],
      climax: [],
      falling: [],
      resolution: []
    }
    
    // 基于叙事状态和情感曲线分配到不同阶段
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i]
      const stage = this.determinePatternStage(pattern, i, patterns.length)
      
      structure[stage].push(pattern)
    }
    
    return structure
  }
  
  /**
   * 确定模式所属的故事阶段
   */
  private determinePatternStage(
    pattern: NarrativePattern,
    index: number,
    total: number
  ): StoryArcStage {
    // 基于位置和状态
    const position = index / total
    
    // 前 20%：铺垫
    if (position < 0.2 || pattern.status === 'emerging') {
      return 'setup'
    }
    
    // 20-60%：上升
    if (position < 0.6 || pattern.status === 'developing') {
      return 'rising'
    }
    
    // 60-70%：高潮
    if (position < 0.7 || pattern.status === 'climax') {
      return 'climax'
    }
    
    // 70-90%：下降
    if (position < 0.9 || pattern.status === 'resolving') {
      return 'falling'
    }
    
    // 90-100%：解决
    return 'resolution'
  }
  
  /**
   * 识别角色（主角、对手、配角）
   */
  private identifyRoles(patterns: NarrativePattern[]): {
    protagonists: string[]
    antagonists: string[]
    supporting: string[]
  } {
    // 统计每个参与者的出现频率和影响力
    const participantStats = new Map<string, {
      frequency: number
      totalIntensity: number
      conflictRole: 'positive' | 'negative' | 'neutral'
    }>()
    
    for (const pattern of patterns) {
      for (const participant of pattern.participants) {
        const stats = participantStats.get(participant) || {
          frequency: 0,
          totalIntensity: 0,
          conflictRole: 'neutral'
        }
        
        stats.frequency++
        stats.totalIntensity += pattern.intensity
        
        // 基于情感倾向判断角色
        if (pattern.type === 'conflict') {
          if (pattern.sentiment > 0) {
            stats.conflictRole = 'positive'
          } else if (pattern.sentiment < 0) {
            stats.conflictRole = 'negative'
          }
        }
        
        participantStats.set(participant, stats)
      }
    }
    
    // 排序并分类
    const sorted = Array.from(participantStats.entries())
      .sort((a, b) => b[1].totalIntensity - a[1].totalIntensity)
    
    const protagonists: string[] = []
    const antagonists: string[] = []
    const supporting: string[] = []
    
    for (let i = 0; i < sorted.length; i++) {
      const [participant, stats] = sorted[i]
      
      if (i < 2) {
        // 前两名：主角或对手
        if (stats.conflictRole === 'negative') {
          antagonists.push(participant)
        } else {
          protagonists.push(participant)
        }
      } else {
        // 其他：配角
        supporting.push(participant)
      }
    }
    
    // 确保至少有一个主角
    if (protagonists.length === 0 && sorted.length > 0) {
      protagonists.push(sorted[0][0])
    }
    
    return { protagonists, antagonists, supporting }
  }
  
  /**
   * 计算情感曲线
   */
  private calculateEmotionalCurve(patterns: NarrativePattern[]): number[] {
    // 合并所有模式的情感曲线
    const allEmotions: number[] = []
    
    for (const pattern of patterns) {
      allEmotions.push(...pattern.emotional_arc)
    }
    
    // 平滑处理（移动平均）
    const windowSize = 3
    const smoothed: number[] = []
    
    for (let i = 0; i < allEmotions.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2))
      const end = Math.min(allEmotions.length, i + Math.ceil(windowSize / 2))
      const window = allEmotions.slice(start, end)
      const avg = window.reduce((a, b) => a + b, 0) / window.length
      smoothed.push(avg)
    }
    
    return smoothed
  }
  
  /**
   * 计算节奏（事件密度）
   */
  private calculatePacing(patterns: NarrativePattern[]): number[] {
    if (patterns.length === 0) return []
    
    // 计算每个时间窗口的事件数量
    const minTick = patterns[0].started_at
    const maxTick = patterns[patterns.length - 1].updated_at
    const windowSize = Math.max(10, Math.floor((maxTick - minTick) / 20))
    
    const pacing: number[] = []
    
    for (let tick = minTick; tick <= maxTick; tick += windowSize) {
      const eventsInWindow = patterns.filter(p =>
        p.started_at >= tick && p.started_at < tick + windowSize
      ).length
      
      pacing.push(eventsInWindow)
    }
    
    return pacing
  }
  
  /**
   * 确定当前阶段
   */
  private determineCurrentStage(structure: StoryArc['structure']): StoryArcStage {
    // 找到最后一个非空阶段
    if (structure.resolution.length > 0) return 'resolution'
    if (structure.falling.length > 0) return 'falling'
    if (structure.climax.length > 0) return 'climax'
    if (structure.rising.length > 0) return 'rising'
    return 'setup'
  }
  
  /**
   * 确定故事弧状态
   */
  private determineArcStatus(
    structure: StoryArc['structure'],
    patterns: NarrativePattern[]
  ): NarrativeStatus {
    // 如果有解决阶段，检查是否完成
    if (structure.resolution.length > 0) {
      const allResolved = structure.resolution.every(p =>
        p.status === 'concluded'
      )
      if (allResolved) return 'concluded'
      return 'resolving'
    }
    
    // 如果有高潮阶段
    if (structure.climax.length > 0) {
      return 'climax'
    }
    
    // 如果有上升阶段
    if (structure.rising.length > 0) {
      return 'developing'
    }
    
    // 刚开始
    return 'emerging'
  }
  
  /**
   * 计算完整度
   */
  private calculateCompleteness(structure: StoryArc['structure']): number {
    let score = 0
    
    // 每个阶段有内容加分
    if (structure.setup.length > 0) score += 0.2
    if (structure.rising.length > 0) score += 0.2
    if (structure.climax.length > 0) score += 0.3
    if (structure.falling.length > 0) score += 0.15
    if (structure.resolution.length > 0) score += 0.15
    
    return score
  }
  
  /**
   * 生成故事弧标题
   * Language-agnostic: uses the English narrative type directly
   */
  private generateArcTitle(
    patterns: NarrativePattern[],
    protagonists: string[]
  ): string {
    // 基于主要叙事类型和主角
    const typeCount = new Map<string, number>()

    for (const pattern of patterns) {
      typeCount.set(pattern.type, (typeCount.get(pattern.type) || 0) + 1)
    }

    // 找到最常见的类型
    const mainType = Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'story'

    const protagonistName = protagonists[0] || 'Unknown'

    return `${protagonistName} — ${mainType}`
  }
  
  /**
   * 分类故事弧（主线/支线）
   */
  private classifyArcs(arcs: StoryArc[]): void {
    if (arcs.length === 0) return
    
    // 按参与者数量和完整度排序
    const sorted = arcs.sort((a, b) => {
      const scoreA = a.protagonists.length + a.completeness
      const scoreB = b.protagonists.length + b.completeness
      return scoreB - scoreA
    })
    
    // 第一个是主线
    sorted[0].type = 'main'
    
    // 其他是支线
    for (let i = 1; i < sorted.length; i++) {
      sorted[i].type = 'subplot'
    }
  }
  
  /**
   * 更新现有故事弧
   */
  async updateArc(
    arc: StoryArc,
    newPatterns: NarrativePattern[]
  ): Promise<StoryArc> {
    // 合并新模式
    const allPatterns = [
      ...arc.structure.setup,
      ...arc.structure.rising,
      ...arc.structure.climax,
      ...arc.structure.falling,
      ...arc.structure.resolution,
      ...newPatterns
    ]
    
    // 重新分析结构
    const structure = this.analyzeStructure(allPatterns)
    
    // 更新情感曲线
    const emotional_curve = this.calculateEmotionalCurve(allPatterns)
    
    // 更新节奏
    const pacing = this.calculatePacing(allPatterns)
    
    // 更新阶段和状态
    const current_stage = this.determineCurrentStage(structure)
    const status = this.determineArcStatus(structure, allPatterns)
    const completeness = this.calculateCompleteness(structure)
    
    return {
      ...arc,
      structure,
      emotional_curve,
      pacing,
      current_stage,
      status,
      completeness,
      updated_at: Date.now(),
      concluded_at: status === 'concluded' ? Date.now() : arc.concluded_at
    }
  }
}
