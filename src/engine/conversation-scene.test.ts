import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computePairPressure, selectConversationPairs } from './conversation-scene'
import type { PersonalAgentState, WorldSlice } from '../domain/world'
import { createPersonalAgent } from '../domain/agents'

// Mock the LLM module (Vitest hoists vi.mock to top of file)
vi.mock('../server/llm/agent-decision-llm', () => ({
  generateConversationTurn: vi.fn(),
}))

import { generateConversationTurn } from '../server/llm/agent-decision-llm'
import { runConversationScene } from './conversation-scene'

const mockGenerate = vi.mocked(generateConversationTurn)

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

describe('runConversationScene', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
  })

  it('runs a 2-round conversation when agents continue then stop', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.7 },
        dialogue: 'You stole my grain!',
        inner_monologue: 'I must confront them.',
        behavior_description: 'confronts angrily',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.6 },
        dialogue: 'I did no such thing!',
        inner_monologue: 'How dare they accuse me.',
        behavior_description: 'denies defensively',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.4 },
        dialogue: 'Then who did?',
        inner_monologue: 'Maybe I was wrong.',
        behavior_description: 'calms down',
        continue_conversation: false,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.3 },
        dialogue: 'Let us investigate together.',
        inner_monologue: 'This could be resolved.',
        behavior_description: 'extends hand',
        continue_conversation: false,
      } as any)

    const a = makeAgent('a', { relations: { b: -0.7 } })
    const b = makeAgent('b', { relations: { a: -0.5 } })

    const result = await runConversationScene(
      [a, b],
      { type: 'relationship', pressure_score: 0.8, description: 'Hostility' },
      'marketplace',
      {} as WorldSlice,
    )

    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds).toHaveLength(4)
    expect(result.scene.rounds[0].speaker).toBeDefined()
    expect(result.bystander_summary).toBeTruthy()
  })

  it('terminates immediately when agent chooses leave action', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'leave', intensity: 0.8 },
        dialogue: 'I have nothing to say to you.',
        inner_monologue: 'Not worth my time.',
        behavior_description: 'turns away',
        continue_conversation: false,
      } as any)

    const a = makeAgent('a')
    const b = makeAgent('b')

    const result = await runConversationScene(
      [a, b],
      { type: 'tension', pressure_score: 0.6, description: 'Tension' },
      'square',
      {} as WorldSlice,
    )

    expect(result.scene.rounds).toHaveLength(1)
    expect(result.scene.status).toBe('concluded')
  })

  it('handles LLM failure gracefully', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.5 },
        dialogue: 'Hello.',
        inner_monologue: 'Thinking...',
        behavior_description: 'speaks',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce(null)

    const a = makeAgent('a')
    const b = makeAgent('b')

    const result = await runConversationScene(
      [a, b],
      { type: 'tension', pressure_score: 0.5, description: 'Tension' },
      'square',
      {} as WorldSlice,
    )

    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds.length).toBeGreaterThanOrEqual(1)
  })
})
