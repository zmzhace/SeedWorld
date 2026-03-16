import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import { runWorldTick } from './orchestrator'
import { SnapshotManager } from './snapshot-manager'
import * as triggers from './snapshot-triggers'

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
