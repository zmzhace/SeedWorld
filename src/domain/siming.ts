/**
 * 司命真君系统 - 编织命运与剧情
 * 
 * 大司命：主宰寿命长短与生杀大权，编织主线剧情
 * 少司命：主宰子嗣与后代，编织支线剧情
 */

export type PlotArc = {
  id: string
  title: string
  description: string
  type: 'main' | 'side'  // 主线或支线
  status: 'pending' | 'active' | 'completed' | 'failed'
  
  // 涉及的角色
  protagonists: string[]  // 主角（agent seeds）
  antagonists: string[]   // 对手
  supporting: string[]    // 配角
  
  // 剧情阶段
  stages: PlotStage[]
  current_stage: number
  
  // 命运线
  fate_threads: FateThread[]
  
  // 触发条件和结果
  trigger_conditions?: string[]
  success_conditions?: string[]
  failure_conditions?: string[]
  
  // 时间限制
  deadline?: number  // tick 数
  created_at: number
}

export type PlotStage = {
  id: string
  name: string
  description: string
  objectives: string[]
  completed: boolean
  events: string[]  // 已发生的事件 IDs
}

export type FateThread = {
  agent_seed: string
  destiny: string  // 命运描述
  turning_points: TurningPoint[]
  outcome?: 'success' | 'failure' | 'transformation' | 'death'
}

export type TurningPoint = {
  tick: number
  event: string
  choice?: string
  consequence: string
}

export type SimingConfig = {
  // 大司命配置 - 主线剧情
  main_plot_density: number  // 0-1，主线剧情密度
  conflict_intensity: number  // 0-1，冲突强度
  fate_strictness: number     // 0-1，命运的严格程度（0=自由意志，1=宿命论）
  
  // 少司命配置 - 支线剧情
  side_plot_frequency: number  // 0-1，支线剧情频率
  relationship_focus: number   // 0-1，关系剧情的比重
  legacy_importance: number    // 0-1，传承和后代的重要性
}

export const createSimingConfig = (config: Partial<SimingConfig> = {}): SimingConfig => ({
  main_plot_density: config.main_plot_density ?? 0.7,
  conflict_intensity: config.conflict_intensity ?? 0.6,
  fate_strictness: config.fate_strictness ?? 0.5,
  side_plot_frequency: config.side_plot_frequency ?? 0.5,
  relationship_focus: config.relationship_focus ?? 0.6,
  legacy_importance: config.legacy_importance ?? 0.4,
})
