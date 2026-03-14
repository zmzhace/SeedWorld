/**
 * Agent 个性化决策系统
 * 基于 agent 的个性、信念、目标和当前上下文做决策
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { NarrativePattern } from '@/domain/narrative'

export type AgentAction = {
  type: 'interact' | 'explore' | 'reflect' | 'pursue_goal' | 'avoid' | 'help' | 'compete'
  target?: string  // 目标 agent
  intensity: number  // 行动强度 [0-1]
  reason: string  // 决策理由
}

export type DecisionContext = {
  world: WorldSlice
  agent: PersonalAgentState
  narratives: NarrativePattern[]
  recentEvents: WorldSlice['events']
}

export class AgentDecisionMaker {
  /**
   * 做决策
   */
  makeDecision(context: DecisionContext): AgentAction {
    const { agent, world, narratives } = context
    
    // 1. 生成候选行动
    const candidates = this.generateCandidateActions(context)
    
    // 2. 评估每个行动
    const evaluatedActions = candidates.map(action => ({
      action,
      score: this.evaluateAction(agent, action, context)
    }))
    
    // 3. 选择最优行动
    const best = evaluatedActions.sort((a, b) => b.score - a.score)[0]
    
    return best?.action || this.getDefaultAction(agent)
  }

  /**
   * 生成候选行动
   */
  private generateCandidateActions(context: DecisionContext): AgentAction[] {
    const { agent, world, narratives } = context
    const actions: AgentAction[] = []
    
    // 基于目标生成行动
    for (const goal of agent.goals) {
      actions.push({
        type: 'pursue_goal',
        intensity: 0.7,
        reason: `追求目标: ${goal}`
      })
    }
    
    // 基于关系生成行动
    for (const [target, value] of Object.entries(agent.relations)) {
      if (value > 0.5) {
        actions.push({
          type: 'help',
          target,
          intensity: value,
          reason: `帮助朋友 ${target}`
        })
      } else if (value < -0.5) {
        actions.push({
          type: 'compete',
          target,
          intensity: Math.abs(value),
          reason: `与 ${target} 竞争`
        })
      }
    }
    
    // 基于叙事生成行动
    const participatingNarratives = narratives.filter(n =>
      n.participants.includes(agent.genetics.seed)
    )
    
    for (const narrative of participatingNarratives) {
      if (narrative.type === 'conflict') {
        const opponent = narrative.participants.find(p => p !== agent.genetics.seed)
        if (opponent) {
          actions.push({
            type: 'compete',
            target: opponent,
            intensity: narrative.intensity,
            reason: `解决与 ${opponent} 的冲突`
          })
        }
      } else if (narrative.type === 'alliance') {
        const ally = narrative.participants.find(p => p !== agent.genetics.seed)
        if (ally) {
          actions.push({
            type: 'help',
            target: ally,
            intensity: narrative.intensity,
            reason: `维护与 ${ally} 的联盟`
          })
        }
      }
    }
    
    // 基于个性生成行动
    if (agent.persona.openness > 0.7) {
      actions.push({
        type: 'explore',
        intensity: agent.persona.openness,
        reason: '探索新事物（高开放性）'
      })
    }
    
    if (agent.persona.empathy > 0.7) {
      // 寻找需要帮助的 agents
      const needHelp = world.agents.npcs.find(a =>
        a.vitals.energy < 0.3 || a.vitals.stress > 0.7
      )
      if (needHelp) {
        actions.push({
          type: 'help',
          target: needHelp.genetics.seed,
          intensity: agent.persona.empathy,
          reason: `帮助 ${needHelp.identity.name}（高同理心）`
        })
      }
    }
    
    // 基于情感生成行动
    if (agent.emotion.intensity > 0.7) {
      if (agent.emotion.label === 'anxious' || agent.emotion.label === 'worried') {
        actions.push({
          type: 'avoid',
          intensity: agent.emotion.intensity,
          reason: '避免冲突（焦虑状态）'
        })
      } else if (agent.emotion.label === 'excited') {
        actions.push({
          type: 'interact',
          intensity: agent.emotion.intensity,
          reason: '主动互动（兴奋状态）'
        })
      }
    }
    
    // 默认行动
    actions.push({
      type: 'reflect',
      intensity: 0.3,
      reason: '反思和休息'
    })
    
    return actions
  }
  
  /**
   * 评估行动
   */
  evaluateAction(
    agent: PersonalAgentState,
    action: AgentAction,
    context: DecisionContext
  ): number {
    let score = 0
    
    // 1. 基于个性评分
    score += this.scoreByPersonality(agent, action)
    
    // 2. 基于信念评分
    score += this.scoreByCoreBeliefs(agent, action)
    
    // 3. 基于当前状态评分
    score += this.scoreByCurrentState(agent, action)
    
    // 4. 基于叙事相关性评分
    score += this.scoreByNarrativeRelevance(agent, action, context.narratives)
    
    // 5. 基于预期效果评分
    score += this.scoreByExpectedOutcome(agent, action, context)
    
    return score
  }
  
  /**
   * 基于个性评分
   */
  private scoreByPersonality(agent: PersonalAgentState, action: AgentAction): number {
    let score = 0
    
    switch (action.type) {
      case 'explore':
        score += agent.persona.openness * 2
        break
      case 'help':
        score += agent.persona.empathy * 2
        break
      case 'compete':
        score += agent.persona.agency * 1.5
        break
      case 'reflect':
        score += agent.persona.stability * 1.5
        break
      case 'interact':
        score += (1 - agent.persona.stability) * 1.5  // 不稳定的人更喜欢互动
        break
    }
    
    return score
  }
  
  /**
   * 基于信念评分
   */
  private scoreByCoreBeliefs(agent: PersonalAgentState, action: AgentAction): number {
    if (!agent.core_belief) return 0
    
    const belief = agent.core_belief.toLowerCase()
    let score = 0
    
    // 根据信念调整行动偏好
    if (belief.includes('和平') || belief.includes('和谐')) {
      if (action.type === 'help') score += 2
      if (action.type === 'compete') score -= 1
    }
    
    if (belief.includes('竞争') || belief.includes('胜利')) {
      if (action.type === 'compete') score += 2
      if (action.type === 'help') score -= 0.5
    }
    
    if (belief.includes('知识') || belief.includes('学习')) {
      if (action.type === 'explore') score += 2
      if (action.type === 'reflect') score += 1
    }
    
    if (belief.includes('友谊') || belief.includes('关系')) {
      if (action.type === 'interact') score += 2
      if (action.type === 'help') score += 1
    }
    
    return score
  }
  
  /**
   * 基于当前状态评分
   */
  private scoreByCurrentState(agent: PersonalAgentState, action: AgentAction): number {
    let score = 0
    
    // 能量低时倾向于休息
    if (agent.vitals.energy < 0.3) {
      if (action.type === 'reflect') score += 3
      if (action.type === 'explore' || action.type === 'compete') score -= 2
    }
    
    // 压力高时倾向于避免冲突
    if (agent.vitals.stress > 0.7) {
      if (action.type === 'avoid') score += 2
      if (action.type === 'compete') score -= 2
    }
    
    // 专注度高时倾向于追求目标
    if (agent.vitals.focus > 0.7) {
      if (action.type === 'pursue_goal') score += 2
    }
    
    return score
  }
  
  /**
   * 基于叙事相关性评分
   */
  private scoreByNarrativeRelevance(
    agent: PersonalAgentState,
    action: AgentAction,
    narratives: NarrativePattern[]
  ): number {
    let score = 0
    
    const participatingNarratives = narratives.filter(n =>
      n.participants.includes(agent.genetics.seed)
    )
    
    for (const narrative of participatingNarratives) {
      // 如果行动与叙事相关，加分
      if (action.target && narrative.participants.includes(action.target)) {
        score += narrative.intensity * 2
      }
      
      // 高潮阶段的叙事权重更高
      if (narrative.status === 'climax') {
        score += 1
      }
    }
    
    return score
  }
  
  /**
   * 基于预期效果评分
   */
  private scoreByExpectedOutcome(
    agent: PersonalAgentState,
    action: AgentAction,
    context: DecisionContext
  ): number {
    let score = 0
    
    // 预测行动的效果
    if (action.type === 'help' && action.target) {
      // 帮助会改善关系
      const currentRelation = agent.relations[action.target] || 0
      if (currentRelation < 0.8) {
        score += 1  // 有改善空间
      }
    }
    
    if (action.type === 'compete' && action.target) {
      // 竞争可能恶化关系，但可能实现目标
      const hasConflictGoal = agent.goals.some(g => g.includes(action.target))
      if (hasConflictGoal) {
        score += 2  // 符合目标
      } else {
        score -= 1  // 不必要的冲突
      }
    }
    
    if (action.type === 'pursue_goal') {
      // 追求目标总是好的
      score += 1.5
    }
    
    return score
  }
  
  /**
   * 获取默认行动
   */
  private getDefaultAction(agent: PersonalAgentState): AgentAction {
    return {
      type: 'reflect',
      intensity: 0.3,
      reason: '默认行动：反思'
    }
  }
  
  /**
   * 选择最优行动
   */
  selectBestAction(
    agent: PersonalAgentState,
    candidates: AgentAction[],
    context: DecisionContext
  ): AgentAction {
    if (candidates.length === 0) {
      return this.getDefaultAction(agent)
    }
    
    const evaluated = candidates.map(action => ({
      action,
      score: this.evaluateAction(agent, action, context)
    }))
    
    // 按分数排序
    evaluated.sort((a, b) => b.score - a.score)
    
    // 添加一些随机性（避免过于确定性）
    const topActions = evaluated.slice(0, 3)
    const randomIndex = Math.floor(Math.random() * topActions.length)
    
    return topActions[randomIndex].action
  }
}
