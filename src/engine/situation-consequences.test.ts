import { describe, expect, it } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import type { SituationConsequence, SituationConsequenceKind } from './situation-consequences'
import {
  applySituationConsequences,
  deriveSituationSnapshot,
  routeSituationConsequences,
} from './situation-consequences'

type OwnerKey = 'resources' | 'reputation' | 'tension' | 'memes' | 'graph'

const CANONICAL_CASES: Array<{ kind: SituationConsequenceKind; owner: OwnerKey; summary: string }> = [
  { kind: 'access_shift', owner: 'resources', summary: 'Control of the well queue shifts toward B.' },
  { kind: 'scarcity_shift', owner: 'resources', summary: 'Food reserves are thinning across the district.' },
  { kind: 'distribution_shift', owner: 'resources', summary: 'Supply delivery now favors the north gate.' },
  { kind: 'legitimacy_shift', owner: 'reputation', summary: 'A now appears more entitled to speak for the group.' },
  { kind: 'status_shift', owner: 'reputation', summary: 'B is being treated as higher status in the market.' },
  { kind: 'dismissibility_shift', owner: 'reputation', summary: 'A is easier to brush aside in public bargaining.' },
  { kind: 'influence_shift', owner: 'reputation', summary: 'B can sway more onlookers during disputes.' },
  { kind: 'hotspot_shift', owner: 'tension', summary: 'The well square is becoming a local flashpoint.' },
  { kind: 'escalation_shift', owner: 'tension', summary: 'This rivalry is becoming easier to ignite.' },
  { kind: 'norm_shift', owner: 'memes', summary: 'Queue-cutting is becoming more tolerated nearby.' },
  { kind: 'belief_shift', owner: 'memes', summary: 'More people believe the well is being rigged.' },
  { kind: 'expectation_shift', owner: 'memes', summary: 'People increasingly expect favors before sharing water.' },
  { kind: 'dependency_shift', owner: 'graph', summary: 'A now depends on B for water access.' },
  { kind: 'alignment_shift', owner: 'graph', summary: 'A and B are acting in closer coordination.' },
  { kind: 'challenge_shift', owner: 'graph', summary: 'A is more openly contesting B’s position.' },
  { kind: 'blocked_by_shift', owner: 'graph', summary: 'A’s path is now constrained by B’s control of the gate.' },
]

function buildConsequence(kind: SituationConsequenceKind, summary: string): SituationConsequence {
  return {
    kind,
    summary,
    strength: 0.5,
  }
}

describe('routeSituationConsequences', () => {
  it('routes each consequence kind to its canonical owner', () => {
    const consequences = CANONICAL_CASES.map(({ kind, summary }) => buildConsequence(kind, summary))
    const routed = routeSituationConsequences(consequences)

    expect(routed.resources.map((item) => item.kind)).toEqual(['access_shift', 'scarcity_shift', 'distribution_shift'])
    expect(routed.reputation.map((item) => item.kind)).toEqual([
      'legitimacy_shift',
      'status_shift',
      'dismissibility_shift',
      'influence_shift',
    ])
    expect(routed.tension.map((item) => item.kind)).toEqual(['hotspot_shift', 'escalation_shift'])
    expect(routed.memes.map((item) => item.kind)).toEqual(['norm_shift', 'belief_shift', 'expectation_shift'])
    expect(routed.graph.map((item) => item.kind)).toEqual([
      'dependency_shift',
      'alignment_shift',
      'challenge_shift',
      'blocked_by_shift',
    ])
  })

  it('covers every declared kind with exactly one canonical owner', () => {
    const consequences = CANONICAL_CASES.map(({ kind, summary }) => buildConsequence(kind, summary))
    const routed = routeSituationConsequences(consequences)
    const owners: OwnerKey[] = ['resources', 'reputation', 'tension', 'memes', 'graph']

    const ownershipCount = new Map<SituationConsequenceKind, number>()

    for (const owner of owners) {
      for (const item of routed[owner]) {
        ownershipCount.set(item.kind, (ownershipCount.get(item.kind) ?? 0) + 1)
      }
    }

    expect(CANONICAL_CASES).toHaveLength(16)
    expect(new Set(CANONICAL_CASES.map(({ kind }) => kind)).size).toBe(CANONICAL_CASES.length)

    for (const { kind } of CANONICAL_CASES) {
      expect(ownershipCount.get(kind)).toBe(1)
    }
  })
})

describe('applySituationConsequences', () => {
  it('writes canonical resource ownership back into the world snapshot', () => {
    const world = createInitialWorldSlice()
    world.systems.resources = {
      resources: {
        water: {
          id: 'water',
          kind: 'material',
          name: 'Water',
          type: 'material',
          amount: 4,
          max_amount: 10,
          regen_rate: 0,
          scarcity: 0.2,
          value: 0.6,
          location: 'square',
          owners: [],
          competitors: [],
          properties: {},
        },
      },
    }

    const routed = applySituationConsequences({
      world,
      consequences: [
        {
          kind: 'access_shift',
          summary: 'Watcher now controls the water line in the square.',
          strength: 0.9,
          sourceAgentId: 'npc-1',
          resourceId: 'water',
        },
      ],
    })

    expect(routed.resources).toHaveLength(1)
    expect(world.systems.resources.resources.water.owners).toEqual(['npc-1'])
  })
})

describe('deriveSituationSnapshot', () => {
  it('derives per-agent summaries without becoming canonical state', () => {
    const snapshot = deriveSituationSnapshot({
      tick: 3,
      wave: 2,
      consequences: [
        {
          kind: 'dependency_shift',
          sourceAgentId: 'a',
          targetAgentId: 'b',
          summary: 'A now depends on B for water access',
          strength: 0.8,
        },
      ],
    })

    expect(snapshot.generated_at_tick).toBe(3)
    expect(snapshot.wave).toBe(2)
    expect(snapshot.summaryByAgent.a[0]).toContain('depends on B')
    expect(snapshot.summaryByAgent.b[0]).toContain('depends on B')
  })

  it('adds a self-targeted consequence summary only once', () => {
    const snapshot = deriveSituationSnapshot({
      tick: 4,
      wave: 1,
      consequences: [
        {
          kind: 'challenge_shift',
          sourceAgentId: 'a',
          targetAgentId: 'a',
          summary: 'A is publicly challenging their own prior position',
          strength: 0.6,
        },
      ],
    })

    expect(snapshot.summaryByAgent.a).toEqual(['A is publicly challenging their own prior position'])
  })
})
