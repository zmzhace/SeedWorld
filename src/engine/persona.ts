import type { PersonaState } from '@/domain/world'

export type DriftSignal = { key: string; count: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * 根据 agent 的行动历史生成 drift signals
 */
export function generateDriftSignals(actionHistory: Array<{ type: string; timestamp: string }>): DriftSignal[] {
  // 只看最近 20 个行动
  const recent = actionHistory.slice(-20)
  const counts: Record<string, number> = {}

  for (const action of recent) {
    counts[action.type] = (counts[action.type] || 0) + 1
  }

  const signals: DriftSignal[] = []

  // 频繁避免冲突 → withdraw signal（降低 agency）
  if (counts['avoid'] && counts['avoid'] >= 3) {
    signals.push({ key: 'withdraw', count: counts['avoid'] })
  }

  // 频繁竞争 → assertive signal（提升 agency）
  if (counts['compete'] && counts['compete'] >= 3) {
    signals.push({ key: 'assertive', count: counts['compete'] })
  }

  // 频繁帮助 → empathic signal（提升 empathy）
  if (counts['help'] && counts['help'] >= 3) {
    signals.push({ key: 'empathic', count: counts['help'] })
  }

  // 频繁探索 → curious signal（提升 openness）
  if (counts['explore'] && counts['explore'] >= 2) {
    signals.push({ key: 'curious', count: counts['explore'] })
  }

  // 频繁反思 → stabilize signal（提升 stability）
  if (counts['reflect'] && counts['reflect'] >= 3) {
    signals.push({ key: 'stabilize', count: counts['reflect'] })
  }

  // 频繁互动 → social signal（提升 attachment）
  if ((counts['interact'] || 0) + (counts['socialize'] || 0) >= 3) {
    signals.push({ key: 'social', count: (counts['interact'] || 0) + (counts['socialize'] || 0) })
  }

  return signals
}

/**
 * 根据 drift signals 演化 persona
 */
export function applyPersonaDrift(persona: PersonaState, signals: DriftSignal[]): PersonaState {
  let { agency, openness, stability, attachment, empathy } = persona

  for (const signal of signals) {
    const delta = Math.min(0.05, signal.count * 0.01)

    switch (signal.key) {
      case 'withdraw':
        agency = clamp(agency - delta)
        break
      case 'assertive':
        agency = clamp(agency + delta)
        break
      case 'empathic':
        empathy = clamp(empathy + delta)
        break
      case 'curious':
        openness = clamp(openness + delta)
        break
      case 'stabilize':
        stability = clamp(stability + delta)
        break
      case 'social':
        attachment = clamp(attachment + delta)
        break
    }
  }

  return { ...persona, agency, openness, stability, attachment, empathy }
}
