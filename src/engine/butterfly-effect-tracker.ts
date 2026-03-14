/**
 * 蝴蝶效应追踪器
 * 核心：追踪小事件如何产生巨大影响
 */

import type { WorldSlice } from '@/domain/world'

export type CausalChain = {
  id: string
  initial_event: WorldSlice['events'][0]
  chain: WorldSlice['events']
  amplification_factor: number
  final_impact: string
  key_nodes: WorldSlice['events']
}

export class ButterflyEffectTracker {
  private chains: CausalChain[] = []
  
  trackCausalChain(
    initial_event: WorldSlice['events'][0],
    world: WorldSlice
  ): CausalChain {
    const chain: CausalChain = {
      id: `chain-${initial_event.id}`,
      initial_event,
      chain: [initial_event],
      amplification_factor: 1.0,
      final_impact: '待观察',
      key_nodes: []
    }
    
    this.chains.push(chain)
    return chain
  }
  
  calculateAmplification(chain: CausalChain): number {
    return chain.chain.length * 0.5
  }
  
  getStats() {
    return {
      total_chains: this.chains.length,
      avg_amplification: this.chains.reduce((sum, c) => sum + c.amplification_factor, 0) / this.chains.length || 0
    }
  }
}
