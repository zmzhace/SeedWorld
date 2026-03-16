import { describe, it, expect } from 'vitest'
import type {
  ConversationScene,
  ConversationRound,
  ConversationTrigger,
  ConversationResult,
} from './conversation'

describe('conversation types', () => {
  it('can construct a ConversationScene', () => {
    const trigger: ConversationTrigger = {
      type: 'tension',
      pressure_score: 0.8,
      description: 'Unresolved conflict over stolen grain',
    }
    const round: ConversationRound = {
      speaker: 'agent-a',
      dialogue: 'You took my grain!',
      inner_monologue: 'I must confront them.',
      action: { type: 'speak', intensity: 0.7 },
      continue_conversation: true,
    }
    const scene: ConversationScene = {
      id: 'conv-1',
      location: 'marketplace',
      participants: ['agent-a', 'agent-b'],
      trigger,
      rounds: [round],
      status: 'active',
    }
    expect(scene.participants).toHaveLength(2)
    expect(scene.rounds[0].continue_conversation).toBe(true)
  })
})
