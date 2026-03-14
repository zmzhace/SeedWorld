/**
 * 模因传播系统
 * 核心：想法、信念、行为模式像病毒一样在 agents 之间传播
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type Meme = {
  id: string
  content: string  // 模因内容
  category: 'belief' | 'behavior' | 'knowledge' | 'emotion' | 'value'
  contagiousness: number  // 传染性 [0-1]
  fidelity: number  // 保真度 [0-1]（传播时的变异程度）
  longevity: number  // 持久性（在记忆中保持的时间）
  fitness: number  // 适应性（在环境中的生存能力）
  carriers: string[]  // 携带者
  mutations: Meme[]  // 变异体
  origin: string  // 起源 agent
  created_at: number
  spread_count: number  // 传播次数
}

export type MemeTransmission = {
  meme_id: string
  from_agent: string
  to_agent: string
  tick: number
  success: boolean
  mutation_occurred: boolean
  new_meme_id?: string
}

export class MemePropagationSystem {
  private memes: Map<string, Meme> = new Map()
  private transmissions: MemeTransmission[] = []
  private memeCounter = 0
  
  /**
   * 创建模因
   */
  createMeme(
    content: string,
    category: Meme['category'],
    origin: string,
    currentTick: number
  ): Meme {
    const meme: Meme = {
      id: `meme-${this.memeCounter++}`,
      content,
      category,
      contagiousness: this.calculateContagiousness(content, category),
      fidelity: 0.7 + Math.random() * 0.2,
      longevity: 10 + Math.random() * 20,
      fitness: 0.5,
      carriers: [origin],
      mutations: [],
      origin,
      created_at: currentTick,
      spread_count: 0
    }
    
    this.memes.set(meme.id, meme)
    return meme
  }
  
  /**
   * 计算传染性
   */
  private calculateContagiousness(content: string, category: Meme['category']): number {
    let base = 0.5
    
    // 情绪类模因更容易传播
    if (category === 'emotion') {
      base += 0.2
    }
    
    // 信念类模因传播较慢
    if (category === 'belief') {
      base -= 0.1
    }
    
    // 简单的内容更容易传播
    if (content.length < 20) {
      base += 0.1
    }
    
    // 包含强烈词汇的更容易传播
    const strongWords = ['必须', '绝对', '永远', '从不', '最', '极其']
    if (strongWords.some(word => content.includes(word))) {
      base += 0.15
    }
    
    return Math.min(1, Math.max(0, base))
  }
  
  /**
   * 传播模因（SIR 模型）
   */
  propagateMeme(
    meme: Meme,
    network: Map<string, Set<string>>,
    agents: PersonalAgentState[],
    currentTick: number
  ): MemeTransmission[] {
    const transmissions: MemeTransmission[] = []
    
    // 对每个携带者
    for (const carrierId of meme.carriers) {
      const contacts = network.get(carrierId) || new Set()
      
      // 尝试传播给接触者
      for (const contactId of contacts) {
        // 检查是否已经携带
        if (meme.carriers.includes(contactId)) continue
        
        const contact = agents.find(a => a.genetics.seed === contactId)
        if (!contact) continue
        
        // 计算传播概率
        const transmissionProb = this.calculateTransmissionProbability(
          meme,
          agents.find(a => a.genetics.seed === carrierId)!,
          contact
        )
        
        // 尝试传播
        if (Math.random() < transmissionProb) {
          // 检查是否发生变异
          const mutationOccurred = Math.random() > meme.fidelity
          
          if (mutationOccurred) {
            // 创建变异体
            const mutatedMeme = this.mutateMeme(meme, contact, currentTick)
            meme.mutations.push(mutatedMeme)
            
            transmissions.push({
              meme_id: meme.id,
              from_agent: carrierId,
              to_agent: contactId,
              tick: currentTick,
              success: true,
              mutation_occurred: true,
              new_meme_id: mutatedMeme.id
            })
          } else {
            // 成功传播原始模因
            meme.carriers.push(contactId)
            meme.spread_count++
            
            transmissions.push({
              meme_id: meme.id,
              from_agent: carrierId,
              to_agent: contactId,
              tick: currentTick,
              success: true,
              mutation_occurred: false
            })
          }
        } else {
          transmissions.push({
            meme_id: meme.id,
            from_agent: carrierId,
            to_agent: contactId,
            tick: currentTick,
            success: false,
            mutation_occurred: false
          })
        }
      }
    }
    
    this.transmissions.push(...transmissions)
    return transmissions
  }
  
  /**
   * 计算传播概率
   */
  private calculateTransmissionProbability(
    meme: Meme,
    carrier: PersonalAgentState,
    receiver: PersonalAgentState
  ): number {
    let prob = meme.contagiousness
    
    // 关系越好，传播越容易
    const relationship = carrier.relations[receiver.genetics.seed] || 0
    prob += relationship * 0.3
    
    // 接收者的开放性影响接受度
    prob += receiver.persona.openness * 0.2
    
    // 情绪状态影响
    if (meme.category === 'emotion') {
      if (receiver.emotion.intensity > 0.5) {
        prob += 0.2  // 情绪激动时更容易接受情绪模因
      }
    }
    
    // 信念模因需要更高的信任
    if (meme.category === 'belief') {
      if (relationship < 0.5) {
        prob -= 0.3
      }
    }
    
    return Math.min(1, Math.max(0, prob))
  }
  
  /**
   * 模因变异
   */
  mutateMeme(
    originalMeme: Meme,
    carrier: PersonalAgentState,
    currentTick: number
  ): Meme {
    // 基于携带者的个性变异内容
    let mutatedContent = originalMeme.content
    
    // 高开放性的人可能扩展内容
    if (carrier.persona.openness > 0.7) {
      mutatedContent = `${mutatedContent}（而且更进一步）`
    }
    
    // 低稳定性的人可能夸大内容
    if (carrier.persona.stability < 0.3) {
      mutatedContent = mutatedContent.replace('可能', '一定').replace('有时', '总是')
    }
    
    // 高同理心的人可能软化内容
    if (carrier.persona.empathy > 0.7) {
      mutatedContent = mutatedContent.replace('必须', '应该').replace('绝对', '可能')
    }
    
    const mutatedMeme: Meme = {
      id: `meme-${this.memeCounter++}`,
      content: mutatedContent,
      category: originalMeme.category,
      contagiousness: originalMeme.contagiousness * (0.9 + Math.random() * 0.2),
      fidelity: originalMeme.fidelity * 0.95,
      longevity: originalMeme.longevity * (0.8 + Math.random() * 0.4),
      fitness: originalMeme.fitness,
      carriers: [carrier.genetics.seed],
      mutations: [],
      origin: carrier.genetics.seed,
      created_at: currentTick,
      spread_count: 0
    }
    
    this.memes.set(mutatedMeme.id, mutatedMeme)
    return mutatedMeme
  }
  
  /**
   * 模因竞争（选择）
   */
  competeMemes(
    memes: Meme[],
    environment: { stress: number; cooperation: number; conflict: number }
  ): Meme[] {
    // 计算每个模因的适应度
    for (const meme of memes) {
      meme.fitness = this.calculateFitness(meme, environment)
    }
    
    // 选择适应度高的模因
    const survivors = memes.filter(m => {
      // 基于适应度的生存概率
      return Math.random() < meme.fitness
    })
    
    return survivors
  }
  
  /**
   * 计算适应度
   */
  private calculateFitness(
    meme: Meme,
    environment: { stress: number; cooperation: number; conflict: number }
  ): number {
    let fitness = 0.5
    
    // 传播广度影响适应度
    fitness += Math.min(0.3, meme.carriers.length / 20)
    
    // 环境适应性
    if (meme.category === 'emotion') {
      if (meme.content.includes('焦虑') || meme.content.includes('恐惧')) {
        fitness += environment.stress * 0.3
      }
    }
    
    if (meme.category === 'value') {
      if (meme.content.includes('合作') || meme.content.includes('团结')) {
        fitness += environment.cooperation * 0.3
      }
      if (meme.content.includes('竞争') || meme.content.includes('胜利')) {
        fitness += environment.conflict * 0.3
      }
    }
    
    // 持久性影响适应度
    fitness += meme.longevity / 50
    
    return Math.min(1, Math.max(0, fitness))
  }
  
  /**
   * 从 agent 记忆中提取模因
   */
  extractMemesFromAgent(agent: PersonalAgentState, currentTick: number): Meme[] {
    const newMemes: Meme[] = []
    
    // 从核心信念提取
    if (agent.core_belief && !this.memeExists(agent.core_belief)) {
      const meme = this.createMeme(
        agent.core_belief,
        'belief',
        agent.genetics.seed,
        currentTick
      )
      newMemes.push(meme)
    }
    
    // 从目标提取
    for (const goal of agent.goals) {
      if (!this.memeExists(goal)) {
        const meme = this.createMeme(
          goal,
          'value',
          agent.genetics.seed,
          currentTick
        )
        newMemes.push(meme)
      }
    }
    
    // 从强烈记忆提取
    const strongMemories = agent.memory_short.filter(m => 
      Math.abs(m.emotional_weight) > 0.7
    )
    
    for (const memory of strongMemories.slice(0, 2)) {
      if (!this.memeExists(memory.content)) {
        const category: Meme['category'] = 
          memory.emotional_weight > 0 ? 'emotion' : 'knowledge'
        
        const meme = this.createMeme(
          memory.content,
          category,
          agent.genetics.seed,
          currentTick
        )
        newMemes.push(meme)
      }
    }
    
    return newMemes
  }
  
  /**
   * 检查模因是否已存在
   */
  private memeExists(content: string): boolean {
    return Array.from(this.memes.values()).some(m => 
      m.content === content || m.content.includes(content.slice(0, 20))
    )
  }
  
  /**
   * 应用模因到 agent
   */
  applyMemeToAgent(
    meme: Meme,
    agent: PersonalAgentState,
    currentTick: number
  ): PersonalAgentState {
    const updatedAgent = { ...agent }
    
    // 根据模因类型应用影响
    switch (meme.category) {
      case 'belief':
        // 影响核心信念
        if (!updatedAgent.core_belief || Math.random() < 0.3) {
          updatedAgent.core_belief = meme.content
        }
        break
        
      case 'value':
        // 添加到目标
        if (!updatedAgent.goals.includes(meme.content)) {
          updatedAgent.goals.push(meme.content)
        }
        break
        
      case 'emotion':
        // 影响情绪
        const emotionKeywords: Record<string, string> = {
          '快乐': 'joyful',
          '悲伤': 'sad',
          '愤怒': 'angry',
          '焦虑': 'anxious',
          '兴奋': 'excited'
        }
        
        for (const [keyword, emotion] of Object.entries(emotionKeywords)) {
          if (meme.content.includes(keyword)) {
            updatedAgent.emotion = {
              label: emotion,
              intensity: 0.6
            }
            break
          }
        }
        break
        
      case 'knowledge':
        // 添加到记忆
        updatedAgent.memory_short.push({
          id: `mem-meme-${currentTick}`,
          content: meme.content,
          importance: 0.5,
          emotional_weight: 0.3,
          source: 'social',
          timestamp: new Date().toISOString(),
          decay_rate: 0.05,
          retrieval_strength: 0.7
        })
        break
    }
    
    return updatedAgent
  }
  
  /**
   * 模因衰减
   */
  decayMemes(currentTick: number): void {
    for (const [id, meme] of this.memes) {
      const age = currentTick - meme.created_at
      
      // 超过寿命的模因可能消失
      if (age > meme.longevity) {
        // 从部分携带者中移除
        const removalRate = 0.2
        const carriersToRemove = Math.floor(meme.carriers.length * removalRate)
        
        for (let i = 0; i < carriersToRemove; i++) {
          const randomIndex = Math.floor(Math.random() * meme.carriers.length)
          meme.carriers.splice(randomIndex, 1)
        }
        
        // 如果没有携带者了，删除模因
        if (meme.carriers.length === 0) {
          this.memes.delete(id)
        }
      }
    }
  }
  
  /**
   * 获取最流行的模因
   */
  getMostPopularMemes(count: number = 10): Meme[] {
    return Array.from(this.memes.values())
      .sort((a, b) => b.carriers.length - a.carriers.length)
      .slice(0, count)
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const memes = Array.from(this.memes.values())
    
    return {
      total_memes: memes.length,
      total_transmissions: this.transmissions.length,
      successful_transmissions: this.transmissions.filter(t => t.success).length,
      mutation_rate: this.transmissions.filter(t => t.mutation_occurred).length / this.transmissions.length || 0,
      avg_carriers: memes.reduce((sum, m) => sum + m.carriers.length, 0) / memes.length || 0,
      avg_fitness: memes.reduce((sum, m) => sum + m.fitness, 0) / memes.length || 0,
      by_category: {
        belief: memes.filter(m => m.category === 'belief').length,
        behavior: memes.filter(m => m.category === 'behavior').length,
        knowledge: memes.filter(m => m.category === 'knowledge').length,
        emotion: memes.filter(m => m.category === 'emotion').length,
        value: memes.filter(m => m.category === 'value').length
      }
    }
  }
  
  /**
   * 获取所有模因
   */
  getAllMemes(): Map<string, Meme> {
    return this.memes
  }
  
  /**
   * 获取 agent 携带的模因
   */
  getAgentMemes(agentId: string): Meme[] {
    return Array.from(this.memes.values()).filter(m =>
      m.carriers.includes(agentId)
    )
  }
}
