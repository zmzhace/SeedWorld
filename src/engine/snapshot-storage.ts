import type { SnapshotMetadata } from '../domain/snapshot';
import type { WorldSlice } from '../domain/world';

function getStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/**
 * Get the localStorage key for snapshot metadata
 */
function getMetadataKey(worldId: string): string {
  return `world_${worldId}_snapshots_meta`;
}

/**
 * Get the localStorage key for a full snapshot state
 */
function getSnapshotKey(worldId: string, snapshotId: string): string {
  return `world_${worldId}_snapshot_${snapshotId}`;
}

/**
 * Save snapshot metadata to localStorage
 */
export function saveMetadata(worldId: string, metadata: SnapshotMetadata): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const key = getMetadataKey(worldId);
  const existing = loadMetadata(worldId);
  existing.push(metadata);
  storage.setItem(key, JSON.stringify(existing));
}

/**
 * Load all snapshot metadata for a world
 */
export function loadMetadata(worldId: string): SnapshotMetadata[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const key = getMetadataKey(worldId);
  const raw = storage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as SnapshotMetadata[];
  } catch {
    return [];
  }
}

/**
 * Save full world state for a snapshot
 */
export function saveFullState(worldId: string, snapshotId: string, state: WorldSlice): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const key = getSnapshotKey(worldId, snapshotId);
  storage.setItem(key, JSON.stringify(state));
}

/**
 * Load full world state for a snapshot
 */
export function loadFullState(worldId: string, snapshotId: string): WorldSlice | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const key = getSnapshotKey(worldId, snapshotId);
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as WorldSlice;
  } catch {
    return null;
  }
}

/**
 * Delete a snapshot (both metadata and full state)
 */
export function deleteSnapshot(worldId: string, snapshotId: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const metadata = loadMetadata(worldId);
  const filtered = metadata.filter((m) => m.id !== snapshotId);
  const metaKey = getMetadataKey(worldId);
  storage.setItem(metaKey, JSON.stringify(filtered));

  const stateKey = getSnapshotKey(worldId, snapshotId);
  storage.removeItem(stateKey);
}
