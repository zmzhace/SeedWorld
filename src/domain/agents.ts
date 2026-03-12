import type { PersonalAgentState } from './world'

export type AgentRole = 'tick' | 'macro' | 'rules' | 'other'

export type AgentEvent = {
  id: string
  kind: 'macro' | 'micro'
  summary: string
  conflict?: boolean
}

export type RuleDelta = {
  key: string
  value: string
}

export type AgentPatch = {
  timeDelta?: number
  events?: AgentEvent[]
  rulesDelta?: RuleDelta[]
  notes?: string[]
  meta?: Record<string, unknown>
}

export type PanguAgent = {
  id: string
  role: AgentRole
  run: (world: unknown) => Promise<AgentPatch> | AgentPatch
}

export const createPatch = (patch: AgentPatch): Required<AgentPatch> => ({
  timeDelta: patch.timeDelta ?? 0,
  events: patch.events ?? [],
  rulesDelta: patch.rulesDelta ?? [],
  notes: patch.notes ?? [],
  meta: patch.meta ?? {},
})

export function createPersonalAgent(seed: string): PersonalAgentState {
  return {
    kind: 'personal',
    genetics: { seed },
    identity: { name: seed },
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
  }
}
