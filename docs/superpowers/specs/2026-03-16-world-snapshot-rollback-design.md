# World Snapshot and Rollback System Design

**Date**: 2026-03-16
**Status**: Approved
**Author**: Claude Sonnet 4.6

## Overview

This document specifies the design for a world snapshot and rollback system that allows users to save and restore world states at important moments. The system combines intelligent automatic snapshots with manual user control, providing a time-travel capability for the simulation.

## Goals

1. **Capture Important Moments**: Automatically create snapshots when significant events occur
2. **User Control**: Allow users to manually create snapshots at any time
3. **Safe Rollback**: Enable preview mode before committing to a rollback
4. **Storage Efficiency**: Manage localStorage space with intelligent cleanup
5. **Minimal Disruption**: Implement as an independent module without affecting core simulation logic

## Non-Goals

- Real-time undo/redo for every action
- Branching timelines (multiple parallel worlds)
- Cloud storage or sync across devices
- Snapshot sharing between users

## User Requirements

Based on user input, the system must:

1. **Trigger Mechanisms**:
   - Intelligent auto-snapshots on 6 event types: agent death/birth, tension climax, narrative turns, relationship changes, resource events, world events
   - Manual snapshots via user action

2. **Storage Strategy**:
   - Auto-snapshots can be cleaned up (keep recent 10)
   - Manual snapshots are permanent
   - Use localStorage initially (IndexedDB migration later)

3. **Rollback Behavior**:
   - Preview mode: view snapshot in read-only mode
   - Explicit confirmation required to restore
   - Current state is replaced (no branching)

## Architecture

### Data Structures

```typescript
// src/domain/snapshot.ts

export type SnapshotTrigger =
  | 'manual'           // User-created
  | 'agent_death'      // Agent died
  | 'agent_birth'      // Agent born/created
  | 'tension_climax'   // Dramatic tension peaked
  | 'narrative_turn'   // Narrative turning point
  | 'relationship'     // Significant relationship change
  | 'resource'         // Resource appeared/depleted
  | 'world_event'      // User-triggered world event

export type WorldSnapshot = {
  id: string
  worldId: string
  tick: number
  timestamp: string
  trigger: SnapshotTrigger
  label?: string
  description: string
  worldState: WorldSlice
  thumbnail: {
    agentCount: number
    aliveAgentCount: number
    narrativeCount: number
    eventSummary: string
  }
  isManual: boolean
}

export type SnapshotMetadata = Omit<WorldSnapshot, 'worldState'>
```

### Storage Layout

localStorage keys:
- `world_${worldId}_snapshots_meta`: Array of SnapshotMetadata
- `world_${worldId}_snapshot_${snapshotId}`: Individual WorldSlice

Rationale: Separating metadata from full state avoids loading all snapshots at once.

### Core Module

```typescript
// src/engine/snapshot-manager.ts

export class SnapshotManager {
  static createSnapshot(
    world: WorldSlice,
    trigger: SnapshotTrigger,
    label?: string
  ): WorldSnapshot

  static saveSnapshot(snapshot: WorldSnapshot): void

  static listSnapshots(worldId: string): SnapshotMetadata[]

  static loadSnapshot(worldId: string, snapshotId: string): WorldSnapshot | null

  static deleteSnapshot(worldId: string, snapshotId: string): boolean

  static cleanupAutoSnapshots(worldId: string, keepCount: number): void

  static shouldCreateSnapshot(
    prevWorld: WorldSlice,
    nextWorld: WorldSlice
  ): SnapshotTrigger | null
}
```

### Trigger Detection Logic

`shouldCreateSnapshot` compares prev and next world states:

1. **agent_death**: Check if any agent's `life_status` changed to 'dead'
2. **agent_birth**: Check if `agents.npcs.length` increased
3. **tension_climax**: Check if any tension in `systems.tension.tensions` has `status === 'climax'`
4. **narrative_turn**: Check if any narrative pattern has new turning points
5. **relationship**: Check if any agent's `relations` value changed by > 0.5
6. **resource**: Check if new resources appeared or existing ones depleted
7. **world_event**: Check if new events with `source: 'user_chat'` were added

Returns the first matching trigger, or null if no snapshot needed.

### Integration with Orchestrator

```typescript
// src/engine/orchestrator.ts

export async function runWorldTick(world: WorldSlice, options: TickOptions): Promise<WorldSlice> {
  const prevWorld = world

  // ... existing tick logic ...

  const nextWorld = { ...world, tick: world.tick + 1, /* ... */ }

  // Snapshot detection
  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  if (trigger) {
    const snapshot = SnapshotManager.createSnapshot(nextWorld, trigger)
    SnapshotManager.saveSnapshot(snapshot)
    SnapshotManager.cleanupAutoSnapshots(nextWorld.world_id, 10)
  }

  return nextWorld
}
```

### UI Components

#### Snapshot Panel

