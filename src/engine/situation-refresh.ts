export type FirstWaveEffectEvent = {
  kind: string
  summary?: string
  conflict?: boolean
}

export type FirstWaveEffects = {
  events?: FirstWaveEffectEvent[]
  systemFeedback?: {
    resource_action?: {
      type?: string
      resource_id?: string
    }
    reputation_change?: {
      target_agent_id?: string
      impact?: {
        status?: number
      }
    }
  }
}

export type MaterialSituationChanges = {
  changedAccess: boolean
  changedLegitimacy: boolean
  changedScarcity: boolean
  changedHotspots: boolean
}

function detectAccessChanges(input: FirstWaveEffects): boolean {
  const hasClaimEvent = input.events?.some((event) => event.kind === 'resource_claim') ?? false
  const hasClaimFeedback = input.systemFeedback?.resource_action?.type === 'claim'

  return hasClaimEvent || hasClaimFeedback
}

function detectLegitimacyChanges(input: FirstWaveEffects): boolean {
  const hasSocialShiftEvent = input.events?.some((event) => event.kind === 'social_shift') ?? false
  const statusDelta = input.systemFeedback?.reputation_change?.impact?.status
  const hasStatusChange = typeof statusDelta === 'number' && statusDelta !== 0

  return hasSocialShiftEvent || hasStatusChange
}

function detectScarcityChanges(input: FirstWaveEffects): boolean {
  return input.events?.some((event) => event.kind === 'resource_claim' && event.conflict === true) ?? false
}

function detectHotspotChanges(input: FirstWaveEffects): boolean {
  return input.events?.some((event) => event.conflict === true) ?? false
}

export function detectMaterialSituationChanges(input: FirstWaveEffects): MaterialSituationChanges {
  return {
    changedAccess: detectAccessChanges(input),
    changedLegitimacy: detectLegitimacyChanges(input),
    changedScarcity: detectScarcityChanges(input),
    changedHotspots: detectHotspotChanges(input),
  }
}

export function shouldRefreshWorldPressureProfile(input: MaterialSituationChanges): boolean {
  return input.changedAccess || input.changedLegitimacy || input.changedScarcity || input.changedHotspots
}
