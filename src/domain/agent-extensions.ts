/**
 * Agent 扩展系统 - 受 OpenClaw/Pi 启发
 * 
 * 核心理念：
 * 1. 最小核心 - agents 有基础能力
 * 2. 动态扩展 - agents 可以学习新技能
 * 3. 自我进化 - agents 根据经验成长
 */

import type { PersonalAgentState } from './world'

/**
 * Agent 技能
 * 类似 OpenClaw 的 SKILL.md，但更轻量
 */
export type AgentSkill = {
  id: string
  name: string
  description: string
  level: number  // 0-10，熟练度
  learned_at: number  // tick
  last_used: number  // tick
  usage_count: number
  
  // 技能类型
  category: 'combat' | 'social' | 'craft' | 'knowledge' | 'survival' | 'magic' | 'trade' | 'other'
  
  // 技能效果
  effects?: {
    success_rate?: number  // 成功率加成
    efficiency?: number  // 效率加成
    cost_reduction?: number  // 成本降低
  }
  
  // 学习条件
  prerequisites?: string[]  // 前置技能
  
  // 遗忘机制
  decay_rate: number  // 不使用时的衰减速度
}

/**
 * Agent 能力（Capabilities）
 * 控制 agent 能做什么，类似 OpenClaw 的工具策略
 */
export type AgentCapability = {
  id: string
  name: string
  enabled: boolean
  
  // 权限级别
  permission_level: 'basic' | 'advanced' | 'privileged' | 'forbidden'
  
  // 使用限制
  cooldown?: number  // 冷却时间（ticks）
  cost?: number  // 使用成本（资源、精力等）
  
  // 条件
  requires?: {
    role?: ('protagonist' | 'supporting' | 'npc')[]
    min_level?: number
    skills?: string[]
    resources?: Record<string, number>
  }
}

/**
 * Agent 扩展
 * 类似 OpenClaw 的 Extensions，可以修改 agent 行为
 */
export type AgentExtension = {
  id: string
  name: string
  type: 'passive' | 'active' | 'reactive'
  
  // 扩展效果
  effects: {
    // 属性修改
    vitals_modifier?: Partial<Record<'energy' | 'stress' | 'focus', number>>
    persona_modifier?: Partial<Record<'openness' | 'stability' | 'agency', number>>
    
    // 行为修改
    decision_weight?: number  // 影响决策权重
    action_priority?: string[]  // 优先考虑的行动类型
    
    // 特殊能力
    special_abilities?: string[]
  }
  
  // 触发条件
  trigger?: {
    event?: string  // 事件类型
    condition?: string  // 条件描述
  }
  
  // 持续时间
  duration?: number  // -1 表示永久
  expires_at?: number  // tick
}

/**
 * Agent Session（会话）
 * 类似 OpenClaw 的 SessionManager，记录 agent 的完整历史
 */
export type AgentSession = {
  agent_seed: string
  session_id: string
  started_at: number  // tick
  ended_at?: number  // tick
  
  // 会话类型
  type: 'main' | 'quest' | 'interaction' | 'training'
  
  // 会话记录
  transcript: AgentSessionEntry[]
  
  // 会话结果
  outcome?: {
    success: boolean
    rewards?: Record<string, number>
    skills_gained?: string[]
    relationships_changed?: Record<string, number>
  }
}

export type AgentSessionEntry = {
  tick: number
  type: 'thought' | 'action' | 'observation' | 'dialogue' | 'decision'
  content: string
  metadata?: Record<string, unknown>
}

/**
 * 扩展后的 Agent 状态
 */
export type ExtendedAgentState = PersonalAgentState & {
  // 技能系统
  skills: AgentSkill[]
  
  // 能力系统
  capabilities: AgentCapability[]
  
  // 扩展系统
  extensions: AgentExtension[]
  
  // 会话历史
  sessions: AgentSession[]
  
  // 资源系统
  resources: Record<string, number>  // 金钱、物品、声望等
  
  // 成长系统
  level: number
  experience: number
  
  // 状态标记
  status_effects: string[]  // 如：中毒、祝福、疲劳等
}

/**
 * 技能学习系统
 */
export function learnSkill(
  agent: ExtendedAgentState,
  skillTemplate: Omit<AgentSkill, 'learned_at' | 'last_used' | 'usage_count' | 'level'>,
  currentTick: number
): ExtendedAgentState {
  // 检查前置条件
  if (skillTemplate.prerequisites) {
    const hasPrerequisites = skillTemplate.prerequisites.every(prereq =>
      agent.skills.some(s => s.id === prereq)
    )
    if (!hasPrerequisites) {
      console.log(`Agent ${agent.identity.name} 缺少前置技能`)
      return agent
    }
  }
  
  // 检查是否已经学会
  const existingSkill = agent.skills.find(s => s.id === skillTemplate.id)
  if (existingSkill) {
    // 提升熟练度
    existingSkill.level = Math.min(10, existingSkill.level + 1)
    existingSkill.last_used = currentTick
    return agent
  }
  
  // 学习新技能
  const newSkill: AgentSkill = {
    ...skillTemplate,
    level: 1,
    learned_at: currentTick,
    last_used: currentTick,
    usage_count: 0,
  }
  
  return {
    ...agent,
    skills: [...agent.skills, newSkill],
  }
}

