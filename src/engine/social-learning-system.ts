/**
 * 社会学习系统
 * 核心：Agents 通过观察他人学习
 */

import type { PersonalAgentState } from '@/domain/world'

export type SocialLearning = {
  type: 'imitation' | 'emulation' | 'teaching'
  learner: string
  model: string
  behavior: string
  success_rate: number
}

export class SocialLearningSystem {
  observationalLearning(learner: PersonalAgentState, model: PersonalAgentState, behavior: string): void {
    // 学习者模仿模型的行为
    if (learner.goals.length < 5) {
      learner.goals.push(`学习${model.identity.name}的${behavior}`)
    }
  }
  
  selectModel(learner: PersonalAgentState, candidates: PersonalAgentState[]): PersonalAgentState | null {
    // 选择声誉最高的作为学习对象
    let bestModel: PersonalAgentState | null = null
    let bestScore = -Infinity
    
    for (const candidate of candidates) {
      const relationship = learner.relations[candidate.genetics.seed] || 0
      if (relationship > bestScore) {
        bestScore = relationship
        bestModel = candidate
      }
    }
    
    return bestModel
  }
  
  getStats() {
    return {
      total_learning_events: 0
    }
  }
}
