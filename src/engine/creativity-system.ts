/**
 * 创造力系统
 * 核心：Agents 能够产生新想法、新行为、新解决方案
 */

import type { PersonalAgentState } from '@/domain/world'

export type CreativeIdea = {
  id: string
  content: string
  novelty: number
  usefulness: number
  source: 'variation' | 'combination' | 'analogy'
  components: string[]
}

export class CreativitySystem {
  private ideaCounter = 0
  
  generateIdea(agent: PersonalAgentState, context: string): CreativeIdea {
    const novelty = agent.persona.openness * 0.8 + Math.random() * 0.2
    
    return {
      id: `idea-${this.ideaCounter++}`,
      content: `${agent.identity.name}的创新想法：${context}`,
      novelty,
      usefulness: 0.5 + Math.random() * 0.5,
      source: 'variation',
      components: [context]
    }
  }
  
  combineIdeas(ideas: CreativeIdea[]): CreativeIdea {
    return {
      id: `idea-${this.ideaCounter++}`,
      content: `组合创意：${ideas.map(i => i.content).join(' + ')}`,
      novelty: Math.max(...ideas.map(i => i.novelty)),
      usefulness: ideas.reduce((sum, i) => sum + i.usefulness, 0) / ideas.length,
      source: 'combination',
      components: ideas.map(i => i.id)
    }
  }
  
  getStats() {
    return {
      total_ideas: this.ideaCounter
    }
  }
}
