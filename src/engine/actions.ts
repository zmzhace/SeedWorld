import type { AgentAction } from '@/domain/actions'

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function normalizeAction(action: AgentAction): AgentAction {
  return {
    ...action,
    intensity: typeof action.intensity === 'number' ? clamp(action.intensity) : 0.5,
  }
}
