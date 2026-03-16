import type { WorldSlice } from '../domain/world';
import type { SnapshotMetadata, SnapshotTrigger, WorldSnapshot } from '../domain/snapshot';
import { saveMetadata, saveFullState, loadMetadata } from './snapshot-storage';

/**
 * SnapshotManager orchestrates snapshot operations for a world.
 * Handles creation, listing, deletion, and restoration of snapshots.
 */
export class SnapshotManager {
  private worldId: string;

  constructor(worldId: string) {
    this.worldId = worldId;
  }

  /**
   * Creates a snapshot of the current world state.
   * @param world - The world state to snapshot
   * @param trigger - What triggered this snapshot
   * @param label - Optional user-provided label
   * @returns Metadata for the created snapshot
   */
  createSnapshot(world: WorldSlice, trigger: SnapshotTrigger, label?: string): SnapshotMetadata {
    // Generate unique ID
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Generate description based on trigger
    const description = this.generateDescription(trigger);

    // Extract thumbnail data
    const thumbnail = this.extractThumbnail(world);

    // Create full snapshot
    const snapshot: WorldSnapshot = {
      id,
      worldId: this.worldId,
      tick: world.tick,
      timestamp,
      trigger,
      label,
      description,
      worldState: world,
      thumbnail,
      isManual: trigger === 'manual',
    };

    // Save to storage
    const { worldState, ...metadata } = snapshot;
    saveMetadata(this.worldId, metadata);
    saveFullState(this.worldId, id, worldState);

    return metadata;
  }

  /**
   * Generate description based on trigger type
   */
  private generateDescription(trigger: SnapshotTrigger): string {
    const descriptions: Record<SnapshotTrigger, string> = {
      manual: 'Manual snapshot',
      agent_death: 'Agent death detected',
      agent_birth: 'Agent birth detected',
      tension_climax: 'Dramatic tension climax',
      narrative_turn: 'Narrative turning point',
      relationship: 'Significant relationship change',
      resource: 'Resource event detected',
      world_event: 'World event occurred',
    };
    return descriptions[trigger];
  }

  /**
   * Extract thumbnail data from world state
   */
  private extractThumbnail(world: WorldSlice) {
    const npcs = world.agents.npcs;
    const agentCount = npcs.length;
    const aliveAgentCount = npcs.filter((npc) => npc.life_status === 'alive').length;
    const narrativeCount = world.narratives.patterns?.length || 0;

    // Generate event summary
    const recentEvents = world.events.slice(-3);
    const eventSummary =
      recentEvents.length > 0
        ? recentEvents.map((e) => e.type).join(', ')
        : 'No recent events';

    return {
      agentCount,
      aliveAgentCount,
      narrativeCount,
      eventSummary,
    };
  }

  /**
   * Lists all snapshots for this world.
   * @returns Array of snapshot metadata, sorted by timestamp (newest first)
   */
  listSnapshots(): SnapshotMetadata[] {
    const metadata = loadMetadata(this.worldId);
    // Sort by timestamp descending (newest first)
    // ISO format strings sort correctly lexicographically
    return metadata.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Deletes a snapshot.
   * @param snapshotId - ID of the snapshot to delete
   */
  deleteSnapshot(snapshotId: string): void {
    throw new Error('Not implemented');
  }

  /**
   * Restores a world from a snapshot.
   * @param snapshotId - ID of the snapshot to restore
   * @returns The restored world state, or null if snapshot not found
   */
  restoreSnapshot(snapshotId: string): WorldSlice | null {
    throw new Error('Not implemented');
  }
}
