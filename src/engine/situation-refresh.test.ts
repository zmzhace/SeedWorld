import { describe, expect, it } from 'vitest'
import {
  detectMaterialSituationChanges,
  shouldRefreshWorldPressureProfile,
} from './situation-refresh'

describe('detectMaterialSituationChanges', () => {
  it('detects access, legitimacy, scarcity, and hotspot changes from first-wave effects', () => {
    const result = detectMaterialSituationChanges({
      events: [
        { kind: 'resource_claim', conflict: true, summary: 'B takes control of the well queue' },
        { kind: 'social_shift', summary: 'A is publicly dismissed by witnesses' },
      ],
      systemFeedback: {
        resource_action: { type: 'claim', resource_id: 'water' },
        reputation_change: { target_agent_id: 'a', impact: { status: -0.2 } },
      },
    })

    expect(result.changedAccess).toBe(true)
    expect(result.changedLegitimacy).toBe(true)
    expect(result.changedScarcity).toBe(true)
    expect(result.changedHotspots).toBe(true)
  })

  it('returns false for all change flags when first-wave outcomes stay structurally neutral', () => {
    const result = detectMaterialSituationChanges({
      events: [
        { kind: 'observation', summary: 'A watches the square in silence' },
      ],
      systemFeedback: {},
    })

    expect(result).toEqual({
      changedAccess: false,
      changedLegitimacy: false,
      changedScarcity: false,
      changedHotspots: false,
    })
  })
})

describe('shouldRefreshWorldPressureProfile', () => {
  it('refreshes only when detected changes materially affect pressure structure', () => {
    expect(shouldRefreshWorldPressureProfile({
      changedAccess: true,
      changedLegitimacy: false,
      changedScarcity: false,
      changedHotspots: false,
    })).toBe(true)

    expect(shouldRefreshWorldPressureProfile({
      changedAccess: false,
      changedLegitimacy: false,
      changedScarcity: false,
      changedHotspots: false,
    })).toBe(false)
  })
})