/**
 * 技能使用
 */
export function useSkill(
  agent: ExtendedAgentState,
  skillId: string,
  currentTick: number
): { agent: ExtendedAgentState; success: boolean; effect?: number } {
  const skill = agent.skills.find(s => s.id === skillId)
  if (!skill) {
    return { agent, success: false }
  }
  
  // 计算成功率
  const baseSuccessRate = 0.5
  const levelBonus = skill.level * 0.05
  const effectBonus = skill.effects?.success_rate || 0
  const successRate = Math.min(0.95, baseSuccessRate + levelBonus + effectBonus)
  
  const success = Math.random() < successRate
  
  // 更新技能数据
  skill.last_used = currentTick
  skill.usage_count += 1
  
  // 提升熟练度（使用越多越熟练）
  if (success && skill.level < 10) {
    const levelUpChance = 0.1 / (skill.level + 1)  // 等级越高越难升级
    if (Math.random() < levelUpChance) {
      skill.level += 1
    }
  }
  
  return {
    agent: { ...agent },
    success,
    effect: skill.effects?.efficiency,
  }
}

/**
 * 技能衰减（不使用会遗忘）
 */
export function decaySkills(
  agent: ExtendedAgentState,
  currentTick: number
): ExtendedAgentState {
  const updatedSkills = agent.skills.map(skill => {
    const ticksSinceUse = currentTick - skill.last_used
    
    // 如果长时间不用，降低熟练度
    if (ticksSinceUse > 100) {
      const decayAmount = Math.floor(ticksSinceUse / 100) * skill.decay_rate
      const newLevel = Math.max(0, skill.level - decayAmount)
      
      return {
        ...skill,
        level: newLevel,
      }
    }
    
    return skill
  }).filter(skill => skill.level > 0)  // 移除完全遗忘的技能
  
  return {
    ...agent,
    skills: updatedSkills,
  }
}

/**
 * 能力检查
 */
export function canUseCapability(
  agent: ExtendedAgentState,
  capabilityId: string
): { allowed: boolean; reason?: string } {
  const capability = agent.capabilities.find(c => c.id === capabilityId)
  
  if (!capability) {
    return { allowed: false, reason: '能力不存在' }
  }
  
  if (!capability.enabled) {
    return { allowed: false, reason: '能力未启用' }
  }
  
  if (capability.permission_level === 'forbidden') {
    return { allowed: false, reason: '权限不足' }
  }
  
  // 检查角色要求
  if (capability.requires?.role && !capability.requires.role.includes(agent.role)) {
    return { allowed: false, reason: '角色不符' }
  }
  
  // 检查等级要求
  if (capability.requires?.min_level && agent.level < capability.requires.min_level) {
    return { allowed: false, reason: '等级不足' }
  }
  
  // 检查技能要求
  if (capability.requires?.skills) {
    const hasSkills = capability.requires.skills.every(skillId =>
      agent.skills.some(s => s.id === skillId && s.level > 0)
    )
    if (!hasSkills) {
      return { allowed: false, reason: '缺少必要技能' }
    }
  }
  
  // 检查资源要求
  if (capability.requires?.resources) {
    for (const [resource, amount] of Object.entries(capability.requires.resources)) {
      if ((agent.resources[resource] || 0) < amount) {
        return { allowed: false, reason: `资源不足：${resource}` }
      }
    }
  }
  
  return { allowed: true }
}

/**
 * 添加扩展
 */
export function addExtension(
  agent: ExtendedAgentState,
  extension: AgentExtension,
  currentTick: number
): ExtendedAgentState {
  // 设置过期时间
  if (extension.duration && extension.duration > 0) {
    extension.expires_at = currentTick + extension.duration
  }
  
  return {
    ...agent,
    extensions: [...agent.extensions, extension],
  }
}

/**
 * 清理过期扩展
 */
export function cleanupExpiredExtensions(
  agent: ExtendedAgentState,
  currentTick: number
): ExtendedAgentState {
  const activeExtensions = agent.extensions.filter(ext =>
    !ext.expires_at || ext.expires_at > currentTick
  )
  
  return {
    ...agent,
    extensions: activeExtensions,
  }
}
