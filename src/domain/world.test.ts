import { describe, expect, it } from 'vitest'
import { createInitialWorldSlice } from './world'

describe('createInitialWorldSlice', () => {
  it('creates a single-user world with core agents and empty event history', () => {
    const world = createInitialWorldSlice()

    expect(world.tick).toBe(0)
    expect(world.agents.director.kind).toBe('world')
    expect(world.agents.creator.kind).toBe('persona')
    expect(world.agents.personal.kind).toBe('personal')
    expect(world.agents.social.kind).toBe('social')
    expect(world.events).toEqual([])
  })

  it('supports pressure-related system snapshots', () => {
    const world = createInitialWorldSlice()
    world.systems.world_pressure_profile = {
      generated_at_tick: 1,
      wave: 1,
      dominantPressures: [],
      powerBasis: [],
      distributionPattern: [],
      legitimacyBasis: [],
      faultLines: [],
      volatileZones: [],
      evidenceTrace: [],
    }
    world.systems.situation_snapshot = {
      generated_at_tick: 1,
      wave: 1,
      summaryByAgent: {},
    }

    expect(world.systems.world_pressure_profile?.wave).toBe(1)
    expect(world.systems.situation_snapshot?.generated_at_tick).toBe(1)
  })
})
