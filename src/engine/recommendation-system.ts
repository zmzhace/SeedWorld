/**
 * 推荐系统 - 控制 agents 看到的信息流
 * 参考 OASIS 的 RecSys 设计
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

// 定义事件类型
type WorldEvent = WorldSlice['events'][number]

export type RecommendationConfig = {
  topK: number  // 推荐数量
  interestWeight: number  // 基于兴趣的权重
  hotWeight: number  // 基于热度的权重
  socialWeight: number  // 基于社交网络的权重
  recencyWeight: number  // 时间新鲜度权重
}

export const DEFAULT_REC_CONFIG: RecommendationConfig = {
  topK: 10,
  interestWeight: 0.4,
  hotWeight: 0.3,
  socialWeight: 0.2,
  recencyWeight: 0.1,
}

/**
 * 推荐系统主类
 */
export class RecommendationSystem {
  constructor(private config: RecommendationConfig = DEFAULT_REC_CONFIG) {}

  /**
   * 为 agent 推荐事件
   */
  async recommendEvents(
    agent: PersonalAgentState,
    world: WorldSlice
  ): Promise<WorldEvent[]> {
    // 1. 基于兴趣的推荐
    const interestBasedEvents = this.getInterestBasedEvents(agent, world)
    
    // 2. 基于热度的推荐
    const hotEvents = this.getHotEvents(world)
    
    // 3. 社交网络推荐（关注的人的动态）
    const socialEvents = this.getSocialNetworkEvents(agent, world)
    
    // 4. 混合推荐
    return this.mergeRecommendations(
      interestBasedEvents,
      hotEvents,
      socialEvents
    )
  }

  /**
   * 基于兴趣的推荐
   */
  private getInterestBasedEvents(
    agent: PersonalAgentState,
    world: WorldSlice
  ): Array<{ event: WorldEvent; score: number }> {
    // 计算 agent 的兴趣向量
    const agentInterests = this.computeInterestVector(agent)
    
    // 计算每个事件与 agent 兴趣的相似度
    return world.events
      .filter(event => this.isRelevantEvent(event))
      .map(event => ({
        event,
        score: this.calculateInterestScore(agentInterests, event)
      }))
      .sort((a, b) => b.score - a.score)
  }

  /**
   * 基于热度的推荐
   */
  private getHotEvents(world: WorldSlice): Array<{ event: WorldEvent; score: number }> {
    return world.events
      .filter(event => this.isRelevantEvent(event))
      .map(event => ({
        event,
        score: this.calculateHotScore(event, world.tick)
      }))
      .sort((a, b) => b.score - a.score)
  }

  /**
   * 基于社交网络的推荐
   */
  private getSocialNetworkEvents(
    agent: PersonalAgentState,
    world: WorldSlice
  ): Array<{ event: WorldEvent; score: number }> {
    // 获取 agent 关注的人
    const followedAgents = Object.entries(agent.relations)
      .filter(([_, value]) => value > 0.3)  // 关系值 > 0.3 视为关注
      .map(([name, _]) => name)

    return world.events
      .filter(event => this.isRelevantEvent(event))
      .map(event => ({
        event,
        score: this.calculateSocialScore(event, followedAgents, world)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
  }

  /**
   * 混合推荐结果
   */
  private mergeRecommendations(
    interestBased: Array<{ event: WorldEvent; score: number }>,
    hotBased: Array<{ event: WorldEvent; score: number }>,
    socialBased: Array<{ event: WorldEvent; score: number }>
  ): WorldEvent[] {
    const { topK, interestWeight, hotWeight, socialWeight } = this.config

    // 创建事件 ID 到综合分数的映射
    const scoreMap = new Map<string, number>()

    // 合并分数
    for (const { event, score } of interestBased) {
      scoreMap.set(event.id, (scoreMap.get(event.id) || 0) + score * interestWeight)
    }

    for (const { event, score } of hotBased) {
      scoreMap.set(event.id, (scoreMap.get(event.id) || 0) + score * hotWeight)
    }

    for (const { event, score } of socialBased) {
      scoreMap.set(event.id, (scoreMap.get(event.id) || 0) + score * socialWeight)
    }

    // 获取所有唯一事件
    const allEvents = new Map<string, WorldEvent>()
    for (const { event } of [...interestBased, ...hotBased, ...socialBased]) {
      allEvents.set(event.id, event)
    }

    // 按综合分数排序并返回 topK
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, _]) => allEvents.get(id)!)
      .filter(event => event !== undefined)
  }

