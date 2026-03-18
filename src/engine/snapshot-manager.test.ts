import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotManager } from './snapshot-manager';
import type { WorldSlice } from '../domain/world';
import type { SnapshotTrigger } from '../domain/snapshot';

describe('SnapshotManager', () => {
  let manager: SnapshotManager;
  const worldId = 'test-world-123';

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    global.localStorage = localStorageMock as any;

    manager = new SnapshotManager(worldId);
  });

  it('should instantiate with worldId', () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(SnapshotManager);
  });

  it('should have createSnapshot method', () => {
    expect(manager.createSnapshot).toBeDefined();
    expect(typeof manager.createSnapshot).toBe('function');
  });

  it('should have listSnapshots method', () => {
    expect(manager.listSnapshots).toBeDefined();
    expect(typeof manager.listSnapshots).toBe('function');
  });

  it('should have deleteSnapshot method', () => {
    expect(manager.deleteSnapshot).toBeDefined();
    expect(typeof manager.deleteSnapshot).toBe('function');
  });

  it('should have restoreSnapshot method', () => {
    expect(manager.restoreSnapshot).toBeDefined();
    expect(typeof manager.restoreSnapshot).toBe('function');
  });

  describe('createSnapshot', () => {
    let mockWorld: WorldSlice;

    beforeEach(() => {
      mockWorld = {
        world_id: worldId,
        tick: 42,
        time: '2026-03-16T10:00:00Z',
        config: { language: 'en' },
        environment: { description: 'Test world' },
        social_context: {
          macro_events: [],
          narratives: [],
          pressures: [],
          institutions: [],
          ambient_noise: [],
        },
        agents: {
          director: { kind: 'world', id: 'director-1' },
          creator: { kind: 'persona', id: 'creator-1' },
          personal: {
            kind: 'personal',
            genetics: { seed: 'seed-1' },
            identity: { name: 'Player' },
            memory_short: [],
            memory_long: [],
            vitals: { energy: 1, stress: 0, sleep_debt: 0, focus: 1, aging_index: 0 },
            emotion: { label: 'neutral', intensity: 0.5 },
            persona: { openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 },
            goals: [],
            relations: {},
            action_history: [],
            life_status: 'alive',
          },
          social: { kind: 'social', id: 'social-1' },
          npcs: [
            {
              kind: 'personal',
              genetics: { seed: 'seed-2' },
              identity: { name: 'NPC1' },
              memory_short: [],
              memory_long: [],
              vitals: { energy: 1, stress: 0, sleep_debt: 0, focus: 1, aging_index: 0 },
              emotion: { label: 'happy', intensity: 0.7 },
              persona: { openness: 0.6, stability: 0.6, attachment: 0.6, agency: 0.6, empathy: 0.6 },
              goals: [],
              relations: {},
              action_history: [],
              life_status: 'alive',
            },
            {
              kind: 'personal',
              genetics: { seed: 'seed-3' },
              identity: { name: 'NPC2' },
              memory_short: [],
              memory_long: [],
              vitals: { energy: 0, stress: 1, sleep_debt: 1, focus: 0, aging_index: 1 },
              emotion: { label: 'sad', intensity: 0.9 },
              persona: { openness: 0.4, stability: 0.4, attachment: 0.4, agency: 0.4, empathy: 0.4 },
              goals: [],
              relations: {},
              action_history: [],
              life_status: 'dead',
              death_tick: 40,
              cause_of_death: 'Test death',
            },
          ],
        },
        narratives: { patterns: [], counter: 0 },
        events: [],
        relations: {},
        active_hooks: [],
        systems: {},
      } as WorldSlice;

      // Reset localStorage mock
      vi.mocked(global.localStorage.getItem).mockReturnValue(null);
      vi.mocked(global.localStorage.setItem).mockClear();
    });

    it('should create snapshot with generated ID and metadata', () => {
      const metadata = manager.createSnapshot(mockWorld, 'manual', 'Test snapshot');

      expect(metadata.id).toBeDefined();
      expect(metadata.worldId).toBe(worldId);
      expect(metadata.tick).toBe(42);
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.trigger).toBe('manual');
      expect(metadata.label).toBe('Test snapshot');
      expect(metadata.isManual).toBe(true);
    });

    it('should generate description based on trigger type', () => {
      const triggers: Array<{ trigger: SnapshotTrigger; expectedDesc: string }> = [
        { trigger: 'manual', expectedDesc: 'Manual snapshot' },
        { trigger: 'agent_death', expectedDesc: 'Agent death detected' },
        { trigger: 'agent_birth', expectedDesc: 'Agent birth detected' },
        { trigger: 'tension_climax', expectedDesc: 'Dramatic tension climax' },
        { trigger: 'narrative_turn', expectedDesc: 'Narrative turning point' },
        { trigger: 'relationship', expectedDesc: 'Significant relationship change' },
        { trigger: 'resource', expectedDesc: 'Resource event detected' },
        { trigger: 'world_event', expectedDesc: 'World event occurred' },
      ];

      triggers.forEach(({ trigger, expectedDesc }) => {
        const metadata = manager.createSnapshot(mockWorld, trigger);
        expect(metadata.description).toBe(expectedDesc);
      });
    });

    it('should extract thumbnail data from world', () => {
      const metadata = manager.createSnapshot(mockWorld, 'manual');

      expect(metadata.thumbnail.agentCount).toBe(2); // 2 NPCs
      expect(metadata.thumbnail.aliveAgentCount).toBe(1); // 1 alive
      expect(metadata.thumbnail.narrativeCount).toBe(0);
      expect(metadata.thumbnail.eventSummary).toBeDefined();
    });

    it('should save metadata to storage', () => {
      manager.createSnapshot(mockWorld, 'manual');

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        `world_${worldId}_snapshots_meta`,
        expect.any(String)
      );
    });

    it('should save full state to storage', () => {
      const metadata = manager.createSnapshot(mockWorld, 'manual');

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        `world_${worldId}_snapshot_${metadata.id}`,
        expect.any(String)
      );
    });

    it('should mark non-manual snapshots as not manual', () => {
      const metadata = manager.createSnapshot(mockWorld, 'agent_death');
      expect(metadata.isManual).toBe(false);
    });

    it('should skip storage access when localStorage is unavailable', () => {
      delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;

      const metadata = manager.createSnapshot(mockWorld, 'manual');

      expect(metadata.id).toBeDefined();
      expect(manager.listSnapshots()).toEqual([]);
      expect(manager.restoreSnapshot(metadata.id)).toBeNull();
      expect(() => manager.deleteSnapshot(metadata.id)).toThrow('Snapshot not found');
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array when no snapshots exist', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue(null);

      const snapshots = manager.listSnapshots();

      expect(snapshots).toEqual([]);
    });

    it('should return sorted snapshots (newest first)', () => {
      const mockMetadata = [
        {
          id: 'snap-1',
          worldId,
          tick: 10,
          timestamp: '2026-03-16T10:00:00Z',
          trigger: 'manual' as SnapshotTrigger,
          description: 'First snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 1, narrativeCount: 0, eventSummary: '' },
          isManual: true,
        },
        {
          id: 'snap-2',
          worldId,
          tick: 20,
          timestamp: '2026-03-16T12:00:00Z',
          trigger: 'agent_death' as SnapshotTrigger,
          description: 'Second snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 0, narrativeCount: 0, eventSummary: '' },
          isManual: false,
        },
        {
          id: 'snap-3',
          worldId,
          tick: 15,
          timestamp: '2026-03-16T11:00:00Z',
          trigger: 'manual' as SnapshotTrigger,
          description: 'Third snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 1, narrativeCount: 0, eventSummary: '' },
          isManual: true,
        },
      ];

      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(mockMetadata));

      const snapshots = manager.listSnapshots();

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].id).toBe('snap-2'); // Newest (12:00)
      expect(snapshots[1].id).toBe('snap-3'); // Middle (11:00)
      expect(snapshots[2].id).toBe('snap-1'); // Oldest (10:00)
    });

    it('should handle malformed storage data gracefully', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue('invalid json');

      const snapshots = manager.listSnapshots();

      expect(snapshots).toEqual([]);
    });
  });

  describe('deleteSnapshot', () => {
    it('should throw error when trying to delete manual snapshot', () => {
      const mockMetadata = [
        {
          id: 'snap-manual',
          worldId,
          tick: 10,
          timestamp: '2026-03-16T10:00:00Z',
          trigger: 'manual' as SnapshotTrigger,
          description: 'Manual snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 1, narrativeCount: 0, eventSummary: '' },
          isManual: true,
        },
      ];

      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(mockMetadata));

      expect(() => {
        manager.deleteSnapshot('snap-manual');
      }).toThrow('Cannot delete manual snapshots');
    });

    it('should delete auto snapshot successfully', () => {
      const mockMetadata = [
        {
          id: 'snap-auto',
          worldId,
          tick: 20,
          timestamp: '2026-03-16T12:00:00Z',
          trigger: 'agent_death' as SnapshotTrigger,
          description: 'Auto snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 0, narrativeCount: 0, eventSummary: '' },
          isManual: false,
        },
        {
          id: 'snap-other',
          worldId,
          tick: 15,
          timestamp: '2026-03-16T11:00:00Z',
          trigger: 'tension_climax' as SnapshotTrigger,
          description: 'Other snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 1, narrativeCount: 0, eventSummary: '' },
          isManual: false,
        },
      ];

      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(mockMetadata));

      manager.deleteSnapshot('snap-auto');

      // Verify setItem was called to update metadata (removing the deleted snapshot)
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        `world_${worldId}_snapshots_meta`,
        expect.stringContaining('snap-other')
      );
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        `world_${worldId}_snapshots_meta`,
        expect.not.stringContaining('snap-auto')
      );

      // Verify removeItem was called to delete full state
      expect(global.localStorage.removeItem).toHaveBeenCalledWith(
        `world_${worldId}_snapshot_snap-auto`
      );
    });

    it('should throw error when snapshot ID does not exist', () => {
      const mockMetadata = [
        {
          id: 'snap-exists',
          worldId,
          tick: 10,
          timestamp: '2026-03-16T10:00:00Z',
          trigger: 'agent_death' as SnapshotTrigger,
          description: 'Existing snapshot',
          thumbnail: { agentCount: 1, aliveAgentCount: 1, narrativeCount: 0, eventSummary: '' },
          isManual: false,
        },
      ];

      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(mockMetadata));

      expect(() => {
        manager.deleteSnapshot('snap-nonexistent');
      }).toThrow('Snapshot not found');
    });
  });

  describe('restoreSnapshot', () => {
    let mockWorld: WorldSlice;

    beforeEach(() => {
      mockWorld = {
        world_id: worldId,
        tick: 42,
        time: '2026-03-16T10:00:00Z',
        config: { language: 'en' },
        environment: { description: 'Test world' },
        social_context: {
          macro_events: [],
          narratives: [],
          pressures: [],
          institutions: [],
          ambient_noise: [],
        },
        agents: {
          director: { kind: 'world', id: 'director-1' },
          creator: { kind: 'persona', id: 'creator-1' },
          personal: {
            kind: 'personal',
            genetics: { seed: 'seed-1' },
            identity: { name: 'Player' },
            memory_short: [],
            memory_long: [],
            vitals: { energy: 1, stress: 0, sleep_debt: 0, focus: 1, aging_index: 0 },
            emotion: { label: 'neutral', intensity: 0.5 },
            persona: { openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 },
            goals: [],
            relations: {},
            action_history: [],
            life_status: 'alive',
          },
          social: { kind: 'social', id: 'social-1' },
          npcs: [],
        },
        narratives: { patterns: [], counter: 0 },
        events: [],
        relations: {},
        active_hooks: [],
        systems: {},
      } as WorldSlice;
    });

    it('should return WorldSlice when snapshot exists and is valid', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(mockWorld));

      const result = manager.restoreSnapshot('snap-123');

      expect(result).not.toBeNull();
      expect(result).toEqual(mockWorld);
      expect(result?.tick).toBe(42);
      expect(result?.agents).toBeDefined();
      expect(result?.config).toBeDefined();
    });

    it('should return null when snapshot does not exist', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue(null);

      const result = manager.restoreSnapshot('snap-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when snapshot data is malformed JSON', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue('invalid json');

      const result = manager.restoreSnapshot('snap-invalid');

      expect(result).toBeNull();
    });

    it('should return null when snapshot data is missing required fields', () => {
      const invalidWorld = { tick: 42 }; // Missing agents, config
      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(invalidWorld));

      const result = manager.restoreSnapshot('snap-incomplete');

      expect(result).toBeNull();
    });

    it('should validate that restored world has tick field', () => {
      const worldWithoutTick = { ...mockWorld };
      delete (worldWithoutTick as any).tick;
      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(worldWithoutTick));

      const result = manager.restoreSnapshot('snap-no-tick');

      expect(result).toBeNull();
    });

    it('should validate that restored world has agents field', () => {
      const worldWithoutAgents = { ...mockWorld };
      delete (worldWithoutAgents as any).agents;
      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(worldWithoutAgents));

      const result = manager.restoreSnapshot('snap-no-agents');

      expect(result).toBeNull();
    });

    it('should validate that restored world has config field', () => {
      const worldWithoutConfig = { ...mockWorld };
      delete (worldWithoutConfig as any).config;
      vi.mocked(global.localStorage.getItem).mockReturnValue(JSON.stringify(worldWithoutConfig));

      const result = manager.restoreSnapshot('snap-no-config');

      expect(result).toBeNull();
    });
  });
});
