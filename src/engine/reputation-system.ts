/**
 * 声誉系统 - 产生最丰富的社会动态
 * 核心：行为影响声誉，声誉影响他人对待方式
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type ReputationDimension = {
  trustworthiness: number  // 可信度 [0-1]
  competence: number       // 能力 [0-1]
  benevolence: number      // 善意 [0-1]
  status: number           // 地位 [0-1]
  influence: number        // 影响力 [0-1]
}

export type ReputationEvent = {
  tick: number
  action_type: string
  impact: Partial<ReputationDimension>
  witnesses: string[]  // 见证者
  description: string
}

export type Reputation = ReputationDimension & {
  agent_id: string
  history: ReputationEvent[]
  last_updated: number
  decay_rate: number  // 衰减率
}

export type ReputationQuery = {
  observer_id: string  // 观察者
  target_id: string    // 目标
  perspective: Reputation  // 观察者视角的声誉
  confidence: number   // 信心水平
}

export class ReputationSystem {
  private reputations: Map<string, Reputation> = new Map()
  private socialNetwork: Map<string, Set<string>> = new Map()  // 社交网络图
  
  /**
   * 初始化 agent 的声誉
   */
  initializeReputation(agent: PersonalAgentState): Reputation {
    const reputation: Reputation = {
      agent_id: agent.genetics.seed,
      trustworthiness: 0.5,
      competence: 0.5,
      benevolence: 0.5,
      status: 0.3,
      influence: 0.2,
      history: [],
      last_updated: 0,
      decay_rate: 0.01
    }
    
    this.reputations.set(agent.genetics.seed, reputation)
    return reputation
  }
  
  /**
   * 更新声誉（基于行动）
   */
  updateReputation(
    agent: PersonalAgentState,
    action: {
      type: string
      target?: string
      success: boolean
      witnesses: string[]
    },
    currentTick: number
  ): Reputation {
    let reputation = this.reputations.get(agent.genetics.seed)
    if (!reputation) {
      reputation = this.initializeReputation(agent)
    }
    
    // 根据行动类型计算声誉影响
    const impact = this.calculateReputationImpact(action, agent)
    
    // 应用影响
    reputation.trustworthiness = this.clamp(
      reputation.trustworthiness + (impact.trustworthiness || 0)
    )
    reputation.competence = this.clamp(
      reputation.competence + (impact.competence || 0)
    )
    reputation.benevolence = this.clamp(
      reputation.benevolence + (impact.benevolence || 0)
    )
    reputation.status = this.clamp(
      reputation.status + (impact.status || 0)
    )
    reputation.influence = this.clamp(
      reputation.influence + (impact.influence || 0)
    )
    
    // 记录事件
    const event: ReputationEvent = {
      tick: currentTick,
      action_type: action.type,
      impact,
      witnesses: action.witnesses,
      description: this.generateEventDescription(action, agent)
    }
    
    reputation.history.push(event)
    reputation.last_updated = currentTick
    
    // 传播声誉（通过见证者）
    this.propagateReputation(agent.genetics.seed, event, action.witnesses)
    
    return reputation
  }
  
  /**
   * 计算行动对声誉的影响
   */
  private calculateReputationImpact(
    action: { type: string; target?: string; success: boolean },
    agent: PersonalAgentState
  ): Partial<ReputationDimension> {
    const impact: Partial<ReputationDimension> = {}
    
    switch (action.type) {
      case 'help':
        impact.benevolence = action.success ? 0.05 : -0.02
        impact.trustworthiness = action.success ? 0.03 : 0
        impact.status = 0.02
        break
        
      case 'compete':
        impact.competence = action.success ? 0.05 : -0.03
        impact.status = action.success ? 0.04 : -0.02
        impact.benevolence = -0.01
        break
        
      case 'betray':
        impact.trustworthiness = -0.15
        impact.benevolence = -0.10
        impact.status = -0.05
        break
        
      case 'cooperate':
        impact.trustworthiness = 0.04
        impact.benevolence = 0.03
        impact.influence = 0.02
        break
        
      case 'lead':
        impact.influence = action.success ? 0.06 : -0.03
        impact.status = action.success ? 0.05 : -0.02
        impact.competence = action.success ? 0.03 : 0
        break
        
      case 'teach':
        impact.competence = 0.04
        impact.benevolence = 0.03
        impact.influence = 0.02
        break
        
      case 'deceive':
        impact.trustworthiness = -0.10
        impact.benevolence = -0.05
        break
        
      case 'achieve_goal':
        impact.competence = 0.05
        impact.status = 0.03
        break
        
      case 'fail_goal':
        impact.competence = -0.03
        break
        
      default:
        // 默认小幅影响
        impact.trustworthiness = action.success ? 0.01 : -0.01
    }
    
    return impact
  }
  
  /**
   * 传播声誉（通过社交网络）
   */
  private propagateReputation(
    agentId: string,
    event: ReputationEvent,
    witnesses: string[]
  ): void {
    // 见证者会传播给他们的朋友
    for (const witness of witnesses) {
      const friends = this.socialNetwork.get(witness) || new Set()
      
      // 传播给朋友（衰减）
      for (const friend of friends) {
        // 简化：直接记录，实际应该有传播衰减
        // 这里可以扩展为"听说"的二手信息
      }
    }
  }
  
  /**
   * 查询声誉（从观察者视角）
   */
  queryReputation(
    observerId: string,
    targetId: string,
    world: WorldSlice
  ): ReputationQuery {
    const baseReputation = this.reputations.get(targetId)
    
    if (!baseReputation) {
      // 没有声誉信息，返回默认值
      return {
        observer_id: observerId,
        target_id: targetId,
        perspective: {
          agent_id: targetId,
          trustworthiness: 0.5,
          competence: 0.5,
          benevolence: 0.5,
          status: 0.3,
          influence: 0.2,
          history: [],
          last_updated: 0,
          decay_rate: 0.01
        },
        confidence: 0.1  // 低信心
      }
    }
    
    // 计算观察者的视角
    const perspective = this.calculatePerspective(
      observerId,
      targetId,
      baseReputation,
      world
    )
    
    // 计算信心水平
    const confidence = this.calculateConfidence(observerId, targetId, baseReputation)
    
    return {
      observer_id: observerId,
      target_id: targetId,
      perspective,
      confidence
    }
  }
  
  /**
   * 计算观察者视角的声誉
   */
  private calculatePerspective(
    observerId: string,
    targetId: string,
    baseReputation: Reputation,
    world: WorldSlice
  ): Reputation {
    // 基础声誉
    const perspective = { ...baseReputation }
    
    // 根据观察者与目标的关系调整
    const observer = world.agents.npcs.find(a => a.genetics.seed === observerId)
    if (observer) {
      const relationship = observer.relations[targetId] || 0
      
      // 关系好的人会高估对方的声誉
      if (relationship > 0.5) {
        perspective.trustworthiness = Math.min(1, perspective.trustworthiness + 0.1)
        perspective.benevolence = Math.min(1, perspective.benevolence + 0.1)
      } else if (relationship < -0.5) {
        // 关系差的人会低估对方的声誉
        perspective.trustworthiness = Math.max(0, perspective.trustworthiness - 0.1)
        perspective.benevolence = Math.max(0, perspective.benevolence - 0.1)
      }
    }
    
    return perspective
  }
  
  /**
   * 计算信心水平
   */
  private calculateConfidence(
    observerId: string,
    targetId: string,
    reputation: Reputation
  ): number {
    // 基于历史事件数量
    const eventCount = reputation.history.length
    let confidence = Math.min(1, eventCount / 20)
    
    // 基于是否是直接见证者
    const directWitness = reputation.history.some(event =>
      event.witnesses.includes(observerId)
    )
    
    if (directWitness) {
      confidence = Math.min(1, confidence + 0.3)
    }
    
    // 基于时间衰减
    const ticksSinceUpdate = Date.now() - reputation.last_updated
    const timeFactor = Math.exp(-ticksSinceUpdate / 1000)
    confidence *= timeFactor
    
    return confidence
  }
  
  /**
   * 声誉衰减（随时间）
   */
  applyDecay(currentTick: number): void {
    for (const [agentId, reputation] of this.reputations) {
      const ticksSinceUpdate = currentTick - reputation.last_updated
      
      if (ticksSinceUpdate > 10) {
        // 向中性值衰减
        reputation.trustworthiness = this.decayTowards(reputation.trustworthiness, 0.5, reputation.decay_rate)
        reputation.competence = this.decayTowards(reputation.competence, 0.5, reputation.decay_rate)
        reputation.benevolence = this.decayTowards(reputation.benevolence, 0.5, reputation.decay_rate)
        reputation.status = this.decayTowards(reputation.status, 0.3, reputation.decay_rate)
        reputation.influence = this.decayTowards(reputation.influence, 0.2, reputation.decay_rate)
      }
    }
  }
  
  /**
   * 向目标值衰减
   */
  private decayTowards(current: number, target: number, rate: number): number {
    return current + (target - current) * rate
  }
  
  /**
   * 更新社交网络
   */
  updateSocialNetwork(world: WorldSlice): void {
    this.socialNetwork.clear()
    
    for (const agent of world.agents.npcs) {
      const friends = new Set<string>()
      
      // 关系值 > 0.3 视为朋友
      for (const [target, value] of Object.entries(agent.relations)) {
        if (value > 0.3) {
          friends.add(target)
        }
      }
      
      this.socialNetwork.set(agent.genetics.seed, friends)
    }
  }
  
  /**
   * 获取声誉排名
   */
  getReputationRanking(dimension: keyof ReputationDimension): Array<{
    agent_id: string
    score: number
  }> {
    return Array.from(this.reputations.values())
      .map(rep => ({
        agent_id: rep.agent_id,
        score: rep[dimension]
      }))
      .sort((a, b) => b.score - a.score)
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const reputations = Array.from(this.reputations.values())
    
    return {
      total_agents: reputations.length,
      avg_trustworthiness: this.average(reputations.map(r => r.trustworthiness)),
      avg_competence: this.average(reputations.map(r => r.competence)),
      avg_benevolence: this.average(reputations.map(r => r.benevolence)),
      avg_status: this.average(reputations.map(r => r.status)),
      avg_influence: this.average(reputations.map(r => r.influence)),
      total_events: reputations.reduce((sum, r) => sum + r.history.length, 0)
    }
  }
  
  // 辅助方法
  private clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(max, value))
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }
  
  private generateEventDescription(
    action: { type: string; target?: string; success: boolean },
    agent: PersonalAgentState
  ): string {
    const name = agent.identity.name
    const result = action.success ? '成功' : '失败'
    
    switch (action.type) {
      case 'help':
        return `${name}帮助了${action.target || '他人'}（${result}）`
      case 'compete':
        return `${name}与${action.target || '他人'}竞争（${result}）`
      case 'betray':
        return `${name}背叛了${action.target || '他人'}`
      case 'cooperate':
        return `${name}与${action.target || '他人'}合作（${result}）`
      case 'lead':
        return `${name}领导了一项行动（${result}）`
      case 'teach':
        return `${name}教导了${action.target || '他人'}`
      case 'deceive':
        return `${name}欺骗了${action.target || '他人'}`
      default:
        return `${name}执行了${action.type}（${result}）`
    }
  }
  
  /**
   * 获取所有声誉
   */
  getAllReputations(): Map<string, Reputation> {
    return this.reputations
  }
}
