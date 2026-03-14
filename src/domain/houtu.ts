/**
 * 后土系统 - 掌管生死轮回与销毁机制
 * 
 * 职责：
 * 1. 判定 agent 的生死
 * 2. 处理死亡后的遗产和影响
 * 3. 决定是否轮回（重生）
 * 4. 清理不再需要的 agents
 */

import type { PersonalAgentState } from './world'

export type DeathJudgment = {
  agent_seed: string
  should_die: boolean
  reason?: string
  death_type: 'natural' | 'conflict' | 'fate' | 'sacrifice'
  legacy?: string[]
}

export type ReincarnationDecision = {
  agent_seed: string
  should_reincarnate: boolean
  new_role?: 'protagonist' | 'supporting' | 'npc'
  inherited_traits?: {
    goals?: string[]
    relations?: Record<string, number>
    memories?: string[]
  }
}

export type HoutuConfig = {
  // 生死判定
  natural_death_threshold: number  // 0-1，衰老指数阈值
  conflict_lethality: number       // 0-1，冲突致死概率
  fate_strictness: number          // 0-1，命运的严格程度
  
  // 轮回机制
  reincarnation_enabled: boolean
  reincarnation_delay: number      // 死后多少 tick 可以轮回
  memory_retention: number         // 0-1，轮回后保留多少记忆
  
  // 清理机制
  auto_cleanup: boolean
  cleanup_delay: number            // 死后多少 tick 清理
  preserve_legacy: boolean         // 是否保留遗产
}

export const createHoutuConfig = (config: Partial<HoutuConfig> = {}): HoutuConfig => ({
  natural_death_threshold: config.natural_death_threshold ?? 0.9,
  conflict_lethality: config.conflict_lethality ?? 0.3,
  fate_strictness: config.fate_strictness ?? 0.7,
  reincarnation_enabled: config.reincarnation_enabled ?? true,
  reincarnation_delay: config.reincarnation_delay ?? 10,
  memory_retention: config.memory_retention ?? 0.2,
  auto_cleanup: config.auto_cleanup ?? true,
  cleanup_delay: config.cleanup_delay ?? 50,
  preserve_legacy: config.preserve_legacy ?? true,
})

/**
 * 判定 agent 是否应该死亡
 */
export function judgeLife(
  agent: PersonalAgentState,
  worldTick: number,
  config: HoutuConfig
): DeathJudgment {
  // 已经死亡的不再判定
  if (agent.life_status !== 'alive') {
    return {
      agent_seed: agent.genetics.seed,
      should_die: false,
      death_type: 'natural',
    }
  }
  
  // 自然死亡 - 衰老
  if (agent.vitals.aging_index >= config.natural_death_threshold) {
    return {
      agent_seed: agent.genetics.seed,
      should_die: true,
      reason: `寿终正寝，享年 ${Math.floor(agent.vitals.aging_index * 100)} 岁`,
      death_type: 'natural',
      legacy: agent.goals.filter(g => g.includes('传承') || g.includes('后代')),
    }
  }
  
  // 压力过大导致死亡
  if (agent.vitals.stress > 0.95 && agent.vitals.energy < 0.1) {
    return {
      agent_seed: agent.genetics.seed,
      should_die: true,
      reason: '心力交瘁，积劳成疾',
      death_type: 'natural',
      legacy: agent.goals,
    }
  }
  
  // 根据角色类型判定重要性
  if (agent.role === 'npc' && Math.random() > 0.95) {
    // NPC 有小概率自然消失
    return {
      agent_seed: agent.genetics.seed,
      should_die: true,
      reason: '淡出历史舞台',
      death_type: 'natural',
    }
  }
  
  return {
    agent_seed: agent.genetics.seed,
    should_die: false,
    death_type: 'natural',
  }
}

/**
 * 决定是否轮回
 */
export function decideReincarnation(
  agent: PersonalAgentState,
  worldTick: number,
  config: HoutuConfig
): ReincarnationDecision {
  if (!config.reincarnation_enabled) {
    return {
      agent_seed: agent.genetics.seed,
      should_reincarnate: false,
    }
  }
  
  // 检查是否到了轮回时间
  const ticksSinceDeath = worldTick - (agent.death_tick || 0)
  if (ticksSinceDeath < config.reincarnation_delay) {
    return {
      agent_seed: agent.genetics.seed,
      should_reincarnate: false,
    }
  }
  
  // 主要人物更容易轮回
  const reincarnationChance = 
    agent.role === 'protagonist' ? 0.8 :
    agent.role === 'supporting' ? 0.5 :
    0.2  // NPC
  
  if (Math.random() > reincarnationChance) {
    return {
      agent_seed: agent.genetics.seed,
      should_reincarnate: false,
    }
  }
  
  // 决定轮回后的角色
  const newRole = 
    agent.role === 'protagonist' ? 'supporting' :  // 主角降级为配角
    agent.role === 'supporting' ? 'npc' :          // 配角降级为 NPC
    'npc'
  
  // 保留部分记忆和关系
  const inheritedGoals = agent.goals
    .filter(() => Math.random() < config.memory_retention)
  
  const inheritedRelations: Record<string, number> = {}
  Object.entries(agent.relations).forEach(([key, value]) => {
    if (Math.random() < config.memory_retention) {
      inheritedRelations[key] = value * 0.5  // 关系减半
    }
  })
  
  return {
    agent_seed: agent.genetics.seed,
    should_reincarnate: true,
    new_role: newRole,
    inherited_traits: {
      goals: inheritedGoals,
      relations: inheritedRelations,
      memories: agent.memory_long
        .filter(() => Math.random() < config.memory_retention * 0.5)
        .map(m => m.content),
    },
  }
}
