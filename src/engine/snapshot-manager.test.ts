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
});
