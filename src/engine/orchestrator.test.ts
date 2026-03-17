import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import { runWorldTick } from './orchestrator'
import { SnapshotManager } from './snapshot-manager'
import * as triggers from './snapshot-triggers'
import * as pressureProfile from './world-pressure-profile'
import * as refreshPolicy from './situation-refresh'
import * as situationConsequences from './situation-consequences'

// Mock SnapshotManager
vi.mock('./snapshot-manager', () => ({
  SnapshotManager: vi.fn().mockImplementation(() => ({
    createSnapshot: vi.fn().mockResolvedValue({}),
    listSnapshots: vi.fn().mockReturnValue([]),
    deleteSnapshot: vi.fn(),
  })),
}))

// Mock trigger detection functions
vi.mock('./snapshot-triggers', () => ({
  detectAgentDeathOrBirth: vi.fn().mockReturnValue({ trigger: null }),
  detectTensionClimax: vi.fn().mockReturnValue({ trigger: null }),
  detectNarrativeTurn: vi.fn().mockReturnValue({ trigger: null }),
  detectRelationshipChange: vi.fn().mockReturnValue({ trigger: null }),
  detectResourceEvent: vi.fn().mockReturnValue({ trigger: null }),
}))

function createDirectorPathWorld() {
  const world = createInitialWorldSlice()
  world.agents.npcs = [
    {
      kind: 'personal',
      genetics: { seed: 'npc-1' },
      identity: { name: 'Watcher' },
      memory_short: [],
      memory_long: [],
      vitals: {
        energy: 0.8,
        stress: 0.2,
        sleep_debt: 0,
        focus: 0.5,
        aging_index: 0,
      },
      emotion: { label: 'neutral', intensity: 0.1 },
      persona: {
        openness: 0.5,
        stability: 0.5,
        attachment: 0.5,
        agency: 0.5,
        empathy: 0.5,
      },
      goals: [],
      relations: {},
      action_history: [],
      life_status: 'alive',
      location: 'square',
    },
  ]
  return world
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('advances the world by one tick and appends an event', async () => {
  const world = createInitialWorldSlice()
  const next = await runWorldTick(world)

  expect(next.tick).toBe(1)
  expect(next.events.length).toBeGreaterThan(0)
  expect(next.agents.personal.action_history.length).toBe(1)
})

describe('world pressure snapshot export', () => {
  it('stores a wave-one shared world pressure profile without director execution', async () => {
    const world = createInitialWorldSlice()
    world.tick = 4
    world.environment.description = 'A rigid settlement where access is controlled and essentials are scarce.'
    world.systems.resources = {
      resources: {
        water: {
          id: 'water',
          kind: 'material',
          name: 'Water',
          type: 'material',
          amount: 2,
          max_amount: 10,
          regen_rate: 0,
          scarcity: 0.9,
          value: 0.8,
          location: 'north gate',
          owners: [],
          competitors: [],
          properties: {},
        },
      },
    }

    const next = await runWorldTick(world)

    expect(next.systems.world_pressure_profile).toBeDefined()
    expect(next.systems.world_pressure_profile).toMatchObject({
      generated_at_tick: 5,
      wave: 1,
    })
    expect(next.systems.world_pressure_profile?.dominantPressures[0]?.kind).toBe('resource_scarcity')
    expect(next.systems.world_pressure_profile?.evidenceTrace).toContain(
      'resources:water:scarcity=0.90:value=0.80:location=north gate',
    )
    expect(next.systems.situation_snapshot).toEqual({
      generated_at_tick: 5,
      wave: 1,
      summaryByAgent: {},
    })
  })

  it('stores the same derived wave-one snapshots when director execution runs', async () => {
    const world = createDirectorPathWorld()

    const next = await runWorldTick(world, {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([]),
      },
    })

    expect(next.systems.world_pressure_profile).toBeDefined()
    expect(next.systems.world_pressure_profile?.wave).toBe(1)
    expect(next.systems.situation_snapshot).toEqual({
      generated_at_tick: 1,
      wave: 1,
      summaryByAgent: {},
    })
  })


  it('applies structural consequences into canonical systems and exports the derived snapshot', async () => {
    const world = createDirectorPathWorld()
    world.systems.resources = {
      resources: {
        water: {
          id: 'water',
          kind: 'material',
          name: 'Water',
          type: 'material',
          amount: 4,
          max_amount: 10,
          regen_rate: 0,
          scarcity: 0.2,
          value: 0.6,
          location: 'square',
          owners: [],
          competitors: [],
          properties: {},
        },
      },
    }

    const consequence = {
      kind: 'access_shift' as const,
      summary: 'Watcher now controls the water line in the square.',
      strength: 0.9,
      sourceAgentId: 'npc-1',
      resourceId: 'water',
    }

    const applySpy = vi.spyOn(situationConsequences, 'applySituationConsequences')

    const next = await runWorldTick(world, {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([
          {
            agentId: 'director-1',
            patch: {
              events: [],
              situation: {
                consequences: [consequence],
              },
            },
          },
        ]),
      },
    })

    expect(applySpy).toHaveBeenCalledWith({
      world: expect.any(Object),
      consequences: [consequence],
      knowledgeGraph: expect.any(Object),
    })
    expect(next.systems.resources?.resources.water.owners).toEqual(['npc-1'])
    expect(next.systems.situation_snapshot).toEqual({
      generated_at_tick: 1,
      wave: 1,
      summaryByAgent: {
        'npc-1': ['Watcher now controls the water line in the square.'],
      },
    })
  })

  it('exports graph consequences through the canonical knowledge graph state', async () => {
    const world = createDirectorPathWorld()

    const consequence = {
      kind: 'dependency_shift' as const,
      summary: 'Watcher now depends on Broker for water access.',
      strength: 0.8,
      sourceAgentId: 'npc-1',
      targetAgentId: 'npc-2',
    }

    const next = await runWorldTick(world, {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([
          {
            agentId: 'director-1',
            patch: {
              events: [],
              situation: {
                consequences: [consequence],
              },
            },
          },
        ]),
      },
    })

    expect(next.systems.knowledge_graph?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'npc-1',
          target: 'npc-2',
          relation: 'related_to',
          properties: expect.objectContaining({
            kind: 'dependency_shift',
          }),
        }),
      ]),
    )
  })

  it('keeps exported wave-one snapshot ticks aligned with the returned world tick after timeDelta', async () => {
    const world = createDirectorPathWorld()

    const next = await runWorldTick(world, {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([
          {
            agentId: 'director-1',
            patch: {
              timeDelta: 2,
              events: [],
            },
          },
        ]),
      },
    })

    expect(next.tick).toBe(3)
    expect(next.systems.world_pressure_profile).toMatchObject({
      generated_at_tick: 3,
      wave: 1,
    })
    expect(next.systems.situation_snapshot).toEqual({
      generated_at_tick: 3,
      wave: 1,
      summaryByAgent: {},
    })
  })
})

