import type { NarrativeSystem } from './narrative'
import type { Reputation, ReputationDimension } from '@/engine/reputation-system'
import type { SocialRole, RoleConflict } from '@/engine/social-role-system'
import type { Resource, ResourceClaim } from '@/engine/resource-competition-system'
import type { DramaticTension, TensionEvent } from '@/engine/dramatic-tension-system'
import type { EmergentProperty } from '@/engine/emergent-property-detector'
import type { Meme, MemeTransmission } from '@/engine/meme-propagation-system'
import type { AttentionState } from '@/engine/attention-mechanism'
import type { KnowledgeNode, KnowledgeEdge } from '@/engine/knowledge-graph'

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
  
  // 时间引擎 - 参考 OASIS，模拟真实作息模式
  activity_pattern?: number[]  // 24 维，每小时的活跃概率 [0-1]
  timezone_offset?: number  // 时区偏移（小时）
  sleep_schedule?: {
    typical_sleep_hour: number  // 通常睡觉时间（0-23）
    typical_wake_hour: number   // 通常起床时间（0-23）
  }
  
  // 涌现式叙事 - 动态角色识别
  narrative_roles?: {
    [narrativeId: string]: {
      role: 'protagonist' | 'antagonist' | 'supporting' | 'observer' | 'catalyst'
      involvement: number  // 参与度 [0-1]
      impact: number       // 影响力 [0-1]
    }
  }

  // LLM Agent 决策输出 - 每 tick 更新
  last_action_description?: string  // 上一次行动的具体描述
  last_dialogue?: string            // 上一次说的话
  last_inner_monologue?: string     // 上一次内心独白
}

// ===== 系统快照类型（用于持久化） =====

export type ReputationSnapshot = {
  reputations: Record<string, Reputation>
  socialNetwork: Record<string, string[]>
}

export type SocialRoleSnapshot = {
  agentRoles: Record<string, SocialRole[]>
  roleConflicts: RoleConflict[]
}

export type ResourceSnapshot = {
  resources: Record<string, Resource>
}

export type TensionSnapshot = {
  tensions: Record<string, DramaticTension>
  events: TensionEvent[]
  tensionCounter: number
}

export type EmergenceSnapshot = {
  detectedProperties: Array<Omit<EmergentProperty, 'indicators'> & { indicators: Record<string, number> }>
  propertyCounter: number
}

export type MemeSnapshot = {
  memes: Record<string, Meme>
  transmissions: MemeTransmission[]
  memeCounter: number
}

export type AttentionSnapshot = {
  states: Record<string, Omit<AttentionState, 'attention_weights'> & { attention_weights: Record<string, number> }>
}

export type KnowledgeGraphSnapshot = {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export type SystemsState = {
  reputation?: ReputationSnapshot
  social_roles?: SocialRoleSnapshot
  resources?: ResourceSnapshot
  tension?: TensionSnapshot
  emergence?: EmergenceSnapshot
  memes?: MemeSnapshot
  attention?: AttentionSnapshot
  knowledge_graph?: KnowledgeGraphSnapshot
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
  narratives: NarrativeSystem  // 涌现式叙事系统
  events: Array<{ id: string; type: string; timestamp: string; payload?: Record<string, unknown> }>
  relations: Record<string, number>
  active_hooks: string[]
  systems: SystemsState
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
        life_status: 'alive',
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
    narratives: {
      patterns: [],
      arcs: [],
      summaries: [],
      stats: {
        total_patterns: 0,
        active_patterns: 0,
        concluded_patterns: 0,
        total_arcs: 0,
        completed_arcs: 0
      }
    },
    events: [],
    relations: {},
    active_hooks: [],
    systems: {},
  }
}
