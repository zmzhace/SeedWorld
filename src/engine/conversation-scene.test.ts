import { describe, it, expect } from 'vitest'
import { computePairPressure, selectConversationPairs } from './conversation-scene'
import type { PersonalAgentState, WorldSlice } from '../domain/world'
import { createPersonalAgent } from '../domain/agents'

function makeAgent(seed: string, overrides?: Partial<PersonalAgentState>): PersonalAgentState {
  return { ...createPersonalAgent(seed), ...overrides } as PersonalAgentState
}

describe('computePairPressure', () => {
  it('returns zero pressure for unrelated agents', () => {
    const a = makeAgent('a')
    const b = makeAgent('b')
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBe(0)
  })

  it('returns high pressure for strong negative relationship', () => {
    const a = makeAgent('a', { relations: { b: -0.8 } })
    const b = makeAgent('b', { relations: { a: -0.6 } })
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBeGreaterThan(0)
    expect(result.type).toBe('relationship')
  })

  it('returns high pressure for strong positive relationship', () => {
    const a = makeAgent('a', { relations: { b: 0.9 } })
    const b = makeAgent('b', { relations: { a: 0.85 } })
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBeGreaterThan(0)
    expect(result.type).toBe('relationship')
  })

  it('picks the highest pressure signal as the trigger type', () => {
    const a = makeAgent('a', {
      relations: { b: -0.9 },
      narrative_roles: { 'n1': { role: 'protagonist', involvement: 0.8, impact: 0.7 } },
    })
    const b = makeAgent('b', {
      relations: { a: -0.7 },
      narrative_roles: { 'n1': { role: 'antagonist', involvement: 0.9, impact: 0.8 } },
    })
    const world = {
      narratives: {
        patterns: [
          { id: 'n1', participants: ['a', 'b'], status: 'climax', intensity: 0.9, type: 'conflict' },
        ],
      },
    } as unknown as WorldSlice
    const result = computePairPressure(a, b, world)
    expect(result.pressure_score).toBeGreaterThan(0)
    expect(['relationship', 'narrative']).toContain(result.type)
  })
})

describe('selectConversationPairs', () => {
  const THRESHOLD = 0.4

  it('returns no pairs when agents are unrelated', () => {
    const agents = [makeAgent('a'), makeAgent('b'), makeAgent('c')]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    expect(pairs).toHaveLength(0)
  })

  it('returns pairs above threshold', () => {
    const agents = [
      makeAgent('a', { relations: { b: -0.9 } }),
      makeAgent('b', { relations: { a: -0.8 } }),
      makeAgent('c'),
    ]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    expect(pairs.length).toBeGreaterThanOrEqual(1)
    expect(pairs[0].participants).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('does not let an agent appear in multiple pairs', () => {
    const agents = [
      makeAgent('a', { relations: { b: -0.9, c: -0.85 } }),
      makeAgent('b', { relations: { a: -0.8 } }),
      makeAgent('c', { relations: { a: -0.7 } }),
    ]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    const allParticipants = pairs.flatMap(p => p.participants)
    const unique = new Set(allParticipants)
    expect(unique.size).toBe(allParticipants.length)
  })
})
