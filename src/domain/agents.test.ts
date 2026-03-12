import { describe, it, expect } from 'vitest'
import { createPatch, type AgentPatch, createPersonalAgent } from './agents'

describe('createPatch', () => {
  it('returns a structured patch with defaults', () => {
    const patch: AgentPatch = createPatch({
      timeDelta: 1,
      events: [{ id: 'e1', kind: 'macro', summary: 'storm', conflict: false }],
    })

    expect(patch.timeDelta).toBe(1)
    expect(patch.events?.length).toBe(1)
    expect(patch.rulesDelta).toEqual([])
    expect(patch.notes).toEqual([])
  })
})

describe('createPersonalAgent', () => {
  it('creates a personal agent with unique seed and default state', () => {
    const agent = createPersonalAgent('curious-explorer')
    
    expect(agent.genetics.seed).toBe('curious-explorer')
    expect(agent.kind).toBe('personal')
    expect(agent.memory_short).toEqual([])
    expect(agent.memory_long).toEqual([])
    expect(agent.vitals).toBeDefined()
    expect(agent.persona).toBeDefined()
    expect(agent.action_history).toEqual([])
  })
})
