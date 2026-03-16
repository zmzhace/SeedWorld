import type { WorldSlice } from './world';

/**
 * Trigger types for automatic snapshot creation
 */
export type SnapshotTrigger =
  | 'manual'           // User-created snapshot
  | 'agent_death'      // Agent died
  | 'agent_birth'      // Agent born/created
  | 'tension_climax'   // Dramatic tension peaked
  | 'narrative_turn'   // Narrative turning point
  | 'relationship'     // Significant relationship change
  | 'resource'         // Resource appeared/depleted
  | 'world_event';     // User-triggered world event

/**
 * Complete world snapshot with full state
 */
export type WorldSnapshot = {
  id: string;
  worldId: string;
  tick: number;
  timestamp: string;
  trigger: SnapshotTrigger;
  label?: string;
  description: string;
  worldState: WorldSlice;
  thumbnail: {
    agentCount: number;
    aliveAgentCount: number;
    narrativeCount: number;
    eventSummary: string;
  };
  isManual: boolean;
};

/**
 * Snapshot metadata without the full world state (for listing)
 */
export type SnapshotMetadata = Omit<WorldSnapshot, 'worldState'>;
