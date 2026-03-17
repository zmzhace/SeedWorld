import { describe, expect, it } from 'vitest'

import { createInitialWorldSlice } from '@/domain/world'
import { buildWorldPressureProfile, extractWorldBiases } from './world-pressure-profile'

describe('extractWorldBiases', () => {
  it('extracts abstract world biases from environment description', () => {
    const biases = extractWorldBiases('A rigid settlement where access is controlled and essentials are scarce.')

    expect(biases.scarcityBias).toBeGreaterThan(0)
    expect(biases.statusRigidityBias).toBeGreaterThan(0)
    expect(biases.gatedAccessBias).toBeGreaterThan(0)
  })
})

describe('buildWorldPressureProfile', () => {
  it('ranks scarcity and gatekeeping from world systems with evidence trace', () => {
    const world = createInitialWorldSlice()
    world.environment.description = 'A rigid settlement where access is controlled and essentials are scarce.'
    world.systems.resources = {
      resources: {
        water: {
          id: 'water',
          type: 'material',
          name: 'water',
          amount: 2,
          max_amount: 20,
          regeneration_rate: 0,
          scarcity: 0.9,
          value: 0.95,
          location: 'well',
        },
      },
    }

    const profile = buildWorldPressureProfile(world, { wave: 1 })

    expect(profile.dominantPressures[0]?.kind).toBe('resource_scarcity')
    expect(profile.distributionPattern.some(item => item.kind === 'gatekeeping')).toBe(true)
    expect(profile.evidenceTrace.some(item => item.includes('resources:water'))).toBe(true)
  })

  it('changes leverage structure across different world descriptions', () => {
    const base = createInitialWorldSlice()
    base.systems.resources = {
      resources: {
        water: {
          id: 'water',
          type: 'material',
          name: 'water',
          amount: 2,
          max_amount: 20,
          regeneration_rate: 0,
          scarcity: 0.9,
          value: 0.95,
          location: 'well',
        },
      },
    }

    const survivalWorld = { ...base, environment: { description: 'A starving camp with scarce essentials.' } }
    const courtWorld = { ...base, environment: { description: 'A rigid court where rank determines what claims are legitimate.' } }

    const survivalProfile = buildWorldPressureProfile(survivalWorld, { wave: 1 })
    const courtProfile = buildWorldPressureProfile(courtWorld, { wave: 1 })

    expect(survivalProfile.dominantPressures[0]?.kind).toBe('resource_scarcity')
    expect(courtProfile.legitimacyBasis[0]?.kind).toBe('status_authority')
  })
})
