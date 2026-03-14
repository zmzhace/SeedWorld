import type { PlotArc } from './siming'

export type AgentKind = 'world' | 'persona' | 'personal' | 'social'

export type MemoryRecord = {
  id: string
  content: string
  importance: number
  emotional_weight: number
  source: 'self' | 'social' | 'world'
  timestamp: string
  decay_rate: number
  retrieval_strength: number
}

export type VitalsState = {
  energy: number
  stress: number
  sleep_debt: number
  focus: number
  aging_index: number
}

export type PersonaState = {
  openness: number
  stability: number
  attachment: number
  agency: number
  empathy: number
}

export type SocialContext = {
  macro_events: string[]
  narratives: string[]
  pressures: string[]
  institutions: string[]
  ambient_noise: string[]
}

export type PersonalAgentState = {
  kind: 'personal'
  role: 'protagonist' | 'supporting' | 'npc'  // 主要人物、支线人物、NPC
  genetics: {
    seed: string
  }
  identity: {
    name: string
  }
  memory_short: MemoryRecord[]
  memory_long: MemoryRecord[]
  vitals: VitalsState
  emotion: {
    label: string
    intensity: number
  }
  persona: PersonaState
  goals: string[]
  relations: Record<string, number>
  action_history: Array<{ type: string; timestamp: string }>
  
  // 后土相关 - 生死轮回
  life_status: 'alive' | 'dying' | 'dead' | 'reincarnating'
  death_tick?: number  // 死亡时的 tick
  cause_of_death?: string
  legacy?: string[]  // 遗产/影响
  
  // Agent 个性化系统 - 受 agency-agents 启发，由 LLM 动态生成
  occupation?: string  // 职业（由 LLM 根据世界背景生成）
  voice?: string  // 说话风格
  approach?: string  // 做事方式
  expertise?: string[]  // 专长领域
  core_belief?: string  // 核心信念
  success_metrics?: Record<string, number>  // 成功指标追踪（如：财富、声望、知识等）
}

export type WorldSlice = {
  world_id: string
  tick: number
  time: string
  environment: {
    description: string
  }
  social_context: SocialContext
  agents: {
    pangu: { kind: 'world'; id: string }
    nuwa: { kind: 'persona'; id: string }
    personal: PersonalAgentState
    social: { kind: 'social'; id: string }
    npcs: PersonalAgentState[]  // 女娲生成的NPC agents
  }
  plots: PlotArc[]  // 司命编织的剧情
  events: Array<{ id: string; type: string; timestamp: string; payload?: Record<string, unknown> }>
  relations: Record<string, number>
  active_hooks: string[]
}

export function createInitialWorldSlice(): WorldSlice {
  return {
    world_id: 'world-1',
    tick: 0,
    time: new Date(0).toISOString(),
    environment: { description: 'calm' },
    social_context: {
      macro_events: [],
      narratives: [],
      pressures: [],
      institutions: [],
      ambient_noise: [],
    },
    agents: {
      pangu: { kind: 'world', id: 'pangu-1' },
      nuwa: { kind: 'persona', id: 'nuwa-1' },
      personal: {
        kind: 'personal',
        genetics: { seed: 'default-user' },
        identity: { name: 'user' },
        memory_short: [],
        memory_long: [],
        vitals: {
          energy: 0.7,
          stress: 0.2,
          sleep_debt: 0.1,
          focus: 0.6,
          aging_index: 0.1,
        },
        emotion: { label: 'neutral', intensity: 0.2 },
        persona: {
          openness: 0.5,
          stability: 0.5,
          attachment: 0.5,
          agency: 0.5,
          empathy: 0.5,
        },
        goals: [],
        relations: {},
        action_history: [],
      },
      social: { kind: 'social', id: 'social-1' },
      npcs: [],  // 女娲生成的NPC agents
    },
    plots: [],  // 司命编织的剧情
    events: [],
    relations: {},
    active_hooks: [],
  }
}
