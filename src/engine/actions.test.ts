import { describe, it, expect } from 'vitest'
import { normalizeAction } from './actions'

it('normalizes action intensity into a bounded range', () => {
  const action = normalizeAction({ type: 'search', intensity: 10 })
  expect(action.intensity).toBe(1)
})
