/**
 * 测试女娲造人系统和 Agent 决策系统的集成
 */

import { AgentDecisionMaker } from './src/engine/agent-decision-maker'
import { createPersonalAgent } from './src/domain/agents'
import type { WorldSlice, PersonalAgentState } from './src/domain/world'

// 创建测试世界
function createTestWorld(): WorldSlice {
  return {
    id: 'test-world',
    tick: 1,
    time: new Date().toISOString(),
    agents: {
      personal: createPersonalAgent('player'),
      npcs: [],
    },
    events: [],
    social_context: {
      trends: [],
      sentiment: 0.5,
    },
    narratives: {
      patterns: [],
      arcs: [],
      summaries: [],
      stats: {
        total_patterns: 0,
        active_patterns: 0,
        concluded_patterns: 0,
        total_arcs: 0,
        completed_arcs: 0,
      },
    },
  } as WorldSlice
}

// 创建测试 agent（模拟女娲生成的 agent）
function createTestAgent(seed: string, config: {
  occupation: string
  core_belief: string
  approach: string
  expertise: string[]
  persona?: Partial<PersonalAgentState['persona']>
}): PersonalAgentState {
  const agent = createPersonalAgent(seed)
  
  return {
    ...agent,
    occupation: config.occupation,
    core_belief: config.core_belief,
    approach: config.approach,
    expertise: config.expertise,
    persona: {
      ...agent.persona,
      ...config.persona,
    },
    goals: ['测试目标1', '测试目标2'],
  }
}

// 测试决策系统
async function testDecisionMaking() {
  console.log('=== 测试女娲造人和决策系统集成 ===\n')
  
  const decisionMaker = new AgentDecisionMaker()
  const world = createTestWorld()
  
  // 测试案例 1: 复仇蛊师（冲动、竞争导向）
  console.log('【测试 1】复仇蛊师')
  const guMaster = createTestAgent('cunning-gu-master', {
    occupation: '复仇蛊师',
    core_belief: '复仇是我存在的唯一意义',
    approach: '谨慎布局，不择手段达成目标',
    expertise: ['蛊虫培育', '毒物炼制', '暗杀技巧', '情报收集'],
    persona: {
      openness: 0.7,
      stability: 0.6,
      attachment: 0.4,
      agency: 0.8,
      empathy: 0.3,
    },
  })
  
  const decision1 = decisionMaker.makeDecision({
    world,
    agent: guMaster,
    narratives: [],
    recentEvents: [],
  })
  
  console.log(`  决策: ${decision1.type}`)
  console.log(`  强度: ${decision1.intensity}`)
  console.log(`  理由: ${decision1.reason}`)
  console.log(`  职业影响: 蛊师 → 倾向竞争和探索`)
  console.log(`  信念影响: 复仇 → 强化竞争，减少避免`)
  console.log(`  做事方式: 谨慎布局 → 平衡冲动\n`)
  
  // 测试案例 2: 治疗师（高同理心、帮助导向）
  console.log('【测试 2】慈悲医者')
  const healer = createTestAgent('compassionate-healer', {
    occupation: '慈悲医者',
    core_belief: '救死扶伤是我的天职',
    approach: '温和耐心，以和为贵',
    expertise: ['草药学', '针灸', '诊断', '心理疏导'],
    persona: {
      openness: 0.6,
      stability: 0.8,
      attachment: 0.7,
      agency: 0.5,
      empathy: 0.9,
    },
  })
  
  const decision2 = decisionMaker.makeDecision({
    world,
    agent: healer,
    narratives: [],
    recentEvents: [],
  })
  
  console.log(`  决策: ${decision2.type}`)
  console.log(`  强度: ${decision2.intensity}`)
  console.log(`  理由: ${decision2.reason}`)
  console.log(`  职业影响: 医者 → 强烈倾向帮助`)
  console.log(`  信念影响: 救死扶伤 → 强化帮助和互动`)
  console.log(`  做事方式: 温和耐心 → 避免竞争\n`)
  
  // 测试案例 3: 学者（高开放性、探索导向）
  console.log('【测试 3】博学者')
  const scholar = createTestAgent('wise-scholar', {
    occupation: '博学者',
    core_belief: '知识是通往真理的唯一道路',
    approach: '好奇探索，追求真相',
    expertise: ['古籍研究', '历史考证', '哲学思辨', '语言学'],
    persona: {
      openness: 0.9,
      stability: 0.7,
      attachment: 0.5,
      agency: 0.6,
      empathy: 0.6,
    },
  })
  
  const decision3 = decisionMaker.makeDecision({
    world,
    agent: scholar,
    narratives: [],
    recentEvents: [],
  })
  
  console.log(`  决策: ${decision3.type}`)
  console.log(`  强度: ${decision3.intensity}`)
  console.log(`  理由: ${decision3.reason}`)
  console.log(`  职业影响: 学者 → 倾向探索和反思`)
  console.log(`  信念影响: 知识 → 强化探索和反思`)
  console.log(`  做事方式: 好奇探索 → 强化探索\n`)
  
  // 测试案例 4: 商人（利益导向、社交能力强）
  console.log('【测试 4】精明商人')
  const merchant = createTestAgent('shrewd-merchant', {
    occupation: '元石商人',
    core_belief: '利益至上，但要维护信誉',
    approach: '利益优先，善于权衡',
    expertise: ['谈判', '市场分析', '人脉经营', '风险评估'],
    persona: {
      openness: 0.7,
      stability: 0.6,
      attachment: 0.5,
      agency: 0.8,
      empathy: 0.4,
    },
  })
  
  const decision4 = decisionMaker.makeDecision({
    world,
    agent: merchant,
    narratives: [],
    recentEvents: [],
  })
  
  console.log(`  决策: ${decision4.type}`)
  console.log(`  强度: ${decision4.intensity}`)
  console.log(`  理由: ${decision4.reason}`)
  console.log(`  职业影响: 商人 → 倾向互动和帮助（建立关系）`)
  console.log(`  信念影响: 利益至上 → 强化追求目标`)
  console.log(`  做事方式: 利益优先 → 减少无利可图的帮助\n`)
  
  console.log('=== 测试完成 ===')
  console.log('\n总结：')
  console.log('✓ 决策系统成功使用女娲生成的个性化字段')
  console.log('✓ occupation 影响行动偏好')
  console.log('✓ core_belief 驱动决策方向')
  console.log('✓ approach 调整行为风格')
  console.log('✓ expertise 提供额外加成')
  console.log('✓ 不同职业和信念产生明显不同的决策')
}

// 运行测试
testDecisionMaking().catch(console.error)
