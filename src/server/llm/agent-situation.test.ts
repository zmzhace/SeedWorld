import { describe, expect, it } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import { compileAgentSituation, renderSituationPressure } from './agent-situation'

const baseSituation = {
  needsPressure: [],
  dependencyPressure: [],
  statusPressure: [],
  obstruction: [],
  leverage: [],
  exposure: [],
  opportunityWindow: [],
  inactionCost: [],
  evidenceTrace: ['resources:water'],
}

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

describe('renderSituationPressure', () => {
  it('describes pressure without imperative verbs or tactical advice', () => {
    const lines = renderSituationPressure({
      ...baseSituation,
      inactionCost: [{
        kind: 'resource_scarcity',
        weight: 0.8,
        summary: 'If access keeps narrowing, your share may shrink further.',
        evidence: ['resources:water'],
      }],
    })

    expect(lines).toContain('If access keeps narrowing, your share may shrink further.')
    expect(lines.join('\n')).not.toMatch(/you should|you must|best move|obvious response|need to seize/i)
  })

  it('rejects single-path framing even when no banned phrase appears', () => {
    expect(() => renderSituationPressure({
      ...baseSituation,
      leverage: [{
        kind: 'access_control',
        weight: 0.9,
        summary: 'Only one real path remains: align with the gatekeeper.',
        evidence: ['resources:water'],
      }],
    })).toThrow(/open affordances/i)
  })

  it('rejects invented consequences that are not backed by evidence', () => {
    expect(() => renderSituationPressure({
      ...baseSituation,
      exposure: [{
        kind: 'status_pressure',
        weight: 0.7,
        summary: 'If you wait, everyone will permanently turn against you.',
        evidence: [],
      }],
    })).toThrow(/evidence/i)
  })
})
