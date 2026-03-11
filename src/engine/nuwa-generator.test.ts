import { describe, it, expect } from 'vitest'
import { generateNuwaAgent } from './nuwa-generator'

it('generates a deterministic agent config from seed and environment', () => {
  const env = { region: 'mountain', social_state: 'calm' }

  const one = generateNuwaAgent({ seed: 's1', environment: env })
  const two = generateNuwaAgent({ seed: 's1', environment: env })

  expect(one).toEqual(two)
  expect(one.environment_signature.region).toBe('mountain')
})
