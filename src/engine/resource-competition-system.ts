/**
 * 资源竞争系统 - 产生最多冲突和合作
 * 核心：Agents 竞争有限资源，产生复杂的竞争与合作动态
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type ResourceType = 'material' | 'social' | 'information' | 'time'

export type Resource = {
  id: string
  type: ResourceType
  name: string
  amount: number
  max_amount: number
  regeneration_rate: number
  scarcity: number  // 稀缺度 [0-1]
  value: number  // 价值 [0-1]
  location?: string  // 资源位置
}

export type CompetitionStrategy = 
  | 'direct_compete'  // 直接竞争
  | 'cooperate'       // 合作
  | 'deceive'         // 欺骗
  | 'share'           // 分享
  | 'hoard'           // 囤积
  | 'steal'           // 偷窃

export type ResourceClaim = {
  agent_id: string
  resource_id: string
  amount: number
  strategy: CompetitionStrategy
  priority: number  // 优先级
  reason: string
}

export type CompetitionResult = {
  resource_id: string
  allocations: Map<string, number>  // agent_id -> amount
  conflicts: Array<{
    agents: string[]
    intensity: number
    resolution: string
  }>
  cooperations: Array<{
    agents: string[]
    benefit: number
  }>
}

export class ResourceCompetitionSystem {
  private resources: Map<string, Resource> = new Map()
  private claims: ResourceClaim[] = []
  
  /**
   * 初始化资源
   */
  initializeResources(world: WorldSlice): void {
    // 物质资源
    this.resources.set('food', {
      id: 'food',
      type: 'material',
      name: '食物',
      amount: 100,
      max_amount: 100,
      regeneration_rate: 5,
      scarcity: 0.3,
      value: 0.8
    })
    
    this.resources.set('water', {
      id: 'water',
      type: 'material',
      name: '水源',
      amount: 80,
      max_amount: 100,
      regeneration_rate: 10,
      scarcity: 0.2,
      value: 0.9
    })
    
    this.resources.set('shelter', {
      id: 'shelter',
      type: 'material',
      name: '住所',
      amount: 50,
      max_amount: 50,
      regeneration_rate: 0,
      scarcity: 0.5,
      value: 0.7
    })
    
    // 社会资源
    this.resources.set('status', {
      id: 'status',
      type: 'social',
      name: '社会地位',
      amount: 100,
      max_amount: 100,
      regeneration_rate: 0,
      scarcity: 0.7,
      value: 0.6
    })
    
    this.resources.set('influence', {
      id: 'influence',
      type: 'social',
      name: '影响力',
      amount: 100,
      max_amount: 100,
      regeneration_rate: 0,
      scarcity: 0.8,
      value: 0.7
    })
    
    // 信息资源
    this.resources.set('knowledge', {
      id: 'knowledge',
      type: 'information',
      name: '知识',
      amount: 200,
      max_amount: 1000,
      regeneration_rate: 2,
      scarcity: 0.4,
      value: 0.8
    })
    
    this.resources.set('secrets', {
      id: 'secrets',
      type: 'information',
      name: '秘密',
      amount: 50,
      max_amount: 100,
      regeneration_rate: 1,
      scarcity: 0.9,
      value: 0.9
    })
    
    // 时间资源
    this.resources.set('attention', {
      id: 'attention',
      type: 'time',
      name: '注意力',
      amount: world.agents.npcs.length * 10,
      max_amount: world.agents.npcs.length * 10,
      regeneration_rate: world.agents.npcs.length * 10,
      scarcity: 0.6,
      value: 0.7
    })
  }
  
  /**
   * Agent 声明资源需求
   */
  claimResource(
    agent: PersonalAgentState,
    resourceId: string,
    amount: number,
    strategy: CompetitionStrategy
  ): ResourceClaim {
    const resource = this.resources.get(resourceId)
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`)
    }
    
    // 计算优先级
    const priority = this.calculatePriority(agent, resource, strategy)
    
    const claim: ResourceClaim = {
      agent_id: agent.genetics.seed,
      resource_id: resourceId,
      amount,
      strategy,
      priority,
      reason: this.generateClaimReason(agent, resource, strategy)
    }
    
    this.claims.push(claim)
    return claim
  }
  
  /**
   * 计算优先级
   */
  private calculatePriority(
    agent: PersonalAgentState,
    resource: Resource,
    strategy: CompetitionStrategy
  ): number {
    let priority = 0
    
    // 基于需求
    if (resource.type === 'material') {
      priority += (1 - agent.vitals.energy) * 2  // 能量低 -> 高优先级
    }
    
    if (resource.type === 'social') {
      priority += agent.persona.agency * 1.5  // 高主动性 -> 高优先级
    }
    
    if (resource.type === 'information') {
      priority += agent.persona.openness * 1.5  // 高开放性 -> 高优先级
    }
    
    // 基于策略
    switch (strategy) {
      case 'direct_compete':
        priority += agent.persona.agency * 1.2
        break
      case 'cooperate':
        priority += agent.persona.empathy * 1.2
        break
      case 'deceive':
        priority += (1 - agent.persona.empathy) * 1.5
        break
      case 'share':
        priority += agent.persona.empathy * 1.5
        break
      case 'hoard':
        priority += agent.persona.stability * 1.2
        break
      case 'steal':
        priority += (1 - agent.persona.empathy) * 2
        break
    }
    
    return priority
  }
  
  /**
   * 选择竞争策略
   */
  selectStrategy(
    agent: PersonalAgentState,
    resource: Resource,
    competitors: PersonalAgentState[]
  ): CompetitionStrategy {
    const strategies: Array<{ strategy: CompetitionStrategy; score: number }> = []
    
    // 直接竞争
    strategies.push({
      strategy: 'direct_compete',
      score: agent.persona.agency * 2 + resource.scarcity
    })
    
    // 合作
    const friendCount = Object.values(agent.relations).filter(v => v > 0.5).length
    strategies.push({
      strategy: 'cooperate',
      score: agent.persona.empathy * 2 + friendCount * 0.2
    })
    
    // 欺骗
    strategies.push({
      strategy: 'deceive',
      score: (1 - agent.persona.empathy) * 1.5 + resource.value
    })
    
    // 分享
    strategies.push({
      strategy: 'share',
      score: agent.persona.empathy * 2.5
    })
    
    // 囤积
    strategies.push({
      strategy: 'hoard',
      score: agent.persona.stability * 1.5 + resource.scarcity
    })
    
    // 偷窃
    strategies.push({
      strategy: 'steal',
      score: (1 - agent.persona.empathy) * 2 + (1 - agent.vitals.energy) * 1.5
    })
    
    // 选择得分最高的策略
    strategies.sort((a, b) => b.score - a.score)
    return strategies[0].strategy
  }
  
  /**
   * 竞争资源（核心算法）
   */
  competeForResource(
    resourceId: string,
    agents: PersonalAgentState[]
  ): CompetitionResult {
    const resource = this.resources.get(resourceId)
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`)
    }
    
    // 获取该资源的所有声明
    const resourceClaims = this.claims.filter(c => c.resource_id === resourceId)
    
    const allocations = new Map<string, number>()
    const conflicts: CompetitionResult['conflicts'] = []
    const cooperations: CompetitionResult['cooperations'] = []
    
    // 按策略分组
    const cooperators = resourceClaims.filter(c => c.strategy === 'cooperate' || c.strategy === 'share')
    const competitors = resourceClaims.filter(c => c.strategy === 'direct_compete')
    const deceivers = resourceClaims.filter(c => c.strategy === 'deceive')
    const hoarders = resourceClaims.filter(c => c.strategy === 'hoard')
    const thieves = resourceClaims.filter(c => c.strategy === 'steal')
    
    let remainingAmount = resource.amount
    
    // 1. 处理合作者（优先，平分）
    if (cooperators.length > 0) {
      const totalCoopAmount = Math.min(
        remainingAmount * 0.4,
        cooperators.reduce((sum, c) => sum + c.amount, 0)
      )
      const perCoopAmount = totalCoopAmount / cooperators.length
      
      for (const claim of cooperators) {
        allocations.set(claim.agent_id, perCoopAmount)
      }
      
      remainingAmount -= totalCoopAmount
      
      cooperations.push({
        agents: cooperators.map(c => c.agent_id),
        benefit: perCoopAmount * cooperators.length
      })
    }
    
    // 2. 处理竞争者（按优先级）
    if (competitors.length > 0) {
      competitors.sort((a, b) => b.priority - a.priority)
      
      for (const claim of competitors) {
        const allocated = Math.min(claim.amount, remainingAmount * 0.3)
        allocations.set(claim.agent_id, (allocations.get(claim.agent_id) || 0) + allocated)
        remainingAmount -= allocated
        
        // 产生冲突
        if (competitors.length > 1) {
          conflicts.push({
            agents: competitors.map(c => c.agent_id),
            intensity: resource.scarcity * 0.8,
            resolution: `${claim.agent_id} 通过竞争获得了资源`
          })
        }
      }
    }
    
    // 3. 处理欺骗者（可能成功，可能失败）
    for (const claim of deceivers) {
      const successChance = 0.3 + (1 - claim.priority) * 0.3
      
      if (Math.random() < successChance) {
        const stolen = Math.min(claim.amount, remainingAmount * 0.2)
        allocations.set(claim.agent_id, (allocations.get(claim.agent_id) || 0) + stolen)
        remainingAmount -= stolen
        
        conflicts.push({
          agents: [claim.agent_id, ...competitors.map(c => c.agent_id)],
          intensity: 0.9,
          resolution: `${claim.agent_id} 通过欺骗获得了资源`
        })
      } else {
        conflicts.push({
          agents: [claim.agent_id],
          intensity: 0.5,
          resolution: `${claim.agent_id} 的欺骗被识破`
        })
      }
    }
    
    // 4. 处理囤积者
    for (const claim of hoarders) {
      const hoarded = Math.min(claim.amount, remainingAmount * 0.15)
      allocations.set(claim.agent_id, (allocations.get(claim.agent_id) || 0) + hoarded)
      remainingAmount -= hoarded
    }
    
    // 5. 处理偷窃者
    for (const claim of thieves) {
      const successChance = 0.2
      
      if (Math.random() < successChance && allocations.size > 0) {
        // 从其他人那里偷
        const victims = Array.from(allocations.keys())
        const victim = victims[Math.floor(Math.random() * victims.length)]
        const stolenAmount = (allocations.get(victim) || 0) * 0.3
        
        allocations.set(victim, (allocations.get(victim) || 0) - stolenAmount)
        allocations.set(claim.agent_id, (allocations.get(claim.agent_id) || 0) + stolenAmount)
        
        conflicts.push({
          agents: [claim.agent_id, victim],
          intensity: 1.0,
          resolution: `${claim.agent_id} 从 ${victim} 那里偷窃了资源`
        })
      }
    }
    
    // 更新资源数量
    resource.amount = remainingAmount
    
    return {
      resource_id: resourceId,
      allocations,
      conflicts,
      cooperations
    }
  }
  
  /**
   * 分配资源（所有资源）
   */
  allocateAllResources(agents: PersonalAgentState[]): Map<string, CompetitionResult> {
    const results = new Map<string, CompetitionResult>()
    
    // 为每个资源生成声明
    for (const agent of agents) {
      // 根据需求声明资源
      if (agent.vitals.energy < 0.5) {
        const strategy = this.selectStrategy(agent, this.resources.get('food')!, agents)
        this.claimResource(agent, 'food', 10, strategy)
      }
      
      if (agent.persona.agency > 0.6) {
        const strategy = this.selectStrategy(agent, this.resources.get('status')!, agents)
        this.claimResource(agent, 'status', 5, strategy)
      }
      
      if (agent.persona.openness > 0.6) {
        const strategy = this.selectStrategy(agent, this.resources.get('knowledge')!, agents)
        this.claimResource(agent, 'knowledge', 8, strategy)
      }
    }
    
    // 竞争每个资源
    for (const [resourceId, resource] of this.resources) {
      const result = this.competeForResource(resourceId, agents)
      results.set(resourceId, result)
    }
    
    // 清空声明
    this.claims = []
    
    return results
  }
  
  /**
   * 资源再生
   */
  regenerateResources(): void {
    for (const [id, resource] of this.resources) {
      resource.amount = Math.min(
        resource.max_amount,
        resource.amount + resource.regeneration_rate
      )
      
      // 更新稀缺度
      resource.scarcity = 1 - (resource.amount / resource.max_amount)
    }
  }
  
  /**
   * 获取资源统计
   */
  getStats() {
    const resources = Array.from(this.resources.values())
    
    return {
      total_resources: resources.length,
      total_claims: this.claims.length,
      scarcity_avg: resources.reduce((sum, r) => sum + r.scarcity, 0) / resources.length,
      most_scarce: resources.sort((a, b) => b.scarcity - a.scarcity)[0],
      most_valuable: resources.sort((a, b) => b.value - a.value)[0]
    }
  }
  
  /**
   * 生成声明理由
   */
  private generateClaimReason(
    agent: PersonalAgentState,
    resource: Resource,
    strategy: CompetitionStrategy
  ): string {
    const strategyNames: Record<CompetitionStrategy, string> = {
      direct_compete: '直接竞争',
      cooperate: '合作',
      deceive: '欺骗',
      share: '分享',
      hoard: '囤积',
      steal: '偷窃'
    }
    
    return `${agent.identity.name} 通过${strategyNames[strategy]}争取${resource.name}`
  }
  
  /**
   * 获取所有资源
   */
  getAllResources(): Map<string, Resource> {
    return this.resources
  }
}
