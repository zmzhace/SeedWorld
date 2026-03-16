import { describe, it, expect, vi } from 'vitest'
import { selectConversationPairs, runConversationScene } from './conversation-scene'
import { createPersonalAgent } from '../domain/agents'
import type { PersonalAgentState, WorldSlice } from '../domain/world'

// Mock LLM
vi.mock('../server/llm/agent-decision-llm', () => ({
  generateConversationTurn: vi.fn()
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.7 },
      dialogue: 'We need to talk about the water supply.',
      inner_monologue: 'Resources are dwindling.',
      behavior_description: 'speaks urgently',
      continue_conversation: true,
      system_feedback: { tension_effect: 'building' },
    })
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.6 },
      dialogue: 'I agree, we must act.',
      inner_monologue: 'This is serious.',
      behavior_description: 'nods gravely',
      continue_conversation: false,
      system_feedback: { reputation_impact: [{ dimension: 'competence', delta: 0.05, reason: 'showed leadership' }] },
    })
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.4 },
      dialogue: 'Then let us gather the others.',
      inner_monologue: 'Good, we are aligned.',
      behavior_description: 'stands up',
      continue_conversation: false,
    }),
}))

function makeAgent(seed: string, overrides?: Partial<PersonalAgentState>): PersonalAgentState {
  return { ...createPersonalAgent(seed), ...overrides } as PersonalAgentState
}

describe('conversation integration', () => {
  it('full flow: pressure → pair selection → conversation → feedback', async () => {
    const agentA = makeAgent('leader', { relations: { rival: -0.8 } })
    const agentB = makeAgent('rival', { relations: { leader: -0.7 } })
    const world = {} as WorldSlice

    // Step 1: Pair selection
    const pairs = selectConversationPairs([agentA, agentB], world, 0.4)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].trigger.type).toBe('relationship')

    // Step 2: Run conversation
    const result = await runConversationScene(
      pairs[0].agents,
      pairs[0].trigger,
      'village-square',
      world,
    )

    // Step 3: Verify conversation completed
    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds.length).toBeGreaterThanOrEqual(2)
    expect(result.bystander_summary).toBeTruthy()

    // Step 4: Verify feedback was collected
    expect(result.accumulated_feedback.length).toBeGreaterThanOrEqual(1)
    const tensionFeedback = result.accumulated_feedback.find(
      f => f.feedback.tension_effect,
    )
    expect(tensionFeedback).toBeDefined()
  })
})
