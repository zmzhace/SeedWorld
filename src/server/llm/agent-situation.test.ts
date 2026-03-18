import { describe, expect, it, vi } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = {
      create: async () => ({ content: [{ type: 'text', text: 'summary' }] }),
    }
  }
}))

import { buildAgentPrompt } from './agent-decision-llm'
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

describe('buildAgentPrompt', () => {
  it('keeps prompt order as desire, scene, pressure, identity, people, memory, world', () => {
    const world = createInitialWorldSlice()
    const agent = {
      ...world.agents.personal,
      location: 'well',
    }
    const profile = {
      generated_at_tick: 1,
      wave: 1,
      dominantPressures: [{ kind: 'resource_scarcity', weight: 0.9, summary: 'Water access is narrowing around the well.', evidence: ['resources:water'] }],
      powerBasis: [{ kind: 'access_control', weight: 0.8, summary: 'Access control shapes who can draw water first.', evidence: ['location:well'] }],
      distributionPattern: [{ kind: 'gatekeeping', weight: 0.7, summary: 'Access narrows through informal gatekeeping.', evidence: ['environment'] }],
      legitimacyBasis: [],
      faultLines: [],
      volatileZones: [],
      evidenceTrace: ['resources:water'],
    }

    const prompt = buildAgentPrompt(agent, {
      ...world,
      systems: {
        ...world.systems,
        world_pressure_profile: profile,
        situation_snapshot: {
          generated_at_tick: 1,
          wave: 1,
          summaryByAgent: {
            [agent.genetics.seed]: ['Water access is narrowing around the well.'],
          },
        },
      },
    })

    expect(prompt.indexOf('## Desire')).toBeLessThan(prompt.indexOf('## Scene'))
    expect(prompt.indexOf('## Scene')).toBeLessThan(prompt.indexOf('## Immediate Situation'))
    expect(prompt.indexOf('## Immediate Situation')).toBeLessThan(prompt.indexOf('## Identity'))
    expect(prompt.indexOf('## Identity')).toBeLessThan(prompt.indexOf('## People Around You'))
  })

  it('does not throw when world pressure only contains unsupported inferred items', () => {
    const world = createInitialWorldSlice()
    world.environment.description = 'A rigid court where rank determines what claims are legitimate.'
    const agent = {
      ...world.agents.personal,
      location: 'court',
    }

    expect(() => buildAgentPrompt(agent, {
      ...world,
      systems: {
        ...world.systems,
        world_pressure_profile: {
          generated_at_tick: 1,
          wave: 1,
          dominantPressures: [],
          powerBasis: [{
            kind: 'social_influence',
            weight: 0.9,
            summary: 'Standing and recognition still matter, but less than control of access.',
            evidence: [],
          }],
          distributionPattern: [{
            kind: 'open_access',
            weight: 0.7,
            summary: 'Access remains comparatively open.',
            evidence: [],
          }],
          legitimacyBasis: [{
            kind: 'status_authority',
            weight: 1,
            summary: 'Recognized rank and formal standing are helping determine what claims hold.',
            evidence: [],
          }],
          faultLines: [{
            kind: 'status_hierarchy',
            weight: 0.8,
            summary: 'Hierarchy is creating a parallel social fault line.',
            evidence: [],
          }],
          volatileZones: [],
          evidenceTrace: [],
        },
      },
    })).not.toThrow()
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

  it('ignores unsupported pressure items when at least one evidenced item exists', () => {
    const lines = renderSituationPressure({
      ...baseSituation,
      leverage: [{
        kind: 'social_influence',
        weight: 0.95,
        summary: 'Standing and recognition still matter, but less than control of access.',
        evidence: [],
      }],
      inactionCost: [{
        kind: 'resource_scarcity',
        weight: 0.8,
        summary: 'If access keeps narrowing, your share may shrink further.',
        evidence: ['resources:water'],
      }],
    })

    expect(lines).toEqual(['If access keeps narrowing, your share may shrink further.'])
  })
})
