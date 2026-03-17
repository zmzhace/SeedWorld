import { describe, expect, it } from 'vitest'
import { extractWorldBiases } from './world-pressure-profile'

describe('extractWorldBiases', () => {
  it('extracts abstract world biases from environment description', () => {
    const biases = extractWorldBiases('A rigid settlement where access is controlled and essentials are scarce.')

    expect(biases.scarcityBias).toBeGreaterThan(0)
    expect(biases.statusRigidityBias).toBeGreaterThan(0)
    expect(biases.gatedAccessBias).toBeGreaterThan(0)
  })
})
