/**
 * 多视角叙事系统
 * 核心：同一事件从不同 agents 的视角有不同的解读
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { CognitiveBias } from './cognitive-bias-system'

export type Perspective = {
  agent_id: string
  event_id: string
  interpretation: string
  emotional_coloring: number  // [-1, 1]
  details_noticed: string[]
  details_missed: string[]
  biases_applied: string[]
  confidence: number
}

export class MultiPerspectiveSystem {
  /**
   * 生成视角
   */
  generatePerspective(
    agent: PersonalAgentState,
    event: WorldSlice['events'][0],
    biases: CognitiveBias[]
  ): Perspective {
    return {
      agent_id: agent.genetics.seed,
      event_id: event.id,
      interpretation: this.interpretEvent(agent, event),
      emotional_coloring: this.calculateEmotionalColoring(agent, event),
      details_noticed: this.identifyNoticedDetails(agent, event),
      details_missed: this.identifyMissedDetails(agent, event),
      biases_applied: biases.map(b => b.type),
      confidence: 0.5 + agent.persona.stability * 0.3
    }
  }
  
  private interpretEvent(agent: PersonalAgentState, event: WorldSlice['events'][0]): string {
    const baseInterpretation = event.payload?.summary as string || event.type
    
    // 基于个性调整解读
    if (agent.persona.openness > 0.7) {
      return `${baseInterpretation}（这可能带来新机会）`
    } else if (agent.persona.stability < 0.3) {
      return `${baseInterpretation}（这让我感到不安）`
    }
    
    return baseInterpretation
  }
  
  private calculateEmotionalColoring(agent: PersonalAgentState, event: WorldSlice['events'][0]): number {
    let coloring = 0
    
    // 基于当前情绪
    if (agent.emotion.label === 'joyful') coloring += 0.5
    if (agent.emotion.label === 'sad') coloring -= 0.5
    if (agent.emotion.label === 'angry') coloring -= 0.3
    
    // 基于事件类型
    if (event.type.includes('death')) coloring -= 0.7
    if (event.type.includes('success')) coloring += 0.6
    
    return Math.max(-1, Math.min(1, coloring))
  }
  
  private identifyNoticedDetails(agent: PersonalAgentState, event: WorldSlice['events'][0]): string[] {
    const details: string[] = []
    
    // 高开放性注意到更多细节
    if (agent.persona.openness > 0.7) {
      details.push('环境细节', '微妙变化')
    }
    
    // 高同理心注意到情感细节
    if (agent.persona.empathy > 0.7) {
      details.push('他人情绪', '人际动态')
    }
    
    return details
  }
  
  private identifyMissedDetails(agent: PersonalAgentState, event: WorldSlice['events'][0]): string[] {
    const details: string[] = []
    
    // 低稳定性可能错过重要信息
    if (agent.persona.stability < 0.3) {
      details.push('关键事实', '长期影响')
    }
    
    return details
  }
  
  /**
   * 比较视角
   */
  comparePerspectives(perspectives: Perspective[]): {
    agreements: string[]
    disagreements: string[]
    unique_insights: string[]
  } {
    const agreements: string[] = []
    const disagreements: string[] = []
    const unique_insights: string[] = []
    
    // 简化实现
    if (perspectives.length >= 2) {
      const avgEmotional = perspectives.reduce((sum, p) => sum + p.emotional_coloring, 0) / perspectives.length
      
      if (Math.abs(avgEmotional) < 0.2) {
        agreements.push('对事件的情感反应相似')
      } else {
        disagreements.push('对事件的情感反应差异很大')
      }
    }
    
    return { agreements, disagreements, unique_insights }
  }
}
