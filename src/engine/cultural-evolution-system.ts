/**
 * 文化进化系统
 * 核心：文化特征像基因一样进化：变异、选择、遗传
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type CulturalTrait = {
  id: string
  content: string
  fitness: number
  prevalence: number
  mutation_rate: number
  inheritance_strength: number
  carriers: string[]
}

export class CulturalEvolutionSystem {
  private traits: Map<string, CulturalTrait> = new Map()
  
  mutateCulture(trait: CulturalTrait): CulturalTrait {
    return {
      ...trait,
      id: `${trait.id}-mutated`,
      content: `${trait.content}（变异）`,
      fitness: trait.fitness * (0.8 + Math.random() * 0.4)
    }
  }
  
  selectCulture(traits: CulturalTrait[], environment: { cooperation: number }): CulturalTrait[] {
    return traits.filter(t => t.fitness > 0.5)
  }
  
  inheritCulture(parent: PersonalAgentState, child: PersonalAgentState): void {
    // 继承核心信念
    if (parent.core_belief) {
      child.core_belief = parent.core_belief
    }
  }
  
  getStats() {
    return {
      total_traits: this.traits.size,
      avg_fitness: Array.from(this.traits.values()).reduce((sum, t) => sum + t.fitness, 0) / this.traits.size || 0
    }
  }
}
