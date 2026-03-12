import { describe, it, expect } from 'vitest'
import { createInitialWorldSlice } from '../domain/world'
import { createAgentRegistry } from './agent-registry'
import { runWorldTick } from './orchestrator'

it('runs registered agents and applies arbiter patch', async () => {
  const registry = createAgentRegistry()
  registry.register({ id: 'tick-1', role: 'tick', run: () => ({ timeDelta: 1 }) })
  registry.register({
    id: 'macro-1',
    role: 'macro',
    run: () => ({ events: [{ id: 'e1', kind: 'macro', summary: 'storm' }] }),
  })

  const world = createInitialWorldSlice()
  const next = await runWorldTick(world, { panguRegistry: registry })

  expect(next.tick).toBeGreaterThan(world.tick)
  expect(next.events.find((e) => e.id === 'e1')).toBeDefined()
})