```typescript
// src/components/panel/snapshot-panel.tsx

export function SnapshotPanel({ world, onRestore }: Props) {
  // Features:
  // - Timeline view of snapshots
  // - Manual snapshot creation button
  // - Click snapshot to preview
  // - Delete button for auto-snapshots only
  // - Restore confirmation flow
}
```

Visual design:
- Timeline with tick markers
- Color-coded by trigger type
- Manual snapshots have a star icon
- Thumbnail shows agent count and event summary

#### Preview Mode

In `app/worlds/[id]/page.tsx`:

```typescript
const [previewSnapshot, setPreviewSnapshot] = useState<WorldSnapshot | null>(null)

// When previewing:
// - Show "Preview Mode" banner at top
// - Disable all mutation actions (tick, chat, agent generation)
// - Show "Confirm Restore" and "Cancel Preview" buttons
// - Display snapshot metadata (tick, timestamp, trigger)
```

## Storage Management

### Capacity Planning

- Average snapshot size: 100-500KB (depends on agent count)
- localStorage limit: ~5-10MB
- Capacity: 10-50 snapshots
- Strategy: Keep 10 most recent auto-snapshots + all manual snapshots

### Cleanup Policy

When saving a new auto-snapshot:
1. Load snapshot metadata list
2. Filter for auto-snapshots (`isManual === false`)
3. Sort by timestamp descending
4. Keep first 10, delete the rest
5. Manual snapshots are never deleted

### Future Optimization

When localStorage becomes insufficient:
- Migrate to IndexedDB (larger capacity)
- Implement LZ-string compression (50-70% size reduction)
- Add export/import functionality

## User Flows

### Flow 1: Automatic Snapshot

1. User advances time (tick)
2. Orchestrator detects significant event (e.g., agent death)
3. Snapshot created automatically
4. User sees notification: "Snapshot created: Agent death"
5. Snapshot appears in timeline

### Flow 2: Manual Snapshot

1. User clicks "Create Snapshot" button
2. Optional: User enters custom label
3. Snapshot created with trigger='manual'
4. Snapshot appears in timeline with star icon

### Flow 3: Preview and Restore

1. User clicks snapshot in timeline
2. World view switches to preview mode
3. Banner shows: "Previewing Tick 42 - Agent Death"
4. User explores the snapshot state (read-only)
5. User clicks "Confirm Restore"
6. Confirmation dialog: "This will replace current state. Continue?"
7. User confirms
8. World state restored to snapshot
9. localStorage updated
10. Preview mode exits

### Flow 4: Delete Auto-Snapshot

1. User hovers over auto-snapshot
2. Delete button appears
3. User clicks delete
4. Confirmation: "Delete this snapshot?"
5. Snapshot removed from storage
6. Timeline updates

## Error Handling

### localStorage Full

When saving fails due to quota:
1. Attempt aggressive cleanup (keep only 5 auto-snapshots)
2. If still fails, show error: "Storage full. Please delete old snapshots or manual snapshots."
3. Provide link to snapshot management

### Corrupted Snapshot

When loading fails:
1. Log error to console
2. Mark snapshot as corrupted in metadata
3. Show warning icon in timeline
4. Prevent restore action

### Missing Snapshot Data

When metadata exists but full state is missing:
1. Show "Data missing" in timeline
2. Offer to delete the orphaned metadata

## Testing Strategy

### Unit Tests

- SnapshotManager.createSnapshot
- SnapshotManager.shouldCreateSnapshot (all 6 trigger types)
- SnapshotManager.cleanupAutoSnapshots
- Storage read/write operations

### Integration Tests

- Full tick cycle with snapshot creation
- Preview mode state management
- Restore operation correctness

### Manual Testing

- Create 20+ snapshots, verify cleanup
- Fill localStorage, verify error handling
- Restore snapshot, verify world state matches
- Preview mode, verify read-only enforcement

## Implementation Plan

See separate implementation plan document (to be created by writing-plans skill).

## Open Questions

None - all requirements clarified with user.

## Appendix: Trigger Detection Examples

### Agent Death Detection

```typescript
const prevAlive = prevWorld.agents.npcs.filter(a => a.life_status === 'alive')
const nextAlive = nextWorld.agents.npcs.filter(a => a.life_status === 'alive')
if (nextAlive.length < prevAlive.length) {
  return 'agent_death'
}
```

### Tension Climax Detection

```typescript
const tensions = nextWorld.systems.tension?.tensions || {}
for (const tension of Object.values(tensions)) {
  if (tension.status === 'climax') {
    return 'tension_climax'
  }
}
```

### Relationship Change Detection

```typescript
for (const agent of nextWorld.agents.npcs) {
  const prevAgent = prevWorld.agents.npcs.find(a => a.genetics.seed === agent.genetics.seed)
  if (!prevAgent) continue

  for (const [target, value] of Object.entries(agent.relations)) {
    const prevValue = prevAgent.relations[target] || 0
    if (Math.abs(value - prevValue) > 0.5) {
      return 'relationship'
    }
  }
}
```
