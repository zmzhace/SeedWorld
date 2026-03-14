/**
 * 涌现式叙事系统 - 类型定义
 * 从 agents 互动中识别和追踪叙事模式
 */

export type NarrativeType = 
  | 'conflict'        // 冲突：agents 之间的对抗
  | 'alliance'        // 联盟：agents 形成合作
  | 'romance'         // 浪漫：agents 之间的情感关系
  | 'betrayal'        // 背叛：信任关系的破裂
  | 'discovery'       // 发现：揭示重要信息
  | 'transformation'  // 转变：agent 的重大改变
  | 'quest'           // 探索：追求目标的旅程
  | 'mystery'         // 谜团：未解之谜
  | 'tragedy'         // 悲剧：不可避免的失败
  | 'triumph'         // 胜利：克服困难的成功

export type NarrativeStatus = 
  | 'emerging'    // 刚刚出现
  | 'developing'  // 发展中
  | 'climax'      // 高潮
  | 'resolving'   // 解决中
  | 'concluded'   // 已结束
  | 'dormant'     // 休眠（暂时停止）

export type NarrativePattern = {
  id: string
  type: NarrativeType
  participants: string[]  // agent IDs
  event_ids: string[]     // 相关事件 IDs
  
  // 叙事强度和情感
  intensity: number       // 叙事强度 [0-1]
  emotional_arc: number[] // 情感曲线（每个事件的情感值）
  sentiment: number       // 整体情感倾向 [-1, 1]
  
  // 时序信息
  started_at: number      // 开始 tick
  updated_at: number      // 最后更新 tick
  status: NarrativeStatus
  
  // 叙事元素
  catalyst?: string       // 催化事件
  turning_points: string[] // 转折点事件 IDs
  resolution?: string     // 解决事件
  
  // 元数据
  tags: string[]          // 标签（如 "revenge", "redemption"）
  confidence: number      // 识别置信度 [0-1]
}

export type StoryArcStage = 
  | 'setup'       // 铺垫：介绍角色和背景
  | 'rising'      // 上升：冲突逐渐升级
  | 'climax'      // 高潮：冲突达到顶点
  | 'falling'     // 下降：冲突开始解决
  | 'resolution'  // 解决：故事结束

export type StoryArc = {
  id: string
  type: 'main' | 'subplot'  // 主线或支线
  title: string             // 故事弧标题（自动生成）
  
  // 故事结构
  structure: {
    setup: NarrativePattern[]
    rising: NarrativePattern[]
    climax: NarrativePattern[]
    falling: NarrativePattern[]
    resolution: NarrativePattern[]
  }
  
  // 参与者
  protagonists: string[]    // 主角
  antagonists: string[]     // 对手
  supporting: string[]      // 配角
  
  // 情感和节奏
  emotional_curve: number[] // 整体情感曲线
  pacing: number[]          // 节奏（事件密度）
  
  // 状态
  current_stage: StoryArcStage
  status: NarrativeStatus
  completeness: number      // 完整度 [0-1]
  
  // 时序
  started_at: number
  updated_at: number
  concluded_at?: number
}

export type NarrativeSummary = {
  id: string
  title: string
  content: string           // 叙事总结文本
  
  // 覆盖范围
  tick_range: [number, number]  // [start, end]
  patterns: string[]        // 包含的叙事模式 IDs
  arcs: string[]            // 包含的故事弧 IDs
  
  // 风格
  perspective: 'omniscient' | 'character' | 'observer'  // 叙事视角
  character_pov?: string    // 如果是角色视角，指定角色 ID
  
  // 元数据
  word_count: number
  generated_at: number
  version: number
}

export type NarrativeRole = {
  role: 'protagonist' | 'antagonist' | 'supporting' | 'observer' | 'catalyst'
  involvement: number   // 参与度 [0-1]
  impact: number        // 影响力 [0-1]
  arc_contribution: number  // 对故事弧的贡献 [0-1]
}

export type NarrativeSystem = {
  patterns: NarrativePattern[]
  arcs: StoryArc[]
  summaries: NarrativeSummary[]
  
  // 统计信息
  stats: {
    total_patterns: number
    active_patterns: number
    concluded_patterns: number
    total_arcs: number
    completed_arcs: number
  }
}

/**
 * 叙事事件 - 用于叙事识别的事件表示
 */
export type NarrativeEvent = {
  id: string
  type: string
  timestamp: string
  tick: number
  
  // 参与者
  agents: string[]          // 涉及的 agent IDs
  
  // 情感分析
  sentiment: number         // 情感值 [-1, 1]
  emotional_intensity: number  // 情感强度 [0-1]
  
  // 内容
  description: string
  tags: string[]
  
  // 关系
  affects_relationships: Array<{
    agent1: string
    agent2: string
    change: number  // 关系变化 [-1, 1]
  }>
}

/**
 * 叙事模式匹配规则
 */
export type NarrativePatternRule = {
  type: NarrativeType
  
  // 匹配条件
  min_events: number        // 最少事件数
  min_participants: number  // 最少参与者数
  
  // 特征检测
  features: {
    sentiment_pattern?: 'opposing' | 'aligned' | 'mixed'
    relationship_trend?: 'strengthening' | 'weakening' | 'volatile'
    emotional_intensity?: 'high' | 'medium' | 'low'
    temporal_pattern?: 'continuous' | 'episodic' | 'escalating'
  }
  
  // 权重
  confidence_threshold: number  // 最低置信度
}
