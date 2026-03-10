import { describe, it, expect } from 'vitest'
import { applyPersonaDrift } from './persona'

it('shifts persona slowly in response to repeated patterns', () => {
  const next = applyPersonaDrift(
    { openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 },
    [{ key: 'withdraw', count: 5 }],
  )

  expect(next).not.toEqual({ openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 })
  expect(Math.abs(next.agency - 0.5)).toBeLessThan(0.2)
})
