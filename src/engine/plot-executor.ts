/**
 * 剧情执行器 - 让司命编织的剧情影响 agents 的行为
 */

import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import type { PlotArc, PlotStage } from '@/domain/siming'

/**
 * 检查剧情触发条件
 */
export function checkPlotTriggers(world: WorldSlice): {
  triggeredPlots: PlotArc[]
  completedPlots: PlotArc[]
  failedPlots: PlotArc[]
} {
  const triggeredPlots: PlotArc[] = []
  const completedPlots: PlotArc[] = []
  const failedPlots: PlotArc[] = []

  for (const plot of world.plots) {
    // 跳过已完成或失败的剧情
    if (plot.status === 'completed' || plot.status === 'failed') {
      continue
    }

    // 检查触发条件（pending -> active）
    if (plot.status === 'pending' && plot.trigger_conditions) {
      const triggered = plot.trigger_conditions.every(condition =>
        evaluateCondition(condition, world)
      )
      if (triggered) {
        triggeredPlots.push(plot)
      }
    }

    // 检查成功条件
    if (plot.status === 'active' && plot.success_conditions) {
      const succeeded = plot.success_conditions.every(condition =>
        evaluateCondition(condition, world)
      )
      if (succeeded) {
        completedPlots.push(plot)
      }
    }

    // 检查失败条件
    if (plot.status === 'active' && plot.failure_conditions) {
      const failed = plot.failure_conditions.some(condition =>
        evaluateCondition(condition, world)
      )
      if (failed) {
        failedPlots.push(plot)
      }
    }

    // 检查超时
    if (plot.status === 'active' && plot.deadline && world.tick > plot.deadline) {
      failedPlots.push(plot)
    }
  }

  return { triggeredPlots, completedPlots, failedPlots }
}

/**
 * 简单的条件评估
 */
function evaluateCondition(condition: string, world: WorldSlice): boolean {
  // 简单的关键词匹配
  // 未来可以扩展为更复杂的表达式解析
  
  // 检查 tick 条件
  if (condition.includes('tick >')) {
    const match = condition.match(/tick > (\d+)/)
    if (match) {
      return world.tick > parseInt(match[1])
    }
  }

  // 检查 agent 存活
  if (condition.includes('agent alive')) {
    const match = condition.match(/agent alive: (.+)/)
    if (match) {
      const agentSeed = match[1].trim()
      return world.agents.npcs.some(a => 
        a.genetics.seed === agentSeed && a.life_status === 'alive'
      )
    }
  }

  // 检查 agent 死亡
  if (condition.includes('agent dead')) {
    const match = condition.match(/agent dead: (.+)/)
    if (match) {
      const agentSeed = match[1].trim()
      return world.agents.npcs.some(a => 
        a.genetics.seed === agentSeed && a.life_status === 'dead'
      )
    }
  }

  // 默认返回 false
  return false
}

/**
 * 获取当前活跃剧情的影响
 */
