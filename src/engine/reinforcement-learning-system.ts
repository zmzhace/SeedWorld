/**
 * 强化学习系统
 * 核心：Agents 通过试错学习，强化有效的行为
 */

import type { PersonalAgentState } from '@/domain/world'

export type RLState = {
  agent_id: string
  q_values: Map<string, number>
  policy: Map<string, number>
  learning_rate: number
  discount_factor: number
  exploration_rate: number
}

export class ReinforcementLearningSystem {
  private states: Map<string, RLState> = new Map()
  
  initializeRL(agent: PersonalAgentState): RLState {
    return {
      agent_id: agent.genetics.seed,
      q_values: new Map(),
      policy: new Map(),
      learning_rate: 0.1,
      discount_factor: 0.9,
      exploration_rate: 0.2
    }
  }
  
  updateQValue(
    agentId: string,
    state: string,
    action: string,
    reward: number,
    next_state: string
  ): void {
    const rlState = this.states.get(agentId)
    if (!rlState) return
    
    const currentQ = rlState.q_values.get(`${state}-${action}`) || 0
    const maxNextQ = Math.max(...Array.from(rlState.q_values.values()))
    
    const newQ = currentQ + rlState.learning_rate * (reward + rlState.discount_factor * maxNextQ - currentQ)
    rlState.q_values.set(`${state}-${action}`, newQ)
  }
  
  selectAction(agentId: string, state: string, availableActions: string[]): string {
    const rlState = this.states.get(agentId)
    if (!rlState) return availableActions[0]
    
    // ε-greedy 策略
    if (Math.random() < rlState.exploration_rate) {
      return availableActions[Math.floor(Math.random() * availableActions.length)]
    }
    
    // 选择 Q 值最高的动作
    let bestAction = availableActions[0]
    let bestQ = -Infinity
    
    for (const action of availableActions) {
      const q = rlState.q_values.get(`${state}-${action}`) || 0
      if (q > bestQ) {
        bestQ = q
        bestAction = action
      }
    }
    
    return bestAction
  }
  
  getStats() {
    return {
      total_agents: this.states.size,
      avg_exploration_rate: Array.from(this.states.values()).reduce((sum, s) => sum + s.exploration_rate, 0) / this.states.size || 0
    }
  }
}
