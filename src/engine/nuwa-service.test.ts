import { describe, it, expect } from 'vitest'
import { createNuwaService } from './nuwa-service'

it('emits a new_agent event for Pangu', () => {
  const events: unknown[] = []
  const service = createNuwaService({
    emit: (event) => events.push(event),
  })

  service.createAgent({ seed: 's1', environment: { region: 'coastal', social_state: 'stable' } })

  expect(events[0]).toMatchObject({
    type: 'new_agent',
  })
})
