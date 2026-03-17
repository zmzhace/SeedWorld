import { describe, expect, it } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import { compileAgentSituation } from './agent-situation'

describe('compileAgentSituation', () => {
  it('prioritizes dependency and inaction cost from local state', () => {
    const world = createInitialWorldSlice()
    const agent = {
      ...world.agents.personal,
      location: 'well',
      vitals: { ...world.agents.personal.vitals, energy: 0.1 },
    }
    const profile = {
      generated_at_tick: 1,
      wave: 1,
      dominantPressures: [{ kind: 'resource_scarcity', weight: 0.9, summary: 'Water is scarce', evidence: ['resources:water'] }],
      powerBasis: [{ kind: 'access_control', weight: 0.8, summary: 'Access control matters', evidence: ['location:well'] }],
      distributionPattern: [{ kind: 'gatekeeping', weight: 0.8, summary: 'Access is controlled', evidence: ['environment'] }],
      legitimacyBasis: [],
      faultLines: [],
      volatileZones: [],
      evidenceTrace: [],
    }

    const situation = compileAgentSituation(agent, world, profile)

    expect(situation.needsPressure.length).toBeGreaterThan(0)
    expect(situation.inactionCost.length).toBeGreaterThan(0)
  })
})