export function getActivePlotInfluence(world: WorldSlice): {
  agentGoals: Map<string, string[]>  // agent seed -> 剧情相关目标
  agentPressures: Map<string, number>  // agent seed -> 压力修正
} {
  const agentGoals = new Map<string, string[]>()
  const agentPressures = new Map<string, number>()

  for (const plot of world.plots) {
    if (plot.status !== 'active') continue

    // 获取当前阶段
    const currentStage = plot.stages[plot.current_stage]
    if (!currentStage || currentStage.completed) continue

    // 为主角添加剧情目标
    for (const protagonistSeed of plot.protagonists) {
      const existingGoals = agentGoals.get(protagonistSeed) || []
      const stageObjectives = currentStage.objectives.filter(obj => 
        !existingGoals.includes(obj)
      )
      if (stageObjectives.length > 0) {
        agentGoals.set(protagonistSeed, [...existingGoals, ...stageObjectives])
      }
      
      // 主角承受剧情压力
      agentPressures.set(protagonistSeed, (agentPressures.get(protagonistSeed) || 0) + 0.1)
    }

    // 为对手添加对抗目标
    for (const antagonistSeed of plot.antagonists) {
      const existingGoals = agentGoals.get(antagonistSeed) || []
      const antagonistGoal = `阻止: ${currentStage.objectives[0] || '主角的计划'}`
      if (!existingGoals.includes(antagonistGoal)) {
        agentGoals.set(antagonistSeed, [...existingGoals, antagonistGoal])
      }
      
      // 对手也承受压力
      agentPressures.set(antagonistSeed, (agentPressures.get(antagonistSeed) || 0) + 0.08)
    }

    // 为配角添加支援目标
    for (const supportingSeed of plot.supporting) {
      const existingGoals = agentGoals.get(supportingSeed) || []
      const supportGoal = `协助: ${currentStage.objectives[0] || '主要任务'}`
      if (!existingGoals.includes(supportGoal)) {
        agentGoals.set(supportingSeed, [...existingGoals, supportGoal])
      }
      
      // 配角压力较小
      agentPressures.set(supportingSeed, (agentPressures.get(supportingSeed) || 0) + 0.05)
    }
  }

  return { agentGoals, agentPressures }
}

/**
 * 推进剧情阶段
 */
export function advancePlotStages(world: WorldSlice): {
  updatedPlots: PlotArc[]
  stageEvents: Array<{ plotId: string; stageName: string; completed: boolean }>
} {
  const updatedPlots: PlotArc[] = []
  const stageEvents: Array<{ plotId: string; stageName: string; completed: boolean }> = []

  for (const plot of world.plots) {
    if (plot.status !== 'active') continue

    const currentStage = plot.stages[plot.current_stage]
    if (!currentStage || currentStage.completed) continue

    // 检查阶段目标是否完成
    // 简单逻辑：如果主角完成了相关目标，阶段完成
    const protagonists = world.agents.npcs.filter(a => 
      plot.protagonists.includes(a.genetics.seed)
    )

    // 检查是否有主角的目标与阶段目标匹配
    const stageCompleted = currentStage.objectives.some(objective => {
      return protagonists.some(agent => {
        // 如果 agent 的目标列表中不再包含这个目标，说明可能完成了
        return !agent.goals.some(g => g.includes(objective))
      })
    })

    if (stageCompleted || Math.random() < 0.05) {  // 5% 概率自动推进
      // 完成当前阶段
      currentStage.completed = true
      stageEvents.push({
        plotId: plot.id,
        stageName: currentStage.name,
        completed: true,
      })

      // 推进到下一阶段
      if (plot.current_stage < plot.stages.length - 1) {
        plot.current_stage += 1
      } else {
        // 所有阶段完成，剧情完成
        plot.status = 'completed'
      }

      updatedPlots.push(plot)
    }
  }

  return { updatedPlots, stageEvents }
}

/**
 * 应用剧情影响到 agents
 */
export function applyPlotInfluenceToAgents(
  agents: PersonalAgentState[],
  world: WorldSlice
): PersonalAgentState[] {
  const { agentGoals, agentPressures } = getActivePlotInfluence(world)

  return agents.map(agent => {
    const plotGoals = agentGoals.get(agent.genetics.seed) || []
    const plotPressure = agentPressures.get(agent.genetics.seed) || 0

    if (plotGoals.length === 0 && plotPressure === 0) {
      return agent
    }

    // 添加剧情目标（如果还没有）
    const updatedGoals = [...agent.goals]
    for (const plotGoal of plotGoals) {
      if (!updatedGoals.includes(plotGoal)) {
        updatedGoals.unshift(plotGoal)  // 剧情目标优先级最高
      }
    }

    // 应用剧情压力
    const updatedVitals = {
      ...agent.vitals,
      stress: Math.min(1, agent.vitals.stress + plotPressure),
    }

    return {
      ...agent,
      goals: updatedGoals,
      vitals: updatedVitals,
    }
  })
}
