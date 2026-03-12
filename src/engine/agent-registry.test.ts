import { describe, it, expect } from 'vitest'
import { createAgentRegistry } from './agent-registry'

it('registers agents and runs them in parallel', async () => {
  const registry = createAgentRegistry()

  registry.register({ id: 'a', role: 'tick', run: async () => ({ timeDelta: 1 }) })
  registry.register({
    id: 'b',
    role: 'macro',
    run: async () => ({ events: [{ id: 'e1', kind: 'macro', summary: 'storm' }] }),
  })

  const results = await registry.runAll({})

  expect(results).toHaveLength(2)
  expect(results.map((r) => r.agentId).sort()).toEqual(['a', 'b'])
})
