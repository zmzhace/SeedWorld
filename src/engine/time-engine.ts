/**
 * 时间引擎 - 管理 agents 的时间行为模式
 * 参考 OASIS 的 Time Engine 设计
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

export type TimePattern = {
  hourly_activity: number[]  // 24 维，每小时的活跃概率 [0-1]
  timezone_offset: number    // 时区偏移（小时）
  sleep_schedule: {
    typical_sleep_hour: number   // 通常睡觉时间（0-23）
    typical_wake_hour: number    // 通常起床时间（0-23）
  }
}

/**
 * 时间引擎类
 */
export class TimeEngine {
  /**
   * 判断 agent 是否应该在当前时间激活
   */
  shouldActivateAgent(agent: PersonalAgentState, currentHour: number): boolean {
    // 如果 agent 没有时间模式，默认总是激活
    if (!agent.activity_pattern || agent.activity_pattern.length !== 24) {
      return true
    }

    // 根据活跃概率决定是否激活
    const probability = agent.activity_pattern[currentHour]
    return Math.random() < probability
  }

  /**
   * 获取当前时间应该激活的 agents
   */
  getActiveAgents(agents: PersonalAgentState[], world: WorldSlice): PersonalAgentState[] {
    const currentHour = new Date(world.time).getHours()
    return agents.filter(agent => this.shouldActivateAgent(agent, currentHour))
  }

  /**
   * 为 agent 生成时间模式
   */
  generateTimePattern(agent: PersonalAgentState): TimePattern {
    // 根据 agent 的性格特征生成时间模式
    const { persona } = agent

    // 基于开放性和主动性决定作息类型
    const isNightOwl = persona.openness > 0.6 && persona.agency > 0.5
    const isEarlyBird = persona.stability > 0.6 && persona.agency > 0.6

    let sleepHour: number
    let wakeHour: number

    if (isNightOwl) {
      // 夜猫子：凌晨 2 点睡，上午 10 点起
      sleepHour = 2
      wakeHour = 10
    } else if (isEarlyBird) {
      // 早起者：晚上 10 点睡，早上 6 点起
      sleepHour = 22
      wakeHour = 6
    } else {
      // 普通作息：晚上 11 点睡，早上 7 点起
      sleepHour = 23
      wakeHour = 7
    }

    // 生成 24 小时活跃度曲线
    const hourlyActivity = this.generateActivityCurve(sleepHour, wakeHour, persona)

    return {
      hourly_activity: hourlyActivity,
      timezone_offset: 0,  // 默认时区
      sleep_schedule: {
        typical_sleep_hour: sleepHour,
        typical_wake_hour: wakeHour,
      },
    }
  }

  /**
   * 生成活跃度曲线
   */
  private generateActivityCurve(
    sleepHour: number,
    wakeHour: number,
    persona: PersonalAgentState['persona']
  ): number[] {
    const curve: number[] = new Array(24).fill(0)

    // 计算清醒时段
    const awakeHours = this.getAwakeHours(sleepHour, wakeHour)

    for (let hour = 0; hour < 24; hour++) {
      if (awakeHours.includes(hour)) {
        // 清醒时段的活跃度
        curve[hour] = this.calculateAwakeActivity(hour, wakeHour, sleepHour, persona)
      } else {
        // 睡眠时段的活跃度（很低但不为 0）
        curve[hour] = 0.05 * persona.openness  // 开放性高的人可能半夜醒来
      }
    }

    return curve
  }

  /**
   * 获取清醒时段
   */
  private getAwakeHours(sleepHour: number, wakeHour: number): number[] {
    const hours: number[] = []

    if (wakeHour < sleepHour) {
      // 正常情况：早上起床，晚上睡觉
      for (let h = wakeHour; h < sleepHour; h++) {
        hours.push(h)
      }
    } else {
      // 跨午夜：晚上睡觉，第二天早上起床
      for (let h = 0; h < sleepHour; h++) {
        hours.push(h)
      }
      for (let h = wakeHour; h < 24; h++) {
        hours.push(h)
      }
    }

    return hours
  }

  /**
   * 计算清醒时段的活跃度
   */
  private calculateAwakeActivity(
    hour: number,
    wakeHour: number,
    sleepHour: number,
    persona: PersonalAgentState['persona']
  ): number {
    // 基础活跃度由主动性决定
    const baseActivity = 0.3 + persona.agency * 0.4

    // 计算距离起床和睡觉的时间
    const hoursSinceWake = this.getHoursSince(hour, wakeHour)
    const hoursUntilSleep = this.getHoursUntil(hour, sleepHour)

    // 刚起床和快睡觉时活跃度较低
    const wakeEffect = Math.min(1, hoursSinceWake / 2)  // 起床后 2 小时达到峰值
    const sleepEffect = Math.min(1, hoursUntilSleep / 2)  // 睡前 2 小时开始下降

    // 午餐和晚餐时间活跃度较高
    const lunchBoost = hour >= 11 && hour <= 13 ? 0.2 : 0
    const dinnerBoost = hour >= 18 && hour <= 20 ? 0.2 : 0

    // 综合计算
    const activity = baseActivity * wakeEffect * sleepEffect + lunchBoost + dinnerBoost

    // 添加随机波动
    const randomFactor = 0.9 + Math.random() * 0.2

    return Math.min(1, activity * randomFactor)
  }

  /**
   * 计算从某个小时到现在经过了多少小时
   */
  private getHoursSince(currentHour: number, targetHour: number): number {
    if (currentHour >= targetHour) {
      return currentHour - targetHour
    } else {
      return 24 - targetHour + currentHour
    }
  }

  /**
   * 计算从现在到某个小时还有多少小时
   */
  private getHoursUntil(currentHour: number, targetHour: number): number {
    if (targetHour >= currentHour) {
      return targetHour - currentHour
    } else {
      return 24 - currentHour + targetHour
    }
  }

  /**
   * 为所有 agents 初始化时间模式
   */
  initializeTimePatterns(agents: PersonalAgentState[]): PersonalAgentState[] {
    return agents.map(agent => {
      // 如果已有时间模式，跳过
      if (agent.activity_pattern && agent.activity_pattern.length === 24) {
        return agent
      }

      // 生成时间模式
      const timePattern = this.generateTimePattern(agent)

      return {
        ...agent,
        activity_pattern: timePattern.hourly_activity,
        timezone_offset: timePattern.timezone_offset,
        sleep_schedule: timePattern.sleep_schedule,
      }
    })
  }

  /**
   * 获取当前时间的活跃 agent 统计
   */
  getActivityStats(world: WorldSlice): {
    total: number
    active: number
    sleeping: number
    activityRate: number
  } {
    const currentHour = new Date(world.time).getHours()
    const total = world.agents.npcs.length
    
    let active = 0
    let sleeping = 0

    for (const agent of world.agents.npcs) {
      if (this.shouldActivateAgent(agent, currentHour)) {
        active++
      } else {
        sleeping++
      }
    }

    return {
      total,
      active,
      sleeping,
      activityRate: total > 0 ? active / total : 0,
    }
  }
}

/**
 * 创建时间引擎实例
 */
export function createTimeEngine(): TimeEngine {
  return new TimeEngine()
}
