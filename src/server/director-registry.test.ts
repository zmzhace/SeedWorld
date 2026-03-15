import { describe, it, expect } from 'vitest'
import { registerDirectorAgent, getDirectorRegistry } from './director-registry'

it('registers an agent for the next tick', async () => {
  registerDirectorAgent({ id: 'hot-1', role: 'tick', run: () => ({ timeDelta: 1 }) })

  const registry = getDirectorRegistry()
  const agents = registry.list()

  expect(agents.find((a) => a.id === 'hot-1')).toBeDefined()
})
