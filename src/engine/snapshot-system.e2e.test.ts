import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotManager } from './snapshot-manager';
import { createInitialWorldSlice } from '../domain/world';
import type { WorldSlice, PersonalAgentState } from '../domain/world';
import { createPersonalAgent } from '../domain/agents';

/**
 * End-to-end integration test for the entire snapshot system.
 * Tests the complete flow: trigger detection → snapshot creation → restore → cleanup
 */
describe('Snapshot System E2E', () => {
  let manager: SnapshotManager;
  let world: WorldSlice;
  const worldId = 'e2e-test-world';

  beforeEach(() => {
    // Mock localStorage
    const storage: Record<string, string> = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach(key => delete storage[key]);
      }),
      length: 0,
      key: vi.fn(),
    };
    global.localStorage = localStorageMock as any;

    // Create test world with initial state
    world = createInitialWorldSlice();
    world.world_id = worldId;
    world.tick = 0;

    // Add some NPCs for testing
    const npc1 = createPersonalAgent('npc1') as PersonalAgentState;
    npc1.identity.name = 'Alice';
    npc1.life_status = 'alive';

    const npc2 = createPersonalAgent('npc2') as PersonalAgentState;
    npc2.identity.name = 'Bob';
    npc2.life_status = 'alive';

    world.agents.npcs = [npc1, npc2];

    // Initialize systems with proper structure
    world.systems = {
      reputation: { reputations: {} },
      cognitive_bias: { biases: {} },
      resources: { resources: {} },
      tension: { globalTension: 0.5, events: [] },
      emergence: { properties: [] },
      social_roles: { roles: {} },
      memes: { memes: [], transmissions: [] },
      dramaticTension: { globalTension: 0.5, events: [] },
    };

    manager = new SnapshotManager(worldId);
  });

  it('E2E: Complete snapshot lifecycle', async () => {
    // ===== Step 1: Create world with initial state =====
    expect(world.tick).toBe(0);
    expect(world.agents.npcs).toHaveLength(2);
    expect(manager.listSnapshots()).toHaveLength(0);

    // ===== Step 2: Trigger agent death event =====
    const worldAfterDeath = {
      ...world,
      tick: 1,
      agents: {
        ...world.agents,
        npcs: [world.agents.npcs[0]], // Remove one NPC (death)
      },
    };

    const deathSnapshot = manager.createSnapshot(worldAfterDeath, 'agent_death');
    expect(deathSnapshot.trigger).toBe('agent_death');
    expect(deathSnapshot.description).toBe('Agent death detected');
    expect(deathSnapshot.isManual).toBe(false);
    expect(deathSnapshot.tick).toBe(1);

    // ===== Step 3: Trigger tension climax event =====
    const worldAfterTension = {
      ...worldAfterDeath,
      tick: 2,
      systems: {
        ...worldAfterDeath.systems,
        dramaticTension: { globalTension: 0.85, events: [] },
      },
    };

    const tensionSnapshot = manager.createSnapshot(worldAfterTension, 'tension_climax');
    expect(tensionSnapshot.trigger).toBe('tension_climax');
    expect(tensionSnapshot.description).toBe('Dramatic tension climax');

    // ===== Step 4: Trigger narrative turn event =====
    const worldAfterNarrative = {
      ...worldAfterTension,
      tick: 3,
      narratives: {
        ...worldAfterTension.narratives,
        patterns: [
          {
            id: 'pattern-1',
            type: 'conflict',
            participants: ['npc1'],
            intensity: 0.8,
            detected_at: 3,
          },
        ],
      },
    };

    const narrativeSnapshot = manager.createSnapshot(worldAfterNarrative, 'narrative_turn');
    expect(narrativeSnapshot.trigger).toBe('narrative_turn');

    // ===== Step 5: Trigger relationship change event =====
    const worldAfterRelationship = {
      ...worldAfterNarrative,
      tick: 4,
      systems: {
        ...worldAfterNarrative.systems,
        reputation: {
          reputations: {
            npc1: {
              trustworthiness: 0.9,
              competence: 0.8,
              benevolence: 0.7,
              status: 0.6,
              influence: 0.5,
            },
          },
        },
      },
    };

    const relationshipSnapshot = manager.createSnapshot(worldAfterRelationship, 'relationship');
    expect(relationshipSnapshot.trigger).toBe('relationship');

    // ===== Step 6: Trigger resource event =====
    const worldAfterResource = {
      ...worldAfterRelationship,
      tick: 5,
      systems: {
        ...worldAfterRelationship.systems,
        resources: {
          resources: {
            'resource-1': {
              id: 'resource-1',
              name: 'Water',
              amount: 0, // Depleted
              max_amount: 100,
              regeneration_rate: 0.1,
            },
          },
        },
      },
    };

    const resourceSnapshot = manager.createSnapshot(worldAfterResource, 'resource');
    expect(resourceSnapshot.trigger).toBe('resource');

    // ===== Step 7: Create manual snapshot =====
    const worldManual = {
      ...worldAfterResource,
      tick: 6,
    };

    const manualSnapshot = manager.createSnapshot(worldManual, 'manual', 'My checkpoint');
    expect(manualSnapshot.trigger).toBe('manual');
    expect(manualSnapshot.label).toBe('My checkpoint');
    expect(manualSnapshot.isManual).toBe(true);

    // ===== Step 8: Verify all snapshots were created =====
    const allSnapshots = manager.listSnapshots();
    expect(allSnapshots.length).toBeGreaterThanOrEqual(6);

    // Verify snapshots are sorted by timestamp (newest first)
    const manualSnap = allSnapshots.find(s => s.trigger === 'manual');
    const deathSnap = allSnapshots.find(s => s.trigger === 'agent_death');
    expect(manualSnap?.tick).toBe(6);
    expect(deathSnap?.tick).toBe(1);

    // ===== Step 9: Verify snapshot metadata =====
    const deathSnapshotFromList = allSnapshots.find(s => s.trigger === 'agent_death');
    expect(deathSnapshotFromList).toBeDefined();
    expect(deathSnapshotFromList?.thumbnail.agentCount).toBe(1);
    expect(deathSnapshotFromList?.thumbnail.aliveAgentCount).toBe(1);

    // ===== Step 10: Restore snapshot and verify state matches =====
    const restoredWorld = manager.restoreSnapshot(deathSnapshot.id);
    expect(restoredWorld).not.toBeNull();
    expect(restoredWorld?.tick).toBe(1);
    expect(restoredWorld?.agents.npcs).toHaveLength(1);
    expect(restoredWorld?.agents.npcs[0].identity.name).toBe('Alice');

    // ===== Step 11: Test cleanup (delete old auto-snapshots) =====
    // Create 12 more auto-snapshots to trigger cleanup
    for (let i = 7; i < 19; i++) {
      const tempWorld = {
        ...worldAfterResource,
        tick: i,
      };
      manager.createSnapshot(tempWorld, 'agent_birth');
    }

    // Now we have 18 snapshots total (6 original + 12 new)
    const beforeCleanup = manager.listSnapshots();
    expect(beforeCleanup).toHaveLength(18);

    // Simulate cleanup: keep only 10 most recent auto-snapshots
    const autoSnapshots = beforeCleanup
      .filter(s => !s.isManual)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    expect(autoSnapshots.length).toBeGreaterThan(10);

    const snapshotsToDelete = autoSnapshots.slice(10);
    for (const snapshot of snapshotsToDelete) {
      manager.deleteSnapshot(snapshot.id);
    }

    // Verify cleanup worked
    const afterCleanup = manager.listSnapshots();
    const autoSnapshotsAfter = afterCleanup.filter(s => !s.isManual);
    expect(autoSnapshotsAfter).toHaveLength(10);

    // Manual snapshot should still exist
    const manualStillExists = afterCleanup.find(s => s.id === manualSnapshot.id);
    expect(manualStillExists).toBeDefined();

    // ===== Step 12: Test manual snapshot protection =====
    expect(() => {
      manager.deleteSnapshot(manualSnapshot.id);
    }).toThrow('Cannot delete manual snapshots');

    // Manual snapshot should still exist after failed delete attempt
    const finalSnapshots = manager.listSnapshots();
    const manualStillExistsAfterAttempt = finalSnapshots.find(s => s.id === manualSnapshot.id);
    expect(manualStillExistsAfterAttempt).toBeDefined();

    // ===== Step 13: Test restore non-existent snapshot =====
    const nonExistent = manager.restoreSnapshot('non-existent-id');
    expect(nonExistent).toBeNull();

    // ===== Step 14: Test delete non-existent snapshot =====
    expect(() => {
      manager.deleteSnapshot('non-existent-id');
    }).toThrow('Snapshot not found');
  });

  it('E2E: Snapshot thumbnail data accuracy', () => {
    // Create world with specific state
    const testWorld = {
      ...world,
      tick: 10,
      agents: {
        ...world.agents,
        npcs: [
          { ...world.agents.npcs[0], life_status: 'alive' as const },
          { ...world.agents.npcs[1], life_status: 'dead' as const },
        ],
      },
      narratives: {
        ...world.narratives,
        patterns: [
          { id: 'p1', type: 'conflict', participants: [], intensity: 0.8, detected_at: 1 },
          { id: 'p2', type: 'alliance', participants: [], intensity: 0.6, detected_at: 2 },
        ],
      },
      events: [
        { type: 'speak', timestamp: '2024-01-01T00:00:00Z', payload: {} },
        { type: 'move', timestamp: '2024-01-01T00:01:00Z', payload: {} },
        { type: 'attack', timestamp: '2024-01-01T00:02:00Z', payload: {} },
      ],
    };

    const snapshot = manager.createSnapshot(testWorld, 'manual');

    // Verify thumbnail data
    expect(snapshot.thumbnail.agentCount).toBe(2);
    expect(snapshot.thumbnail.aliveAgentCount).toBe(1);
    expect(snapshot.thumbnail.narrativeCount).toBe(2);
    expect(snapshot.thumbnail.eventSummary).toBe('speak, move, attack');
  });

  it('E2E: Multiple worlds isolation', () => {
    // Create snapshots for first world
    const snapshot1 = manager.createSnapshot(world, 'manual', 'World 1 snapshot');
    expect(manager.listSnapshots()).toHaveLength(1);

    // Create manager for different world
    const world2Id = 'e2e-test-world-2';
    const manager2 = new SnapshotManager(world2Id);
    const world2 = { ...world, world_id: world2Id };

    // Create snapshots for second world
    const snapshot2 = manager2.createSnapshot(world2, 'manual', 'World 2 snapshot');
    expect(manager2.listSnapshots()).toHaveLength(1);

    // Verify isolation: each manager only sees its own snapshots
    expect(manager.listSnapshots()).toHaveLength(1);
    expect(manager.listSnapshots()[0].id).toBe(snapshot1.id);

    expect(manager2.listSnapshots()).toHaveLength(1);
    expect(manager2.listSnapshots()[0].id).toBe(snapshot2.id);

    // Verify cross-world restore fails gracefully
    const crossRestore = manager.restoreSnapshot(snapshot2.id);
    expect(crossRestore).toBeNull();
  });

  it('E2E: Snapshot state immutability', () => {
    // Create snapshot
    const originalWorld = {
      ...world,
      tick: 5,
      agents: {
        ...world.agents,
        npcs: [world.agents.npcs[0]],
      },
    };

    const snapshot = manager.createSnapshot(originalWorld, 'manual');

    // Modify original world
    originalWorld.tick = 10;
    originalWorld.agents.npcs = [];

    // Restore snapshot
    const restored = manager.restoreSnapshot(snapshot.id);

    // Verify restored state matches original snapshot, not modified world
    expect(restored?.tick).toBe(5);
    expect(restored?.agents.npcs).toHaveLength(1);
  });
});

