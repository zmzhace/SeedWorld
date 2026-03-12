import { describe, it, expect } from 'vitest'
import { registerPanguAgent, getPanguRegistry } from './pangu'

it('registers an agent for the next tick', async () => {
  registerPanguAgent({ id: 'hot-1', role: 'tick', run: () => ({ timeDelta: 1 }) })

  const registry = getPanguRegistry()
  const agents = registry.list()

  expect(agents.find((a) => a.id === 'hot-1')).toBeDefined()
})
