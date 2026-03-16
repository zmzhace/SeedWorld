import type { SnapshotMetadata } from '../domain/snapshot';
import type { WorldSlice } from '../domain/world';

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
  const key = getMetadataKey(worldId);
  const existing = loadMetadata(worldId);
  existing.push(metadata);
  localStorage.setItem(key, JSON.stringify(existing));
}

/**
 * Load all snapshot metadata for a world
 */
export function loadMetadata(worldId: string): SnapshotMetadata[] {
  const key = getMetadataKey(worldId);
  const raw = localStorage.getItem(key);
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
  const key = getSnapshotKey(worldId, snapshotId);
  localStorage.setItem(key, JSON.stringify(state));
}

/**
 * Load full world state for a snapshot
 */
export function loadFullState(worldId: string, snapshotId: string): WorldSlice | null {
  const key = getSnapshotKey(worldId, snapshotId);
  const raw = localStorage.getItem(key);
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
  // Remove from metadata array
  const metadata = loadMetadata(worldId);
  const filtered = metadata.filter((m) => m.id !== snapshotId);
  const metaKey = getMetadataKey(worldId);
  localStorage.setItem(metaKey, JSON.stringify(filtered));

  // Remove full state
  const stateKey = getSnapshotKey(worldId, snapshotId);
  localStorage.removeItem(stateKey);
}