  /**
   * 计算 agent 的兴趣向量
   */
  private computeInterestVector(agent: PersonalAgentState): string[] {
    const interests: string[] = []

    // 从职业提取兴趣
    if (agent.occupation) {
      interests.push(agent.occupation)
    }

    // 从专长提取兴趣
    if (agent.expertise) {
      interests.push(...agent.expertise)
    }

    // 从目标提取兴趣
    interests.push(...agent.goals.slice(0, 3))

    // 从核心信念提取兴趣
    if (agent.core_belief) {
      interests.push(agent.core_belief)
    }

    return interests
  }

  /**
   * 计算兴趣分数（简单的关键词匹配）
   */
  private calculateInterestScore(interests: string[], event: WorldEvent): number {
    const eventText = this.getEventText(event).toLowerCase()
    
    let matchCount = 0
    for (const interest of interests) {
      if (eventText.includes(interest.toLowerCase())) {
        matchCount++
      }
    }

    return matchCount / Math.max(interests.length, 1)
  }

  /**
   * 计算热度分数
   * 参考 Reddit 的热度算法
   */
  private calculateHotScore(event: WorldEvent, currentTick: number): number {
    // 事件没有 tick 字段，使用 timestamp 计算时间差
    const eventTime = new Date(event.timestamp).getTime()
    const currentTime = Date.now()
    const hoursSinceEvent = (currentTime - eventTime) / (1000 * 60 * 60)
    
    // 时间衰减：越新的事件分数越高
    const recency = Math.log10(Math.max(1, 271.8 - hoursSinceEvent))

    // 事件重要性
    const importance = this.getEventImportance(event.type)

    // 综合分数
    return importance * Math.max(0, recency)
  }

  /**
   * 计算社交分数
   */
  private calculateSocialScore(
    event: WorldEvent,
    followedAgents: string[],
    world: WorldSlice
  ): number {
    // 检查事件是否与关注的人相关
    const eventText = this.getEventText(event)
    
    for (const followedName of followedAgents) {
      if (eventText.includes(followedName)) {
        return 1.0
      }
    }

    // 检查事件的 payload 中是否有相关 agent
    if (event.payload) {
      const agentSeed = event.payload.agent_seed as string | undefined
      if (agentSeed) {
        const agent = world.agents.npcs.find(a => a.genetics.seed === agentSeed)
        if (agent && followedAgents.includes(agent.identity.name)) {
          return 1.0
        }
      }
    }

    return 0
  }

  /**
   * 获取事件的文本表示
   */
  private getEventText(event: WorldEvent): string {
    const parts: string[] = [event.type]

    if (event.payload) {
      if (event.payload.summary) {
        parts.push(String(event.payload.summary))
      }
      if (event.payload.message) {
        parts.push(String(event.payload.message))
      }
      if (event.payload.plot_title) {
        parts.push(String(event.payload.plot_title))
      }
      if (event.payload.agent_name) {
        parts.push(String(event.payload.agent_name))
      }
    }

    return parts.join(' ')
  }

  /**
   * 判断事件是否相关（过滤掉系统事件）
   */
  private isRelevantEvent(event: WorldEvent): boolean {
    // 过滤掉纯系统事件
    const systemEvents = ['tick']
    return !systemEvents.includes(event.type)
  }

  /**
   * 获取事件类型的重要性权重
   */
  private getEventImportance(eventType: string): number {
    const importanceMap: Record<string, number> = {
      // 剧情相关 - 最重要
      'plot_triggered': 1.0,
      'plot_completed': 1.0,
      'plot_failed': 0.9,
      'plot_stage_completed': 0.8,
      
      // 生死相关 - 很重要
      'agent_death': 0.9,
      'agent_reincarnation': 0.8,
      
      // 世界创建 - 重要
      'world_created': 0.7,
      'agents_created': 0.7,
      'plot_created': 0.7,
      
      // Agent 行动 - 一般
      'micro': 0.4,
      'macro': 0.6,
      
      // 用户消息 - 一般
      'user_message': 0.5,
      
      // 默认
      'default': 0.3,
    }

    return importanceMap[eventType] || importanceMap['default']
  }
}

/**
 * 创建推荐系统实例
 */
export function createRecommendationSystem(
  config?: Partial<RecommendationConfig>
): RecommendationSystem {
  return new RecommendationSystem({
    ...DEFAULT_REC_CONFIG,
    ...config,
  })
}
