import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SnapshotMetadata, WorldSnapshot } from '../domain/snapshot';
import type { WorldSlice } from '../domain/world';
import {
  saveMetadata,
  loadMetadata,
  saveFullState,
  loadFullState,
  deleteSnapshot,
} from './snapshot-storage';

describe('snapshot-storage', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
    });
  });

  describe('saveMetadata / loadMetadata', () => {
    it('should save and load metadata', () => {
      const worldId = 'world-123';
      const metadata: SnapshotMetadata = {
        id: 'snap-1',
        worldId,
        tick: 10,
        timestamp: '2026-03-16T10:00:00Z',
        trigger: 'manual',
        label: 'Test Snapshot',
        description: 'A test snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'Test event',
        },
        isManual: true,
      };

      saveMetadata(worldId, metadata);
      const loaded = loadMetadata(worldId);

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(metadata);
    });

    it('should append to existing metadata', () => {
      const worldId = 'world-123';
      const meta1: SnapshotMetadata = {
        id: 'snap-1',
        worldId,
        tick: 10,
        timestamp: '2026-03-16T10:00:00Z',
        trigger: 'manual',
        description: 'First snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'Event 1',
        },
        isManual: true,
      };
      const meta2: SnapshotMetadata = {
        id: 'snap-2',
        worldId,
        tick: 20,
        timestamp: '2026-03-16T11:00:00Z',
        trigger: 'agent_death',
        description: 'Second snapshot',
        thumbnail: {
          agentCount: 4,
          aliveAgentCount: 3,
          narrativeCount: 3,
          eventSummary: 'Event 2',
        },
        isManual: false,
      };

      saveMetadata(worldId, meta1);
      saveMetadata(worldId, meta2);
      const loaded = loadMetadata(worldId);

      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toEqual(meta1);
      expect(loaded[1]).toEqual(meta2);
    });

    it('should return empty array when no metadata exists', () => {
      const loaded = loadMetadata('nonexistent-world');
      expect(loaded).toEqual([]);
    });
  });

  describe('saveFullState / loadFullState', () => {
    it('should save and load full world state', () => {
      const worldId = 'world-123';
      const snapshotId = 'snap-1';
      const worldState: WorldSlice = {
        id: worldId,
        tick: 10,
        config: {
          language: 'en',
          tickInterval: 1000,
        },
        environment: {
          description: 'Test world',
          locations: [],
        },
        agents: [],
        narratives: [],
        systems: {} as any,
      };

      saveFullState(worldId, snapshotId, worldState);
      const loaded = loadFullState(worldId, snapshotId);

      expect(loaded).toEqual(worldState);
    });

    it('should return null when state does not exist', () => {
      const loaded = loadFullState('nonexistent-world', 'nonexistent-snap');
      expect(loaded).toBeNull();
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot metadata and full state', () => {
      const worldId = 'world-123';
      const snapshotId = 'snap-1';
      const metadata: SnapshotMetadata = {
        id: snapshotId,
        worldId,
        tick: 10,
        timestamp: '2026-03-16T10:00:00Z',
        trigger: 'manual',
        description: 'Test snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'Test event',
        },
        isManual: true,
      };
      const worldState: WorldSlice = {
        id: worldId,
        tick: 10,
        config: {
          language: 'en',
          tickInterval: 1000,
        },
        environment: {
          description: 'Test world',
          locations: [],
        },
        agents: [],
        narratives: [],
        systems: {} as any,
      };

      saveMetadata(worldId, metadata);
      saveFullState(worldId, snapshotId, worldState);

      deleteSnapshot(worldId, snapshotId);

      const loadedMeta = loadMetadata(worldId);
      const loadedState = loadFullState(worldId, snapshotId);

      expect(loadedMeta).toHaveLength(0);
      expect(loadedState).toBeNull();
    });

    it('should only delete the specified snapshot', () => {
      const worldId = 'world-123';
      const meta1: SnapshotMetadata = {
        id: 'snap-1',
        worldId,
        tick: 10,
        timestamp: '2026-03-16T10:00:00Z',
        trigger: 'manual',
        description: 'First snapshot',
        thumbnail: {
          agentCount: 5,
          aliveAgentCount: 4,
          narrativeCount: 2,
          eventSummary: 'Event 1',
        },
        isManual: true,
      };
      const meta2: SnapshotMetadata = {
        id: 'snap-2',
        worldId,
        tick: 20,
        timestamp: '2026-03-16T11:00:00Z',
        trigger: 'agent_death',
        description: 'Second snapshot',
        thumbnail: {
          agentCount: 4,
          aliveAgentCount: 3,
          narrativeCount: 3,
          eventSummary: 'Event 2',
        },
        isManual: false,
      };

      saveMetadata(worldId, meta1);
      saveMetadata(worldId, meta2);

      deleteSnapshot(worldId, 'snap-1');

      const loaded = loadMetadata(worldId);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('snap-2');
    });
  });
});
