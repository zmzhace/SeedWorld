import { describe, it, expect } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import { runWorldTick } from './orchestrator'

it('can trigger Nuwa and surface new_agent events', async () => {
  const world = createInitialWorldSlice()
  const next = await runWorldTick(world, {
    nuwa: { trigger: 'event', seed: 's1', environment: { region: 'coastal', social_state: 'stable' } },
  })

  expect(next.events.find((event) => event.type === 'new_agent')).toBeDefined()
})