describe('wave sharing semantics', () => {
  it('uses one shared profile for all first-wave agents', async () => {
    const buildSpy = vi.spyOn(pressureProfile, 'buildWorldPressureProfile')

    await runWorldTick(createDirectorPathWorld(), {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([]),
      },
    })

    expect(buildSpy).toHaveBeenCalledTimes(1)
    expect(buildSpy).toHaveBeenNthCalledWith(1, expect.anything(), { wave: 1 })
  })

  it('reuses the wave-one profile when no material change is detected', async () => {
    vi.spyOn(refreshPolicy, 'detectMaterialSituationChanges').mockReturnValue({
      changedAccess: false,
      changedLegitimacy: false,
      changedScarcity: false,
      changedHotspots: false,
    })
    const buildSpy = vi.spyOn(pressureProfile, 'buildWorldPressureProfile')

    await runWorldTick(createDirectorPathWorld(), {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([]),
      },
    })

    expect(buildSpy).toHaveBeenCalledTimes(1)
  })

  it('rebuilds once for wave two when material change is detected', async () => {
    vi.spyOn(refreshPolicy, 'detectMaterialSituationChanges').mockReturnValue({
      changedAccess: true,
      changedLegitimacy: false,
      changedScarcity: false,
      changedHotspots: false,
    })
    const buildSpy = vi.spyOn(pressureProfile, 'buildWorldPressureProfile')

    await runWorldTick(createDirectorPathWorld(), {
      directorRegistry: {
        runAll: vi.fn().mockResolvedValue([]),
      },
    })

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenNthCalledWith(2, expect.anything(), { wave: 2 })
  })
})

