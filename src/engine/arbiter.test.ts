import { describe, it, expect } from 'vitest'
import { arbitratePatches } from './arbiter'

it('merges patches with conflict rules', () => {
  const finalPatch = arbitratePatches([
    { agentId: 'a', patch: { timeDelta: 1, events: [{ id: 'e1', kind: 'macro', summary: 'storm' }] } },
    { agentId: 'b', patch: { timeDelta: 2, events: [{ id: 'e1', kind: 'macro', summary: 'storm v2' }] } },
  ])

  expect(finalPatch.timeDelta).toBe(2)
  expect(finalPatch.events.length).toBe(1)
  expect(finalPatch.events[0].conflict).toBe(true)
})
