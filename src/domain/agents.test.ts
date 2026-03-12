import { describe, it, expect } from 'vitest'
import { createPatch, type AgentPatch } from './agents'

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
