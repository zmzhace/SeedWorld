/**
 * 元认知系统
 * 核心：Agents 能够"思考自己的思考"，反思自己的决策过程
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { AgentAction } from './agent-decision-maker'

export type MetacognitiveState = {
  agent_id: string
  self_awareness: number  // 自我意识 [0-1]
  confidence: number  // 决策信心 [0-1]
  learning_rate: number  // 学习速度 [0-1]
  reflection_depth: number  // 反思深度 [0-1]
  strategy: DecisionStrategy
  performance_history: PerformanceRecord[]
}

export type DecisionStrategy = {
  name: string
  description: string
  success_rate: number
  usage_count: number
  last_used: number
}

export type PerformanceRecord = {
  tick: number
  decision: AgentAction
  outcome: 'success' | 'failure' | 'neutral'
  expected_result: number
  actual_result: number
  learning: string
}

export type Insight = {
  id: string
  agent_id: string
  content: string
  discovered_at: number
  confidence: number
  applied: boolean
}

export class MetacognitionSystem {
  private states: Map<string, MetacognitiveState> = new Map()
  private insights: Insight[] = []
  private insightCounter = 0
  
  /**
   * 初始化元认知状态
   */
  initializeMetacognition(agent: PersonalAgentState): MetacognitiveState {
    const state: MetacognitiveState = {
      agent_id: agent.genetics.seed,
      self_awareness: agent.persona.openness * 0.7 + agent.persona.stability * 0.3,
      confidence: 0.5,
      learning_rate: agent.persona.openness * 0.6 + (1 - agent.persona.stability) * 0.4,
      reflection_depth: agent.persona.openness * 0.8,
      strategy: {
        name: 'default',
        description: '默认决策策略',
        success_rate: 0.5,
        usage_count: 0,
        last_used: 0
      },
      performance_history: []
    }
    
    this.states.set(agent.genetics.seed, state)
    return state
  }
  
  /**
   * 反思决策
   */
  reflectOnDecision(
    agent: PersonalAgentState,
    decision: AgentAction,
    outcome: { success: boolean; result: number },
    currentTick: number
  ): Insight | null {
    let state = this.states.get(agent.genetics.seed)
    if (!state) {
      state = this.initializeMetacognition(agent)
    }
    
    // 记录表现
    const record: PerformanceRecord = {
      tick: currentTick,
      decision,
      outcome: outcome.success ? 'success' : 'failure',
      expected_result: decision.intensity,
      actual_result: outcome.result,
      learning: this.generateLearning(decision, outcome)
    }
    
    state.performance_history.push(record)
    
    // 限制历史长度
    if (state.performance_history.length > 50) {
      state.performance_history.shift()
    }
    
    // 更新信心
    if (outcome.success) {
      state.confidence = Math.min(1, state.confidence + 0.05)
    } else {
      state.confidence = Math.max(0, state.confidence - 0.1)
    }
    
    // 深度反思（基于反思深度）
    if (Math.random() < state.reflection_depth) {
      const insight = this.generateInsight(agent, state, record, currentTick)
      if (insight) {
        this.insights.push(insight)
        return insight
      }
    }
    
    return null
  }
  
  /**
   * 生成学习
   */
  private generateLearning(
    decision: AgentAction,
    outcome: { success: boolean; result: number }
  ): string {
    if (outcome.success) {
      return `${decision.type} 策略有效，应该继续使用`
    } else {
      return `${decision.type} 策略失败，需要调整方法`
    }
  }
  
  /**
   * 生成洞察
   */
  private generateInsight(
    agent: PersonalAgentState,
    state: MetacognitiveState,
    record: PerformanceRecord,
    currentTick: number
  ): Insight | null {
    // 分析最近的表现模式
    const recentRecords = state.performance_history.slice(-10)
    
    // 检测模式
    const successRate = recentRecords.filter(r => r.outcome === 'success').length / recentRecords.length
    
    // 生成洞察
    let insightContent = ''
    let confidence = 0
    
    if (successRate > 0.7) {
      insightContent = `我的 ${record.decision.type} 策略很成功，应该继续使用`
      confidence = 0.8
    } else if (successRate < 0.3) {
      insightContent = `我的 ${record.decision.type} 策略失败率太高，需要改变方法`
      confidence = 0.9
    } else if (this.detectPatternShift(recentRecords)) {
      insightContent = `环境发生了变化，我需要调整策略`
      confidence = 0.7
    }
    
    if (insightContent) {
      return {
        id: `insight-${this.insightCounter++}`,
        agent_id: agent.genetics.seed,
        content: insightContent,
        discovered_at: currentTick,
        confidence,
        applied: false
      }
    }
    
    return null
  }
  
  /**
   * 检测模式转变
   */
  private detectPatternShift(records: PerformanceRecord[]): boolean {
    if (records.length < 6) return false
    
    const firstHalf = records.slice(0, Math.floor(records.length / 2))
    const secondHalf = records.slice(Math.floor(records.length / 2))
    
    const firstSuccessRate = firstHalf.filter(r => r.outcome === 'success').length / firstHalf.length
    const secondSuccessRate = secondHalf.filter(r => r.outcome === 'success').length / secondHalf.length
    
    return Math.abs(firstSuccessRate - secondSuccessRate) > 0.4
  }
  
  /**
   * 调整策略
   */
  adjustStrategy(
    agent: PersonalAgentState,
    performance: { success_rate: number; avg_result: number },
    currentTick: number
  ): DecisionStrategy {
    let state = this.states.get(agent.genetics.seed)
    if (!state) {
      state = this.initializeMetacognition(agent)
    }
    
    // 基于表现调整策略
    if (performance.success_rate < 0.3) {
      // 表现差，需要大幅调整
      state.strategy = {
        name: 'exploratory',
        description: '探索性策略：尝试新方法',
        success_rate: 0.5,
        usage_count: 0,
        last_used: currentTick
      }
    } else if (performance.success_rate > 0.7) {
      // 表现好，继续当前策略
      state.strategy = {
        name: 'exploitative',
        description: '利用性策略：继续有效方法',
        success_rate: performance.success_rate,
        usage_count: state.strategy.usage_count + 1,
        last_used: currentTick
      }
    } else {
      // 表现中等，平衡探索和利用
      state.strategy = {
        name: 'balanced',
        description: '平衡策略：探索与利用并重',
        success_rate: performance.success_rate,
        usage_count: state.strategy.usage_count + 1,
        last_used: currentTick
      }
    }
    
    return state.strategy
  }
  
  /**
   * 评估信心
   */
  assessConfidence(
    agent: PersonalAgentState,
    decision: AgentAction,
    context: { complexity: number; uncertainty: number }
  ): number {
    let state = this.states.get(agent.genetics.seed)
    if (!state) {
      state = this.initializeMetacognition(agent)
    }
    
    let confidence = state.confidence
    
    // 复杂度影响信心
    confidence *= (1 - context.complexity * 0.3)
    
    // 不确定性影响信心
    confidence *= (1 - context.uncertainty * 0.4)
    
    // 经验影响信心
    const relevantExperience = state.performance_history.filter(
      r => r.decision.type === decision.type
    ).length
    
    confidence += Math.min(0.3, relevantExperience * 0.02)
    
    return Math.min(1, Math.max(0, confidence))
  }
  
  /**
   * 自我监控
   */
  selfMonitor(
    agent: PersonalAgentState,
    currentTick: number
  ): {
    awareness: string
    concerns: string[]
    strengths: string[]
  } {
    let state = this.states.get(agent.genetics.seed)
    if (!state) {
      state = this.initializeMetacognition(agent)
    }
    
    const recentRecords = state.performance_history.slice(-10)
    const successRate = recentRecords.filter(r => r.outcome === 'success').length / recentRecords.length || 0
    
    const concerns: string[] = []
    const strengths: string[] = []
    
    // 识别问题
    if (successRate < 0.3) {
      concerns.push('决策成功率过低')
    }
    
    if (state.confidence < 0.3) {
      concerns.push('决策信心不足')
    }
    
    const failureStreak = this.calculateFailureStreak(recentRecords)
    if (failureStreak >= 3) {
      concerns.push(`连续失败 ${failureStreak} 次`)
    }
    
    // 识别优势
    if (successRate > 0.7) {
      strengths.push('决策成功率高')
    }
    
    if (state.confidence > 0.7) {
      strengths.push('决策信心强')
    }
    
    if (state.learning_rate > 0.7) {
      strengths.push('学习能力强')
    }
    
    const awareness = this.generateAwarenessStatement(state, successRate)
    
    return { awareness, concerns, strengths }
  }
  
  /**
   * 计算连续失败次数
   */
  private calculateFailureStreak(records: PerformanceRecord[]): number {
    let streak = 0
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].outcome === 'failure') {
        streak++
      } else {
        break
      }
    }
    return streak
  }
  
  /**
   * 生成自我意识陈述
   */
  private generateAwarenessStatement(
    state: MetacognitiveState,
    successRate: number
  ): string {
    if (successRate > 0.7) {
      return `我的决策表现很好，信心水平为 ${(state.confidence * 100).toFixed(0)}%`
    } else if (successRate < 0.3) {
      return `我的决策表现不佳，需要反思和改进`
    } else {
      return `我的决策表现中等，还有提升空间`
    }
  }
  
  /**
   * 应用洞察
   */
  applyInsight(
    insightId: string,
    agent: PersonalAgentState
  ): boolean {
    const insight = this.insights.find(i => i.id === insightId)
    if (!insight || insight.applied) return false
    
    // 标记为已应用
    insight.applied = true
    
    // 根据洞察调整 agent 行为
    // 这里可以修改 agent 的目标、策略等
    
    return true
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const states = Array.from(this.states.values())
    
    return {
      total_agents: states.length,
      avg_self_awareness: states.reduce((sum, s) => sum + s.self_awareness, 0) / states.length || 0,
      avg_confidence: states.reduce((sum, s) => sum + s.confidence, 0) / states.length || 0,
      avg_learning_rate: states.reduce((sum, s) => sum + s.learning_rate, 0) / states.length || 0,
      total_insights: this.insights.length,
      applied_insights: this.insights.filter(i => i.applied).length,
      high_confidence_agents: states.filter(s => s.confidence > 0.7).length,
      low_confidence_agents: states.filter(s => s.confidence < 0.3).length
    }
  }
  
  /**
   * 获取 agent 的元认知状态
   */
  getMetacognitiveState(agentId: string): MetacognitiveState | undefined {
    return this.states.get(agentId)
  }
  
  /**
   * 获取 agent 的洞察
   */
  getAgentInsights(agentId: string): Insight[] {
    return this.insights.filter(i => i.agent_id === agentId)
  }
}
