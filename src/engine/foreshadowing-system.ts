/**
 * 伏笔与回响系统
 * 核心：早期事件为后续发展埋下伏笔，后续事件回响早期细节
 */

import type { WorldSlice } from '@/domain/world'

export type Foreshadowing = {
  id: string
  planted_at: number
  content: string
  significance: number  // 重要性 [0-1]
  fulfilled: boolean
  fulfillment_conditions: string[]
  related_agents: string[]
  symbolic_meaning?: string
}

export type Callback = {
  id: string
  created_at: number
  references: string[]  // 引用的早期事件ID
  connection_strength: number
  meaning: string
  emotional_resonance: number
}

export class ForeshadowingSystem {
  private foreshadowings: Map<string, Foreshadowing> = new Map()
  private callbacks: Callback[] = []
  private counter = 0
  
  /**
   * 种植伏笔
   */
  plantForeshadowing(
    event: WorldSlice['events'][0],
    future_significance: string,
    agents: string[]
  ): Foreshadowing {
    const foreshadowing: Foreshadowing = {
      id: `foreshadow-${this.counter++}`,
      planted_at: parseInt(event.id.split('-')[1]) || 0,
      content: event.payload?.summary as string || event.type,
      significance: 0.5 + Math.random() * 0.5,
      fulfilled: false,
      fulfillment_conditions: [future_significance],
      related_agents: agents,
      symbolic_meaning: this.extractSymbolicMeaning(event)
    }
    
    this.foreshadowings.set(foreshadowing.id, foreshadowing)
    return foreshadowing
  }
  
  /**
   * 提取象征意义
   */
  private extractSymbolicMeaning(event: WorldSlice['events'][0]): string {
    const symbolMap: Record<string, string> = {
      'conflict': '未来的冲突',
      'cooperation': '团结的力量',
      'betrayal': '信任的脆弱',
      'discovery': '真相的揭示',
      'loss': '失去的痛苦',
      'victory': '胜利的代价'
    }
    
    return symbolMap[event.type] || '未知的命运'
  }
  
  /**
   * 检测兑现机会
   */
  detectFulfillmentOpportunity(
    foreshadowing: Foreshadowing,
    context: { events: WorldSlice['events']; agents: string[] }
  ): boolean {
    if (foreshadowing.fulfilled) return false
    
    // 检查是否有相关 agents 参与
    const hasRelevantAgents = foreshadowing.related_agents.some(agentId =>
      context.agents.includes(agentId)
    )
    
    if (!hasRelevantAgents) return false
    
    // 检查是否满足条件
    const recentEvents = context.events.slice(-10)
    const hasMatchingEvent = recentEvents.some(event =>
      foreshadowing.fulfillment_conditions.some(condition =>
        event.type.includes(condition) || 
        (event.payload?.summary as string)?.includes(condition)
      )
    )
    
    return hasMatchingEvent
  }
  
  /**
   * 兑现伏笔
   */
  fulfillForeshadowing(
    foreshadowingId: string,
    currentTick: number
  ): string {
    const foreshadowing = this.foreshadowings.get(foreshadowingId)
    if (!foreshadowing || foreshadowing.fulfilled) return ''
    
    foreshadowing.fulfilled = true
    
    const ticksSincePlanted = currentTick - foreshadowing.planted_at
    
    return `伏笔兑现：${foreshadowing.content}（${ticksSincePlanted} ticks 前埋下）- ${foreshadowing.symbolic_meaning}`
  }
  
  /**
   * 创造回响
   */
  createCallback(
    current_event: WorldSlice['events'][0],
    past_events: WorldSlice['events'],
    currentTick: number
  ): Callback | null {
    // 找到相关的过去事件
    const relevantPastEvents = this.findRelevantPastEvents(current_event, past_events)
    
    if (relevantPastEvents.length === 0) return null
    
    const callback: Callback = {
      id: `callback-${this.counter++}`,
      created_at: currentTick,
      references: relevantPastEvents.map(e => e.id),
      connection_strength: this.calculateConnectionStrength(current_event, relevantPastEvents),
      meaning: this.assignMeaning(current_event, relevantPastEvents),
      emotional_resonance: 0.5 + Math.random() * 0.5
    }
    
    this.callbacks.push(callback)
    return callback
  }
  
  /**
   * 找到相关的过去事件
   */
  private findRelevantPastEvents(
    current: WorldSlice['events'][0],
    past: WorldSlice['events']
  ): WorldSlice['events'] {
    const relevant: WorldSlice['events'] = []
    
    // 查找类型相似的事件
    for (const event of past) {
      if (event.id === current.id) continue
      
      if (event.type === current.type) {
        relevant.push(event)
      }
      
      // 查找涉及相同 agents 的事件
      if (event.payload && current.payload) {
        const eventAgents = this.extractAgents(event.payload)
        const currentAgents = this.extractAgents(current.payload)
        
        const hasCommonAgents = eventAgents.some(a => currentAgents.includes(a))
        if (hasCommonAgents) {
          relevant.push(event)
        }
      }
    }
    
    return relevant.slice(-5)  // 最多5个
  }
  
  /**
   * 提取 agents
   */
  private extractAgents(payload: Record<string, unknown>): string[] {
    const agents: string[] = []
    
    if (payload.agent_seed) agents.push(payload.agent_seed as string)
    if (payload.agent_name) agents.push(payload.agent_name as string)
    if (payload.participants) {
      const participants = payload.participants as string[]
      agents.push(...participants)
    }
    
    return agents
  }
  
  /**
   * 计算连接强度
   */
  private calculateConnectionStrength(
    current: WorldSlice['events'][0],
    past: WorldSlice['events']
  ): number {
    let strength = 0
    
    // 类型匹配
    const typeMatches = past.filter(e => e.type === current.type).length
    strength += typeMatches * 0.2
    
    // Agent 重叠
    const currentAgents = this.extractAgents(current.payload || {})
    for (const event of past) {
      const pastAgents = this.extractAgents(event.payload || {})
      const overlap = currentAgents.filter(a => pastAgents.includes(a)).length
      strength += overlap * 0.15
    }
    
    return Math.min(1, strength)
  }
  
  /**
   * 赋予意义
   */
  private assignMeaning(
    current: WorldSlice['events'][0],
    past: WorldSlice['events']
  ): string {
    const patterns = [
      '历史重演',
      '因果循环',
      '命运的回响',
      '过去的影子',
      '相似的轨迹',
      '重复的模式'
    ]
    
    return patterns[Math.floor(Math.random() * patterns.length)]
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const foreshadowings = Array.from(this.foreshadowings.values())
    
    return {
      total_foreshadowings: foreshadowings.length,
      fulfilled: foreshadowings.filter(f => f.fulfilled).length,
      pending: foreshadowings.filter(f => !f.fulfilled).length,
      total_callbacks: this.callbacks.length,
      avg_connection_strength: this.callbacks.reduce((sum, c) => sum + c.connection_strength, 0) / this.callbacks.length || 0
    }
  }
}
