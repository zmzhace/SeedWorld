/**
 * 生态位分化系统
 * 核心：Agents 占据不同的生态位，减少竞争，增加多样性
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type Niche = {
  id: string
  description: string
  resources: string[]
  occupants: string[]
  capacity: number
  specialization_required: number
}

export class NicheDifferentiationSystem {
  private niches: Map<string, Niche> = new Map()
  
  identifyNiche(agent: PersonalAgentState, environment: WorldSlice): Niche {
    // 基于职业创建生态位
    const nicheId = agent.occupation || 'generalist'
    
    if (!this.niches.has(nicheId)) {
      this.niches.set(nicheId, {
        id: nicheId,
        description: `${nicheId}生态位`,
        resources: ['knowledge', 'social_capital'],
        occupants: [],
        capacity: 10,
        specialization_required: 0.6
      })
    }
    
    const niche = this.niches.get(nicheId)!
    if (!niche.occupants.includes(agent.genetics.seed)) {
      niche.occupants.push(agent.genetics.seed)
    }
    
    return niche
  }
  
  getStats() {
    return {
      total_niches: this.niches.size,
      avg_occupants: Array.from(this.niches.values()).reduce((sum, n) => sum + n.occupants.length, 0) / this.niches.size || 0
    }
  }
}
