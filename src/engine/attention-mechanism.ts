/**
 * 注意力机制
 * 核心：Agents 的注意力是有限的，需要选择性关注
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type Stimulus = {
  id: string
  type: 'agent' | 'event' | 'resource' | 'narrative' | 'environment'
  source: string
  salience: number  // 显著性 [0-1]
  urgency: number  // 紧急性 [0-1]
  relevance: number  // 相关性 [0-1]
  description: string
}

export type AttentionState = {
  agent_id: string
  capacity: number  // 注意力容量
  current_focus: string[]  // 当前关注的对象
  attention_weights: Map<string, number>  // 注意力权重
  fatigue: number  // 疲劳度 [0-1]
  last_shift: number  // 上次转移注意力的时间
}

export type AttentionAllocation = {
  stimulus_id: string
  weight: number
  reason: string
}

export class AttentionMechanism {
  private attentionStates: Map<string, AttentionState> = new Map()
  private readonly BASE_CAPACITY = 3  // 基础容量
  private readonly FATIGUE_RATE = 0.05
  private readonly RECOVERY_RATE = 0.1
  
  /**
   * 初始化 agent 的注意力状态
   */
  initializeAttention(agent: PersonalAgentState): AttentionState {
    // 容量基于个性
    const capacity = this.BASE_CAPACITY + Math.floor(agent.persona.focus * 2)
    
    const state: AttentionState = {
      agent_id: agent.genetics.seed,
      capacity,
      current_focus: [],
      attention_weights: new Map(),
      fatigue: 0,
      last_shift: 0
    }
    
    this.attentionStates.set(agent.genetics.seed, state)
    return state
  }
  
  /**
   * 分配注意力
   */
  allocateAttention(
    agent: PersonalAgentState,
    stimuli: Stimulus[],
    currentTick: number
  ): AttentionAllocation[] {
    let state = this.attentionStates.get(agent.genetics.seed)
    if (!state) {
      state = this.initializeAttention(agent)
    }
    
    // 计算每个刺激的注意力权重
    const weightedStimuli = stimuli.map(stimulus => ({
      stimulus,
      weight: this.calculateAttentionWeight(stimulus, agent, state!)
    }))
    
    // 按权重排序
    weightedStimuli.sort((a, b) => b.weight - a.weight)
    
    // 分配注意力（受容量限制）
    const allocations: AttentionAllocation[] = []
    const effectiveCapacity = Math.max(1, Math.floor(state.capacity * (1 - state.fatigue)))
    
    for (let i = 0; i < Math.min(effectiveCapacity, weightedStimuli.length); i++) {
      const { stimulus, weight } = weightedStimuli[i]
      
      allocations.push({
        stimulus_id: stimulus.id,
        weight,
        reason: this.generateAllocationReason(stimulus, weight)
      })
      
      state.current_focus.push(stimulus.id)
      state.attention_weights.set(stimulus.id, weight)
    }
    
    // 限制 current_focus 大小
    if (state.current_focus.length > effectiveCapacity) {
      const removed = state.current_focus.splice(0, state.current_focus.length - effectiveCapacity)
      for (const id of removed) {
        state.attention_weights.delete(id)
      }
    }
    
    // 增加疲劳
    state.fatigue = Math.min(1, state.fatigue + this.FATIGUE_RATE * allocations.length)
    
    return allocations
  }
  
  /**
   * 计算注意力权重
   */
  calculateAttentionWeight(
    stimulus: Stimulus,
    agent: PersonalAgentState,
    state: AttentionState
  ): number {
    let weight = 0
    
    // 1. 显著性（基础权重）
    weight += stimulus.salience * 0.3
    
    // 2. 紧急性
    weight += stimulus.urgency * 0.3
    
    // 3. 相关性
    weight += stimulus.relevance * 0.2
    
    // 4. 个性影响
    if (stimulus.type === 'agent') {
      // 高依恋的人更关注其他 agents
      weight += agent.persona.attachment * 0.1
    }
    
    if (stimulus.type === 'event') {
      // 低稳定性的人更容易被事件吸引
      weight += (1 - agent.persona.stability) * 0.1
    }
    
    if (stimulus.type === 'resource') {
      // 能量低时更关注资源
      if (agent.vitals.energy < 0.5) {
        weight += 0.2
      }
    }
    
    // 5. 新奇性（不在当前关注中的更吸引注意）
    if (!state.current_focus.includes(stimulus.id)) {
      weight += agent.persona.openness * 0.15
    }
    
    // 6. 疲劳影响（疲劳时只关注高优先级）
    if (state.fatigue > 0.5) {
      weight *= (1 - state.fatigue * 0.5)
    }
    
    return Math.min(1, weight)
  }
  
  /**
   * 注意力转移
   */
  shiftAttention(
    agent: PersonalAgentState,
    newStimulus: Stimulus,
    currentTick: number
  ): boolean {
    const state = this.attentionStates.get(agent.genetics.seed)
    if (!state) return false
    
    // 计算新刺激的权重
    const newWeight = this.calculateAttentionWeight(newStimulus, agent, state)
    
    // 如果容量未满，直接添加
    const effectiveCapacity = Math.max(1, Math.floor(state.capacity * (1 - state.fatigue)))
    if (state.current_focus.length < effectiveCapacity) {
      state.current_focus.push(newStimulus.id)
      state.attention_weights.set(newStimulus.id, newWeight)
      state.last_shift = currentTick
      return true
    }
    
    // 找到权重最低的当前关注
    let lowestWeight = Infinity
    let lowestId = ''
    
    for (const [id, weight] of state.attention_weights) {
      if (weight < lowestWeight) {
        lowestWeight = weight
        lowestId = id
      }
    }
    
    // 如果新刺激权重更高，替换
    if (newWeight > lowestWeight) {
      const index = state.current_focus.indexOf(lowestId)
      if (index !== -1) {
        state.current_focus[index] = newStimulus.id
      }
      state.attention_weights.delete(lowestId)
      state.attention_weights.set(newStimulus.id, newWeight)
      state.last_shift = currentTick
      
      // 转移注意力增加疲劳
      state.fatigue = Math.min(1, state.fatigue + this.FATIGUE_RATE * 0.5)
      
      return true
    }
    
    return false
  }
  
  /**
   * 恢复注意力（休息）
   */
  recoverAttention(agent: PersonalAgentState): void {
    const state = this.attentionStates.get(agent.genetics.seed)
    if (!state) return
    
    // 降低疲劳
    state.fatigue = Math.max(0, state.fatigue - this.RECOVERY_RATE)
    
    // 如果完全恢复，清空部分关注
    if (state.fatigue < 0.1) {
      const toRemove = Math.floor(state.current_focus.length * 0.3)
      for (let i = 0; i < toRemove; i++) {
        const removed = state.current_focus.shift()
        if (removed) {
          state.attention_weights.delete(removed)
        }
      }
    }
  }
  
  /**
   * 检查是否在关注
   */
  isAttendingTo(agentId: string, stimulusId: string): boolean {
    const state = this.attentionStates.get(agentId)
    if (!state) return false
    
    return state.current_focus.includes(stimulusId)
  }
  
  /**
   * 获取注意力权重
   */
  getAttentionWeight(agentId: string, stimulusId: string): number {
    const state = this.attentionStates.get(agentId)
    if (!state) return 0
    
    return state.attention_weights.get(stimulusId) || 0
  }
  
  /**
   * 创建刺激
   */
  createStimulus(
    type: Stimulus['type'],
    source: string,
    description: string,
    properties: {
      salience?: number
      urgency?: number
      relevance?: number
    }
  ): Stimulus {
    return {
      id: `stimulus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      source,
      salience: properties.salience || 0.5,
      urgency: properties.urgency || 0.5,
      relevance: properties.relevance || 0.5,
      description
    }
  }
  
  /**
   * 从世界状态生成刺激
   */
  generateStimuliFromWorld(world: WorldSlice, agent: PersonalAgentState): Stimulus[] {
    const stimuli: Stimulus[] = []
    
    // 1. 其他 agents
    for (const other of world.agents.npcs) {
      if (other.genetics.seed === agent.genetics.seed) continue
      
      const relationship = agent.relations[other.genetics.seed] || 0
      const relevance = Math.abs(relationship)
      
      stimuli.push(this.createStimulus(
        'agent',
        other.genetics.seed,
        `Agent: ${other.identity.name}`,
        {
          salience: 0.5,
          urgency: 0.3,
          relevance
        }
      ))
    }
    
    // 2. 最近事件
    const recentEvents = world.events.slice(-5)
    for (const event of recentEvents) {
      stimuli.push(this.createStimulus(
        'event',
        event.id,
        `Event: ${event.type}`,
        {
          salience: 0.7,
          urgency: 0.8,
          relevance: 0.6
        }
      ))
    }
    
    // 3. 资源（如果能量低）
    if (agent.vitals.energy < 0.5) {
      stimuli.push(this.createStimulus(
        'resource',
        'energy',
        'Resource: Energy',
        {
          salience: 0.8,
          urgency: 1 - agent.vitals.energy,
          relevance: 0.9
        }
      ))
    }
    
    // 4. 叙事（如果参与）
    if (world.narratives) {
      const participatingNarratives = world.narratives.patterns.filter(n =>
        n.participants.includes(agent.genetics.seed)
      )
      
      for (const narrative of participatingNarratives) {
        stimuli.push(this.createStimulus(
          'narrative',
          narrative.id,
          `Narrative: ${narrative.type}`,
          {
            salience: narrative.intensity,
            urgency: narrative.status === 'climax' ? 0.9 : 0.5,
            relevance: 0.8
          }
        ))
      }
    }
    
    return stimuli
  }
  
  /**
   * 生成分配理由
   */
  private generateAllocationReason(stimulus: Stimulus, weight: number): string {
    if (weight > 0.8) {
      return `高度关注${stimulus.description}（权重: ${weight.toFixed(2)}）`
    } else if (weight > 0.5) {
      return `中度关注${stimulus.description}（权重: ${weight.toFixed(2)}）`
    } else {
      return `轻度关注${stimulus.description}（权重: ${weight.toFixed(2)}）`
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const states = Array.from(this.attentionStates.values())
    
    return {
      total_agents: states.length,
      avg_capacity: states.reduce((sum, s) => sum + s.capacity, 0) / states.length || 0,
      avg_focus_count: states.reduce((sum, s) => sum + s.current_focus.length, 0) / states.length || 0,
      avg_fatigue: states.reduce((sum, s) => sum + s.fatigue, 0) / states.length || 0,
      highly_fatigued: states.filter(s => s.fatigue > 0.7).length,
      at_capacity: states.filter(s => s.current_focus.length >= s.capacity).length
    }
  }
  
  /**
   * 获取 agent 的注意力状态
   */
  getAttentionState(agentId: string): AttentionState | undefined {
    return this.attentionStates.get(agentId)
  }
}
