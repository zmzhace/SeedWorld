import type { SystemFeedback } from '../server/llm/agent-decision-llm'

export type ConversationTriggerType =
  | 'tension'
  | 'resource'
  | 'reputation'
  | 'meme'
  | 'narrative'
  | 'relationship'

export type ConversationTrigger = {
  type: ConversationTriggerType
  pressure_score: number
  description: string
}

export type ConversationRound = {
  speaker: string
  dialogue: string
  inner_monologue: string
  action: {
    type: string
    target?: string
    intensity: number
  }
  system_feedback?: SystemFeedback
  continue_conversation: boolean
}

export type ConversationScene = {
  id: string
  location: string
  participants: string[]
  trigger: ConversationTrigger
  rounds: ConversationRound[]
  status: 'active' | 'concluded'
}

export type ConversationResult = {
  scene: ConversationScene
  /** One-line summary for bystander context */
  bystander_summary: string
  /** Collected system_feedback from all rounds, to be routed after conclusion */
  accumulated_feedback: Array<{
    agentId: string
    feedback: SystemFeedback
  }>
}
