/**
 * 社会角色系统
 * 核心：Agents 在不同情境中扮演不同的社会角色
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type RoleType = 'professional' | 'family' | 'social' | 'cultural'

export type SocialRole = {
  id: string
  type: RoleType
  name: string
  expectations: string[]  // 角色期望
  obligations: string[]  // 角色义务
  privileges: string[]  // 角色特权
  identity_strength: number  // 认同强度 [0-1]
  context: string  // 角色适用的情境
}

export type RoleConflict = {
  agent_id: string
  role1: SocialRole
  role2: SocialRole
  conflict_description: string
  intensity: number  // 冲突强度 [0-1]
  resolution_strategy?: string
}

export class SocialRoleSystem {
  private agentRoles: Map<string, SocialRole[]> = new Map()
  private roleConflicts: RoleConflict[] = []
  
  /**
   * 为 agent 分配角色
   */
  assignRoles(agent: PersonalAgentState, world: WorldSlice): SocialRole[] {
    const roles: SocialRole[] = []
    
    // 1. 职业角色
    if (agent.occupation) {
      roles.push(this.createProfessionalRole(agent))
    }
    
    // 2. 社交角色（基于社交网络位置）
    const socialRole = this.determineSocialRole(agent, world)
    if (socialRole) {
      roles.push(socialRole)
    }
    
    // 3. 文化角色（基于个性和信念）
    const culturalRole = this.determineCulturalRole(agent)
    if (culturalRole) {
      roles.push(culturalRole)
    }
    
    this.agentRoles.set(agent.genetics.seed, roles)
    return roles
  }
  
  /**
   * 创建职业角色
   */
  private createProfessionalRole(agent: PersonalAgentState): SocialRole {
    const occupation = agent.occupation || '普通人'
    
    const roleDefinitions: Record<string, {
      expectations: string[]
      obligations: string[]
      privileges: string[]
    }> = {
      '医生': {
        expectations: ['救死扶伤', '专业可靠', '保守秘密'],
        obligations: ['治疗病人', '持续学习', '遵守医德'],
        privileges: ['受人尊敬', '获得报酬', '社会地位']
      },
      '教师': {
        expectations: ['传授知识', '关心学生', '以身作则'],
        obligations: ['备课教学', '评估学生', '持续进修'],
        privileges: ['受人尊敬', '影响他人', '稳定工作']
      },
      '商人': {
        expectations: ['诚信经营', '创造价值', '承担风险'],
        obligations: ['维护客户', '管理资源', '遵守法规'],
        privileges: ['获得利润', '自主决策', '积累财富']
      },
      '艺术家': {
        expectations: ['创造美', '表达情感', '启发他人'],
        obligations: ['持续创作', '提升技艺', '展示作品'],
        privileges: ['自由表达', '获得认可', '影响文化']
      }
    }
    
    const definition = roleDefinitions[occupation] || {
      expectations: ['履行职责', '遵守规范'],
      obligations: ['完成工作', '持续学习'],
      privileges: ['获得报酬', '社会认可']
    }
    
    return {
      id: `role-professional-${agent.genetics.seed}`,
      type: 'professional',
      name: occupation,
      expectations: definition.expectations,
      obligations: definition.obligations,
      privileges: definition.privileges,
      identity_strength: 0.6 + agent.persona.agency * 0.3,
      context: '工作场合'
    }
  }
  
  /**
   * 确定社交角色
   */
  private determineSocialRole(agent: PersonalAgentState, world: WorldSlice): SocialRole | null {
    // 计算社交网络中的位置
    const friendCount = Object.values(agent.relations).filter(v => v > 0.5).length
    const totalAgents = world.agents.npcs.length
    
    // 领导者
    if (friendCount > totalAgents * 0.4 && agent.persona.agency > 0.7) {
      return {
        id: `role-social-${agent.genetics.seed}`,
        type: 'social',
        name: '领导者',
        expectations: ['带领群体', '做出决策', '承担责任'],
        obligations: ['关心成员', '解决冲突', '制定方向'],
        privileges: ['获得尊重', '影响决策', '优先资源'],
        identity_strength: agent.persona.agency * 0.8,
        context: '群体活动'
      }
    }
    
    // 调解者
    if (agent.persona.empathy > 0.7 && agent.persona.stability > 0.6) {
      return {
        id: `role-social-${agent.genetics.seed}`,
        type: 'social',
        name: '调解者',
        expectations: ['化解矛盾', '促进和谐', '倾听各方'],
        obligations: ['保持中立', '寻求共识', '维护关系'],
        privileges: ['受人信任', '获得感激', '广泛人脉'],
        identity_strength: agent.persona.empathy * 0.7,
        context: '冲突情境'
      }
    }
    
    // 追随者
    if (friendCount < totalAgents * 0.2 && agent.persona.attachment > 0.6) {
      return {
        id: `role-social-${agent.genetics.seed}`,
        type: 'social',
        name: '追随者',
        expectations: ['支持领导', '执行任务', '保持忠诚'],
        obligations: ['服从决策', '完成分工', '维护团结'],
        privileges: ['获得保护', '分享成果', '归属感'],
        identity_strength: agent.persona.attachment * 0.6,
        context: '群体活动'
      }
    }
    
    return null
  }
  
  /**
   * 确定文化角色
   */
  private determineCulturalRole(agent: PersonalAgentState): SocialRole | null {
    // 守护者
    if (agent.persona.stability > 0.7 && agent.core_belief?.includes('传统')) {
      return {
        id: `role-cultural-${agent.genetics.seed}`,
        type: 'cultural',
        name: '守护者',
        expectations: ['维护传统', '传承文化', '抵制变革'],
        obligations: ['保存知识', '教导后辈', '维持秩序'],
        privileges: ['受人尊敬', '文化权威', '历史地位'],
        identity_strength: agent.persona.stability * 0.8,
        context: '文化活动'
      }
    }
    
    // 革新者
    if (agent.persona.openness > 0.8 && agent.persona.agency > 0.7) {
      return {
        id: `role-cultural-${agent.genetics.seed}`,
        type: 'cultural',
        name: '革新者',
        expectations: ['推动变革', '挑战现状', '创造新事物'],
        obligations: ['承担风险', '说服他人', '证明价值'],
        privileges: ['引领潮流', '获得认可', '改变世界'],
        identity_strength: agent.persona.openness * 0.7,
        context: '创新活动'
      }
    }
    
    // 边缘人
    if (agent.persona.stability < 0.3 && Object.values(agent.relations).filter(v => v > 0.3).length < 2) {
      return {
        id: `role-cultural-${agent.genetics.seed}`,
        type: 'cultural',
        name: '边缘人',
        expectations: ['独立思考', '保持距离', '观察社会'],
        obligations: ['自我负责', '不依赖他人'],
        privileges: ['自由行动', '独特视角', '不受约束'],
        identity_strength: 0.5,
        context: '独处时'
      }
    }
    
    return null
  }
  
  /**
   * 检测角色冲突
   */
  detectRoleConflicts(agent: PersonalAgentState): RoleConflict[] {
    const roles = this.agentRoles.get(agent.genetics.seed) || []
    const conflicts: RoleConflict[] = []
    
    // 检查所有角色对
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        const conflict = this.checkRoleConflict(agent, roles[i], roles[j])
        if (conflict) {
          conflicts.push(conflict)
        }
      }
    }
    
    this.roleConflicts.push(...conflicts)
    return conflicts
  }
  
  /**
   * 检查两个角色是否冲突
   */
  private checkRoleConflict(
    agent: PersonalAgentState,
    role1: SocialRole,
    role2: SocialRole
  ): RoleConflict | null {
    // 职业 vs 社交角色冲突
    if (role1.type === 'professional' && role2.type === 'social') {
      if (role1.name === '医生' && role2.name === '领导者') {
        return {
          agent_id: agent.genetics.seed,
          role1,
          role2,
          conflict_description: '医生的专业义务与领导者的决策权力冲突',
          intensity: 0.6,
          resolution_strategy: '在不同情境切换角色'
        }
      }
    }
    
    // 文化角色冲突
    if (role1.type === 'cultural' && role2.type === 'cultural') {
      if (role1.name === '守护者' && role2.name === '革新者') {
        return {
          agent_id: agent.genetics.seed,
          role1,
          role2,
          conflict_description: '守护传统与推动变革的根本矛盾',
          intensity: 0.9,
          resolution_strategy: '选择一个主导角色'
        }
      }
    }
    
    // 社交角色冲突
    if (role1.type === 'social' && role2.type === 'social') {
      if (role1.name === '领导者' && role2.name === '追随者') {
        return {
          agent_id: agent.genetics.seed,
          role1,
          role2,
          conflict_description: '领导与追随的身份矛盾',
          intensity: 0.7,
          resolution_strategy: '根据群体大小切换'
        }
      }
    }
    
    // 检查期望冲突
    const expectationConflict = this.checkExpectationConflict(role1, role2)
    if (expectationConflict) {
      return {
        agent_id: agent.genetics.seed,
        role1,
        role2,
        conflict_description: expectationConflict,
        intensity: 0.5,
        resolution_strategy: '优先满足认同度更高的角色'
      }
    }
    
    return null
  }
  
  /**
   * 检查期望冲突
   */
  private checkExpectationConflict(role1: SocialRole, role2: SocialRole): string | null {
    // 简化：检查关键词冲突
    const conflictPairs = [
      ['服从', '决策'],
      ['保守', '创新'],
      ['独立', '合作'],
      ['竞争', '和谐']
    ]
    
    for (const [word1, word2] of conflictPairs) {
      const role1Has = role1.expectations.some(e => e.includes(word1))
      const role2Has = role2.expectations.some(e => e.includes(word2))
      
      if (role1Has && role2Has) {
        return `${role1.name}要求${word1}，但${role2.name}要求${word2}`
      }
    }
    
    return null
  }
  
  /**
   * 角色转换
   */
  switchRole(
    agent: PersonalAgentState,
    context: string,
    world: WorldSlice
  ): SocialRole | null {
    const roles = this.agentRoles.get(agent.genetics.seed) || []
    
    // 根据情境选择最合适的角色
    for (const role of roles) {
      if (role.context.includes(context) || context.includes(role.context)) {
        return role
      }
    }
    
    // 如果没有匹配的角色，返回认同度最高的
    return roles.sort((a, b) => b.identity_strength - a.identity_strength)[0] || null
  }
  
  /**
   * 应用角色影响到行为
   */
  applyRoleInfluence(
    agent: PersonalAgentState,
    action: { type: string; target?: string },
    currentRole: SocialRole
  ): {
    modified: boolean
    influence_description: string
    behavior_change: number  // [-1, 1]
  } {
    let modified = false
    let influence_description = ''
    let behavior_change = 0
    
    // 领导者角色
    if (currentRole.name === '领导者') {
      if (action.type === 'help' || action.type === 'lead') {
        modified = true
        influence_description = '领导者角色强化了帮助和领导行为'
        behavior_change = 0.3
      }
    }
    
    // 调解者角色
    if (currentRole.name === '调解者') {
      if (action.type === 'compete' || action.type === 'conflict') {
        modified = true
        influence_description = '调解者角色抑制了竞争和冲突行为'
        behavior_change = -0.4
      }
    }
    
    // 守护者角色
    if (currentRole.name === '守护者') {
      if (action.type === 'innovate' || action.type === 'change') {
        modified = true
        influence_description = '守护者角色抑制了创新和变革行为'
        behavior_change = -0.3
      }
    }
    
    // 革新者角色
    if (currentRole.name === '革新者') {
      if (action.type === 'explore' || action.type === 'create') {
        modified = true
        influence_description = '革新者角色强化了探索和创造行为'
        behavior_change = 0.4
      }
    }
    
    return { modified, influence_description, behavior_change }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const allRoles = Array.from(this.agentRoles.values()).flat()
    
    const roleTypeCounts = {
      professional: allRoles.filter(r => r.type === 'professional').length,
      family: allRoles.filter(r => r.type === 'family').length,
      social: allRoles.filter(r => r.type === 'social').length,
      cultural: allRoles.filter(r => r.type === 'cultural').length
    }
    
    const roleNameCounts = new Map<string, number>()
    for (const role of allRoles) {
      roleNameCounts.set(role.name, (roleNameCounts.get(role.name) || 0) + 1)
    }
    
    return {
      total_agents_with_roles: this.agentRoles.size,
      total_roles: allRoles.length,
      avg_roles_per_agent: allRoles.length / this.agentRoles.size || 0,
      role_type_distribution: roleTypeCounts,
      role_name_distribution: Object.fromEntries(roleNameCounts),
      total_conflicts: this.roleConflicts.length,
      avg_conflict_intensity: this.roleConflicts.reduce((sum, c) => sum + c.intensity, 0) / this.roleConflicts.length || 0
    }
  }
  
  /**
   * 获取 agent 的所有角色
   */
  getAgentRoles(agentId: string): SocialRole[] {
    return this.agentRoles.get(agentId) || []
  }
  
  /**
   * 获取所有角色冲突
   */
  getAllConflicts(): RoleConflict[] {
    return this.roleConflicts
  }
}
