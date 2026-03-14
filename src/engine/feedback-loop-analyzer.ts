/**
 * 反馈回路分析器
 * 核心：识别和分析系统中的正反馈和负反馈回路
 */

import type { WorldSlice } from '@/domain/world'

export type FeedbackLoop = {
  id: string
  type: 'positive' | 'negative' | 'delayed'
  nodes: string[]
  edges: Array<{ from: string; to: string; weight: number }>
  strength: number
  stability: number
  delay: number
}

export class FeedbackLoopAnalyzer {
  private loops: FeedbackLoop[] = []
  
  identifyLoops(world: WorldSlice): FeedbackLoop[] {
    // 简化实现：识别声誉-行为回路
    const loop: FeedbackLoop = {
      id: 'reputation-behavior-loop',
      type: 'positive',
      nodes: ['reputation', 'behavior', 'social_response'],
      edges: [
        { from: 'reputation', to: 'behavior', weight: 0.6 },
        { from: 'behavior', to: 'social_response', weight: 0.7 },
        { from: 'social_response', to: 'reputation', weight: 0.8 }
      ],
      strength: 0.7,
      stability: 0.6,
      delay: 2
    }
    
    this.loops.push(loop)
    return this.loops
  }
  
  getStats() {
    return {
      total_loops: this.loops.length,
      positive_loops: this.loops.filter(l => l.type === 'positive').length,
      negative_loops: this.loops.filter(l => l.type === 'negative').length
    }
  }
}
