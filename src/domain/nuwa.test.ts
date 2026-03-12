import { describe, it, expect } from 'vitest'
import { createNuwaConfig, type NuwaAgentConfig } from './nuwa'

describe('createNuwaConfig', () => {
  it('builds a minimal agent config with required fields', () => {
    const config: NuwaAgentConfig = createNuwaConfig({
      race: 'han',
      gender: 'female',
      goals: ['survival'],
      genetics: { seed: 'g1' },
      environment_signature: { region: 'coastal' },
      traits: { openness: 0.4, stability: 0.6, attachment: 0.5, agency: 0.5, empathy: 0.7 },
    })

    expect(config.race).toBe('han')
    expect(config.gender).toBe('female')
    expect(config.goals.length).toBeGreaterThan(0)
    expect(config.environment_signature.region).toBe('coastal')
  })
})
