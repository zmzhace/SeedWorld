import type { PersonaState } from '@/domain/world'

type DriftSignal = { key: string; count: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function applyPersonaDrift(persona: PersonaState, signals: DriftSignal[]): PersonaState {
  const withdrawSignal = signals.find((signal) => signal.key === 'withdraw')
  const delta = withdrawSignal ? Math.min(0.05, withdrawSignal.count * 0.01) : 0

  return {
    ...persona,
    agency: clamp(persona.agency - delta),
  }
}