describe('Snapshot Integration', () => {
  it('creates snapshot when agent dies', async () => {
    const world = createInitialWorldSlice()

    // Mock agent death detection
    vi.mocked(triggers.detectAgentDeathOrBirth).mockReturnValueOnce({
      trigger: 'agent_death',
      description: 'Agent died',
    })

    const next = await runWorldTick(world)

    // Verify SnapshotManager was instantiated
    expect(SnapshotManager).toHaveBeenCalledWith(world.world_id)

    // Verify createSnapshot was called with correct trigger
    const mockInstance = vi.mocked(SnapshotManager).mock.results[0].value
    expect(mockInstance.createSnapshot).toHaveBeenCalledWith(
      next,
      'agent_death',
      undefined
    )
  })

  it('creates snapshot when tension peaks', async () => {
    const world = createInitialWorldSlice()

    // Mock tension climax detection
    vi.mocked(triggers.detectTensionClimax).mockReturnValueOnce({
      trigger: 'tension_climax',
      description: 'Dramatic tension peaked',
    })

    const next = await runWorldTick(world)

    const mockInstance = vi.mocked(SnapshotManager).mock.results[0].value
    expect(mockInstance.createSnapshot).toHaveBeenCalledWith(
      next,
      'tension_climax',
      undefined
    )
  })

  it('does not create snapshot when no triggers detected', async () => {
    const world = createInitialWorldSlice()

    // All triggers return null (default mock behavior)
    const next = await runWorldTick(world)

    const mockInstance = vi.mocked(SnapshotManager).mock.results[0].value
    expect(mockInstance.createSnapshot).not.toHaveBeenCalled()
  })

  it('creates only one snapshot when multiple triggers detected', async () => {
    const world = createInitialWorldSlice()

    // Mock multiple triggers
    vi.mocked(triggers.detectAgentDeathOrBirth).mockReturnValueOnce({
      trigger: 'agent_death',
      description: 'Agent died',
    })
    vi.mocked(triggers.detectTensionClimax).mockReturnValueOnce({
      trigger: 'tension_climax',
      description: 'Dramatic tension peaked',
    })

    const next = await runWorldTick(world)

    // Should create only one snapshot (first trigger wins)
    const mockInstance = vi.mocked(SnapshotManager).mock.results[0].value
    expect(mockInstance.createSnapshot).toHaveBeenCalledTimes(1)
    expect(mockInstance.createSnapshot).toHaveBeenCalledWith(
      next,
      'agent_death',
      undefined
    )
  })

  it('cleans up old auto-snapshots keeping only 10 most recent', async () => {
    const world = createInitialWorldSlice()

    // Mock 15 existing auto-snapshots
    const mockSnapshots = Array.from({ length: 15 }, (_, i) => ({
      id: `snapshot-${i}`,
      worldId: world.world_id,
      tick: i,
      timestamp: new Date(Date.now() - (15 - i) * 1000).toISOString(),
      trigger: 'agent_death' as const,
      description: 'Agent died',
      thumbnail: {
        agentCount: 5,
        aliveAgentCount: 4,
        narrativeCount: 2,
        eventSummary: 'test',
      },
      isManual: false,
    }))

    // Mock listSnapshots to return 15 snapshots
    const mockInstance = {
      createSnapshot: vi.fn(),
      listSnapshots: vi.fn().mockReturnValue(mockSnapshots),
      deleteSnapshot: vi.fn(),
    }
    vi.mocked(SnapshotManager).mockImplementationOnce(() => mockInstance as any)

    // Trigger a snapshot
    vi.mocked(triggers.detectAgentDeathOrBirth).mockReturnValueOnce({
      trigger: 'agent_death',
      description: 'Agent died',
    })

    await runWorldTick(world)

    // Should delete 5 oldest snapshots (keeping 10 most recent)
    expect(mockInstance.deleteSnapshot).toHaveBeenCalledTimes(5)
    // Verify it deleted the oldest ones (0-4)
    for (let i = 0; i < 5; i++) {
      expect(mockInstance.deleteSnapshot).toHaveBeenCalledWith(`snapshot-${i}`)
    }
  })
})

