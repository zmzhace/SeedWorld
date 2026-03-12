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
