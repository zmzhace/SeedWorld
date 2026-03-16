# World Snapshot and Rollback Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a snapshot/rollback system that automatically captures important world moments and allows users to preview and restore previous states.

**Architecture:** Independent module (`snapshot-manager.ts`) that integrates with orchestrator via trigger detection. Metadata and full state stored separately in localStorage. UI panel provides timeline view with preview-before-restore flow.

**Tech Stack:** TypeScript, React, localStorage, Vitest

---

## Chunk 1: Core Data Structures and Storage

### Task 1: Define Snapshot Types

**Files:**
- Create: `src/domain/snapshot.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/snapshot.test.ts
import { describe, it, expect } from 'vitest'
import type { SnapshotTrigger, WorldSnapshot, SnapshotMetadata } from './snapshot'

describe('Snapshot Types', () => {
  it('should define valid snapshot trigger types', () => {
    const triggers: SnapshotTrigger[] = [
      'manual',
      'agent_death',
      'agent_birth',
      'tension_climax',
      'narrative_turn',
      'relationship',
      'resource',
      'world_event'
    ]
    expect(triggers).toHaveLength(8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/domain/snapshot.test.ts`
Expected: FAIL with "Cannot find module './snapshot'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/snapshot.ts
import type { WorldSlice } from './world'

export type SnapshotTrigger =
  | 'manual'
  | 'agent_death'
  | 'agent_birth'
  | 'tension_climax'
  | 'narrative_turn'
  | 'relationship'
  | 'resource'
  | 'world_event'

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/domain/snapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/snapshot.ts src/domain/snapshot.test.ts
git commit -m "feat(snapshot): add snapshot type definitions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 2: Implement Storage Layer

**Files:**
- Create: `src/engine/snapshot-storage.ts`
- Test: `src/engine/snapshot-storage.test.ts`

- [ ] **Step 1: Write the failing test for saveMetadata**

```typescript
// src/engine/snapshot-storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SnapshotStorage } from './snapshot-storage'
import type { SnapshotMetadata } from '@/domain/snapshot'

describe('SnapshotStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should save and load snapshot metadata', () => {
    const worldId = 'test-world'
    const metadata: SnapshotMetadata = {
      id: 'snap-1',
      worldId,
      tick: 10,
      timestamp: '2026-03-16T10:00:00Z',
      trigger: 'manual',
      description: 'Test snapshot',
      thumbnail: {
        agentCount: 5,
        aliveAgentCount: 5,
        narrativeCount: 2,
        eventSummary: 'Test event'
      },
      isManual: true
    }

    SnapshotStorage.saveMetadata(worldId, [metadata])
    const loaded = SnapshotStorage.loadMetadata(worldId)

    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('snap-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: FAIL with "Cannot find module './snapshot-storage'"

- [ ] **Step 3: Write minimal implementation for metadata storage**

```typescript
// src/engine/snapshot-storage.ts
import type { SnapshotMetadata, WorldSnapshot } from '@/domain/snapshot'
import type { WorldSlice } from '@/domain/world'

export class SnapshotStorage {
  private static getMetaKey(worldId: string): string {
    return `world_${worldId}_snapshots_meta`
  }

  private static getSnapshotKey(worldId: string, snapshotId: string): string {
    return `world_${worldId}_snapshot_${snapshotId}`
  }

  static saveMetadata(worldId: string, metadata: SnapshotMetadata[]): void {
    if (typeof window === 'undefined') return
    const key = this.getMetaKey(worldId)
    localStorage.setItem(key, JSON.stringify(metadata))
  }

  static loadMetadata(worldId: string): SnapshotMetadata[] {
    if (typeof window === 'undefined') return []
    const key = this.getMetaKey(worldId)
    const raw = localStorage.getItem(key)
    if (!raw) return []
    try {
      return JSON.parse(raw) as SnapshotMetadata[]
    } catch {
      return []
    }
  }

  static saveSnapshotState(worldId: string, snapshotId: string, state: WorldSlice): void {
    if (typeof window === 'undefined') return
    const key = this.getSnapshotKey(worldId, snapshotId)
    localStorage.setItem(key, JSON.stringify(state))
  }

  static loadSnapshotState(worldId: string, snapshotId: string): WorldSlice | null {
    if (typeof window === 'undefined') return null
    const key = this.getSnapshotKey(worldId, snapshotId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as WorldSlice
    } catch {
      return null
    }
  }

  static deleteSnapshot(worldId: string, snapshotId: string): void {
    if (typeof window === 'undefined') return
    const key = this.getSnapshotKey(worldId, snapshotId)
    localStorage.removeItem(key)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Add test for full snapshot save/load**

```typescript
// Add to src/engine/snapshot-storage.test.ts
it('should save and load full snapshot state', () => {
  const worldId = 'test-world'
  const snapshotId = 'snap-1'
  const worldState = {
    world_id: worldId,
    tick: 10,
    agents: { npcs: [] },
    // ... minimal WorldSlice structure
  } as any

  SnapshotStorage.saveSnapshotState(worldId, snapshotId, worldState)
  const loaded = SnapshotStorage.loadSnapshotState(worldId, snapshotId)

  expect(loaded).not.toBeNull()
  expect(loaded?.tick).toBe(10)
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: PASS

- [ ] **Step 7: Add test for delete operation**

```typescript
// Add to src/engine/snapshot-storage.test.ts
it('should delete snapshot state', () => {
  const worldId = 'test-world'
  const snapshotId = 'snap-1'
  const worldState = { tick: 10 } as any

  SnapshotStorage.saveSnapshotState(worldId, snapshotId, worldState)
  expect(SnapshotStorage.loadSnapshotState(worldId, snapshotId)).not.toBeNull()

  SnapshotStorage.deleteSnapshot(worldId, snapshotId)
  expect(SnapshotStorage.loadSnapshotState(worldId, snapshotId)).toBeNull()
})
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/engine/snapshot-storage.ts src/engine/snapshot-storage.test.ts
git commit -m "feat(snapshot): add localStorage storage layer

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Chunk 2: Snapshot Manager Core Logic

### Task 3: Implement createSnapshot

**Files:**
- Create: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/engine/snapshot-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SnapshotManager } from './snapshot-manager'
import type { WorldSlice } from '@/domain/world'

describe('SnapshotManager', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should create snapshot with correct metadata', () => {
    const world: WorldSlice = {
      world_id: 'test-world',
      tick: 42,
      agents: {
        npcs: [
          { life_status: 'alive', genetics: { seed: 'a1' } },
          { life_status: 'alive', genetics: { seed: 'a2' } },
          { life_status: 'dead', genetics: { seed: 'a3' } }
        ]
      },
      narratives: { patterns: [{}, {}] },
      events: [{ id: 'e1', type: 'test', timestamp: '2026-03-16T10:00:00Z', payload: {} }]
    } as any

    const snapshot = SnapshotManager.createSnapshot(world, 'manual', 'Test label')

    expect(snapshot.worldId).toBe('test-world')
    expect(snapshot.tick).toBe(42)
    expect(snapshot.trigger).toBe('manual')
    expect(snapshot.label).toBe('Test label')
    expect(snapshot.isManual).toBe(true)
    expect(snapshot.thumbnail.agentCount).toBe(3)
    expect(snapshot.thumbnail.aliveAgentCount).toBe(2)
    expect(snapshot.thumbnail.narrativeCount).toBe(2)
    expect(snapshot.worldState).toBe(world)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "Cannot find module './snapshot-manager'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/engine/snapshot-manager.ts
import type { WorldSlice } from '@/domain/world'
import type { SnapshotTrigger, WorldSnapshot, SnapshotMetadata } from '@/domain/snapshot'
import { SnapshotStorage } from './snapshot-storage'

export class SnapshotManager {
  static createSnapshot(
    world: WorldSlice,
    trigger: SnapshotTrigger,
    label?: string
  ): WorldSnapshot {
    const id = `snapshot-${world.world_id}-${world.tick}-${Date.now()}`
    const timestamp = new Date().toISOString()

    const agentCount = world.agents.npcs.length
    const aliveAgentCount = world.agents.npcs.filter(a => a.life_status === 'alive').length
    const narrativeCount = world.narratives?.patterns?.length || 0
    const recentEvent = world.events[world.events.length - 1]
    const eventSummary = recentEvent
      ? `${recentEvent.type} at tick ${world.tick}`
      : `Tick ${world.tick}`

    const description = this.generateDescription(trigger, world, label)

    return {
      id,
      worldId: world.world_id,
      tick: world.tick,
      timestamp,
      trigger,
      label,
      description,
      worldState: world,
      thumbnail: {
        agentCount,
        aliveAgentCount,
        narrativeCount,
        eventSummary
      },
      isManual: trigger === 'manual'
    }
  }

  private static generateDescription(
    trigger: SnapshotTrigger,
    world: WorldSlice,
    label?: string
  ): string {
    if (label) return label

    const triggerDescriptions: Record<SnapshotTrigger, string> = {
      manual: 'Manual snapshot',
      agent_death: 'Agent death detected',
      agent_birth: 'New agent born',
      tension_climax: 'Dramatic tension climax',
      narrative_turn: 'Narrative turning point',
      relationship: 'Significant relationship change',
      resource: 'Resource event',
      world_event: 'World event occurred'
    }

    return `${triggerDescriptions[trigger]} at tick ${world.tick}`
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement createSnapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 4: Implement saveSnapshot and listSnapshots

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should save and list snapshots', () => {
  const world: WorldSlice = {
    world_id: 'test-world',
    tick: 10,
    agents: { npcs: [] },
    narratives: { patterns: [] },
    events: []
  } as any

  const snapshot = SnapshotManager.createSnapshot(world, 'manual')
  SnapshotManager.saveSnapshot(snapshot)

  const list = SnapshotManager.listSnapshots('test-world')
  expect(list).toHaveLength(1)
  expect(list[0].id).toBe(snapshot.id)
  expect(list[0].worldState).toBeUndefined() // metadata only
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "SnapshotManager.saveSnapshot is not a function"

- [ ] **Step 3: Implement saveSnapshot and listSnapshots**

```typescript
// Add to src/engine/snapshot-manager.ts
static saveSnapshot(snapshot: WorldSnapshot): void {
  const { worldState, ...metadata } = snapshot

  // Load existing metadata
  const existing = SnapshotStorage.loadMetadata(snapshot.worldId)

  // Add new metadata
  const updated = [...existing, metadata]

  // Save metadata and full state
  SnapshotStorage.saveMetadata(snapshot.worldId, updated)
  SnapshotStorage.saveSnapshotState(snapshot.worldId, snapshot.id, worldState)
}

static listSnapshots(worldId: string): SnapshotMetadata[] {
  return SnapshotStorage.loadMetadata(worldId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement saveSnapshot and listSnapshots

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 5: Implement loadSnapshot

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should load full snapshot', () => {
  const world: WorldSlice = {
    world_id: 'test-world',
    tick: 10,
    agents: { npcs: [] }
  } as any

  const snapshot = SnapshotManager.createSnapshot(world, 'manual')
  SnapshotManager.saveSnapshot(snapshot)

  const loaded = SnapshotManager.loadSnapshot('test-world', snapshot.id)
  expect(loaded).not.toBeNull()
  expect(loaded?.worldState.tick).toBe(10)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "SnapshotManager.loadSnapshot is not a function"

- [ ] **Step 3: Implement loadSnapshot**

```typescript
// Add to src/engine/snapshot-manager.ts
static loadSnapshot(worldId: string, snapshotId: string): WorldSnapshot | null {
  const metadata = SnapshotStorage.loadMetadata(worldId)
  const meta = metadata.find(m => m.id === snapshotId)
  if (!meta) return null

  const worldState = SnapshotStorage.loadSnapshotState(worldId, snapshotId)
  if (!worldState) return null

  return {
    ...meta,
    worldState
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement loadSnapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 6: Implement deleteSnapshot

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should delete auto-snapshot but not manual snapshot', () => {
  const world: WorldSlice = { world_id: 'test-world', tick: 10 } as any

  const autoSnap = SnapshotManager.createSnapshot(world, 'agent_death')
  const manualSnap = SnapshotManager.createSnapshot(world, 'manual')

  SnapshotManager.saveSnapshot(autoSnap)
  SnapshotManager.saveSnapshot(manualSnap)

  // Should delete auto-snapshot
  const deleted1 = SnapshotManager.deleteSnapshot('test-world', autoSnap.id)
  expect(deleted1).toBe(true)
  expect(SnapshotManager.loadSnapshot('test-world', autoSnap.id)).toBeNull()

  // Should NOT delete manual snapshot
  const deleted2 = SnapshotManager.deleteSnapshot('test-world', manualSnap.id)
  expect(deleted2).toBe(false)
  expect(SnapshotManager.loadSnapshot('test-world', manualSnap.id)).not.toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "SnapshotManager.deleteSnapshot is not a function"

- [ ] **Step 3: Implement deleteSnapshot**

```typescript
// Add to src/engine/snapshot-manager.ts
static deleteSnapshot(worldId: string, snapshotId: string): boolean {
  const metadata = SnapshotStorage.loadMetadata(worldId)
  const snap = metadata.find(m => m.id === snapshotId)

  // Cannot delete manual snapshots
  if (!snap || snap.isManual) return false

  // Remove from metadata
  const updated = metadata.filter(m => m.id !== snapshotId)
  SnapshotStorage.saveMetadata(worldId, updated)

  // Remove full state
  SnapshotStorage.deleteSnapshot(worldId, snapshotId)

  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement deleteSnapshot with manual protection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 7: Implement cleanupAutoSnapshots

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should cleanup old auto-snapshots but keep manual ones', () => {
  const world: WorldSlice = { world_id: 'test-world', tick: 10 } as any

  // Create 12 auto-snapshots
  for (let i = 0; i < 12; i++) {
    const snap = SnapshotManager.createSnapshot(world, 'agent_death')
    SnapshotManager.saveSnapshot(snap)
  }

  // Create 2 manual snapshots
  const manual1 = SnapshotManager.createSnapshot(world, 'manual')
  const manual2 = SnapshotManager.createSnapshot(world, 'manual')
  SnapshotManager.saveSnapshot(manual1)
  SnapshotManager.saveSnapshot(manual2)

  // Cleanup: keep 10 auto-snapshots
  SnapshotManager.cleanupAutoSnapshots('test-world', 10)

  const remaining = SnapshotManager.listSnapshots('test-world')
  const autoSnaps = remaining.filter(s => !s.isManual)
  const manualSnaps = remaining.filter(s => s.isManual)

  expect(autoSnaps).toHaveLength(10)
  expect(manualSnaps).toHaveLength(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "SnapshotManager.cleanupAutoSnapshots is not a function"

- [ ] **Step 3: Implement cleanupAutoSnapshots**

```typescript
// Add to src/engine/snapshot-manager.ts
static cleanupAutoSnapshots(worldId: string, keepCount: number): void {
  const metadata = SnapshotStorage.loadMetadata(worldId)

  // Separate auto and manual snapshots
  const autoSnaps = metadata.filter(m => !m.isManual)
  const manualSnaps = metadata.filter(m => m.isManual)

  // Sort auto-snapshots by timestamp descending (newest first)
  autoSnaps.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Keep only the most recent N auto-snapshots
  const toKeep = autoSnaps.slice(0, keepCount)
  const toDelete = autoSnaps.slice(keepCount)

  // Delete old auto-snapshots
  for (const snap of toDelete) {
    SnapshotStorage.deleteSnapshot(worldId, snap.id)
  }

  // Save updated metadata (kept auto + all manual)
  const updated = [...toKeep, ...manualSnaps]
  SnapshotStorage.saveMetadata(worldId, updated)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement cleanupAutoSnapshots

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Chunk 3: Trigger Detection Logic

### Task 8: Implement shouldCreateSnapshot - Agent Death/Birth

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test for agent death detection**

```typescript
// Add to src/engine/snapshot-manager.test.ts
describe('shouldCreateSnapshot', () => {
  it('should detect agent death', () => {
    const prevWorld: WorldSlice = {
      agents: {
        npcs: [
          { genetics: { seed: 'a1' }, life_status: 'alive' },
          { genetics: { seed: 'a2' }, life_status: 'alive' }
        ]
      }
    } as any

    const nextWorld: WorldSlice = {
      agents: {
        npcs: [
          { genetics: { seed: 'a1' }, life_status: 'alive' },
          { genetics: { seed: 'a2' }, life_status: 'dead' }
        ]
      }
    } as any

    const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
    expect(trigger).toBe('agent_death')
  })

  it('should detect agent birth', () => {
    const prevWorld: WorldSlice = {
      agents: { npcs: [{ genetics: { seed: 'a1' } }] }
    } as any

    const nextWorld: WorldSlice = {
      agents: { npcs: [{ genetics: { seed: 'a1' } }, { genetics: { seed: 'a2' } }] }
    } as any

    const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
    expect(trigger).toBe('agent_birth')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL with "SnapshotManager.shouldCreateSnapshot is not a function"

- [ ] **Step 3: Implement shouldCreateSnapshot with agent death/birth detection**

```typescript
// Add to src/engine/snapshot-manager.ts
static shouldCreateSnapshot(
  prevWorld: WorldSlice,
  nextWorld: WorldSlice
): SnapshotTrigger | null {
  // 1. Agent death
  const prevAlive = prevWorld.agents.npcs.filter(a => a.life_status === 'alive')
  const nextAlive = nextWorld.agents.npcs.filter(a => a.life_status === 'alive')
  if (nextAlive.length < prevAlive.length) {
    return 'agent_death'
  }

  // 2. Agent birth
  if (nextWorld.agents.npcs.length > prevWorld.agents.npcs.length) {
    return 'agent_birth'
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): implement agent death/birth trigger detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 9: Add Tension Climax Detection

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should detect tension climax', () => {
  const prevWorld: WorldSlice = {
    agents: { npcs: [] },
    systems: {
      tension: {
        tensions: {
          't1': { status: 'developing' }
        }
      }
    }
  } as any

  const nextWorld: WorldSlice = {
    agents: { npcs: [] },
    systems: {
      tension: {
        tensions: {
          't1': { status: 'climax' }
        }
      }
    }
  } as any

  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  expect(trigger).toBe('tension_climax')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL (returns null instead of 'tension_climax')

- [ ] **Step 3: Add tension climax detection**

```typescript
// Modify shouldCreateSnapshot in src/engine/snapshot-manager.ts
// Add after agent birth check:

// 3. Tension climax
const tensions = nextWorld.systems?.tension?.tensions || {}
for (const tension of Object.values(tensions)) {
  if ((tension as any).status === 'climax') {
    return 'tension_climax'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): add tension climax trigger detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 10: Add Relationship Change Detection

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should detect significant relationship change', () => {
  const prevWorld: WorldSlice = {
    agents: {
      npcs: [
        {
          genetics: { seed: 'a1' },
          life_status: 'alive',
          relations: { 'a2': 0.2 }
        }
      ]
    }
  } as any

  const nextWorld: WorldSlice = {
    agents: {
      npcs: [
        {
          genetics: { seed: 'a1' },
          life_status: 'alive',
          relations: { 'a2': 0.8 }
        }
      ]
    }
  } as any

  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  expect(trigger).toBe('relationship')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL (returns null instead of 'relationship')

- [ ] **Step 3: Add relationship change detection**

```typescript
// Modify shouldCreateSnapshot in src/engine/snapshot-manager.ts
// Add after tension climax check:

// 4. Relationship change
for (const agent of nextWorld.agents.npcs) {
  const prevAgent = prevWorld.agents.npcs.find(a => a.genetics.seed === agent.genetics.seed)
  if (!prevAgent) continue

  for (const [target, value] of Object.entries(agent.relations)) {
    const prevValue = prevAgent.relations[target] || 0
    const numValue = typeof value === 'number' ? value : 0
    if (Math.abs(numValue - prevValue) > 0.5) {
      return 'relationship'
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): add relationship change trigger detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 11: Add Resource and World Event Detection

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should detect resource event', () => {
  const prevWorld: WorldSlice = {
    agents: { npcs: [] },
    systems: {
      resources: {
        resources: { 'r1': { id: 'r1' } }
      }
    }
  } as any

  const nextWorld: WorldSlice = {
    agents: { npcs: [] },
    systems: {
      resources: {
        resources: { 'r1': { id: 'r1' }, 'r2': { id: 'r2' } }
      }
    }
  } as any

  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  expect(trigger).toBe('resource')
})

it('should detect world event', () => {
  const prevWorld: WorldSlice = {
    agents: { npcs: [] },
    events: []
  } as any

  const nextWorld: WorldSlice = {
    agents: { npcs: [] },
    events: [
      {
        id: 'e1',
        type: 'social',
        timestamp: '2026-03-16T10:00:00Z',
        payload: { source: 'user_chat' }
      }
    ]
  } as any

  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  expect(trigger).toBe('world_event')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL (returns null instead of 'resource' or 'world_event')

- [ ] **Step 3: Add resource and world event detection**

```typescript
// Modify shouldCreateSnapshot in src/engine/snapshot-manager.ts
// Add after relationship check:

// 5. Resource event
const prevResources = Object.keys(prevWorld.systems?.resources?.resources || {})
const nextResources = Object.keys(nextWorld.systems?.resources?.resources || {})
if (nextResources.length !== prevResources.length) {
  return 'resource'
}

// 6. World event (user-triggered)
const newEvents = nextWorld.events.slice(prevWorld.events.length)
for (const event of newEvents) {
  const payload = event.payload as Record<string, unknown> | undefined
  if (payload?.source === 'user_chat') {
    return 'world_event'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): add resource and world event trigger detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 12: Add Narrative Turn Detection

**Files:**
- Modify: `src/engine/snapshot-manager.ts`
- Test: `src/engine/snapshot-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-manager.test.ts
it('should detect narrative turning point', () => {
  const prevWorld: WorldSlice = {
    agents: { npcs: [] },
    narratives: {
      patterns: [
        { id: 'n1', turning_points: ['e1'] }
      ]
    }
  } as any

  const nextWorld: WorldSlice = {
    agents: { npcs: [] },
    narratives: {
      patterns: [
        { id: 'n1', turning_points: ['e1', 'e2'] }
      ]
    }
  } as any

  const trigger = SnapshotManager.shouldCreateSnapshot(prevWorld, nextWorld)
  expect(trigger).toBe('narrative_turn')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: FAIL (returns null instead of 'narrative_turn')

- [ ] **Step 3: Add narrative turn detection**

```typescript
// Modify shouldCreateSnapshot in src/engine/snapshot-manager.ts
// Add after world event check:

// 7. Narrative turning point
const prevPatterns = prevWorld.narratives?.patterns || []
const nextPatterns = nextWorld.narratives?.patterns || []

for (const nextPattern of nextPatterns) {
  const prevPattern = prevPatterns.find(p => (p as any).id === (nextPattern as any).id)
  if (!prevPattern) continue

  const prevTurns = (prevPattern as any).turning_points?.length || 0
  const nextTurns = (nextPattern as any).turning_points?.length || 0

  if (nextTurns > prevTurns) {
    return 'narrative_turn'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/snapshot-manager.ts src/engine/snapshot-manager.test.ts
git commit -m "feat(snapshot): add narrative turn trigger detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Chunk 4: Orchestrator Integration and UI

### Task 13: Integrate with Orchestrator

**Files:**
- Modify: `src/engine/orchestrator.ts`
- Test: `src/engine/orchestrator.test.ts` (add snapshot integration test)

- [ ] **Step 1: Write the failing integration test**

```typescript
// Add to src/engine/orchestrator.test.ts
import { SnapshotManager } from './snapshot-manager'

describe('Orchestrator Snapshot Integration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should create snapshot when agent dies', async () => {
    const world: WorldSlice = {
      world_id: 'test-world',
      tick: 10,
      agents: {
        npcs: [
          { genetics: { seed: 'a1' }, life_status: 'alive' }
        ]
      }
    } as any

    // Simulate agent death in next tick
    const nextWorld = await runWorldTick(world, { directorRegistry: { runAll: async () => [] } })

    // Manually set agent to dead for test
    nextWorld.agents.npcs[0].life_status = 'dead'

    const snapshots = SnapshotManager.listSnapshots('test-world')
    expect(snapshots.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/orchestrator.test.ts`
Expected: FAIL (no snapshots created)

- [ ] **Step 3: Add snapshot detection to orchestrator**

```typescript
// Modify src/engine/orchestrator.ts
// Add import at top (around line 30):
import { SnapshotManager } from './snapshot-manager'

// In runWorldTick function, find the final return statement (around line 400+)
// Add snapshot detection BEFORE the return statement, after all systems have been updated:

// Snapshot detection (add before "return nextWorld")
const trigger = SnapshotManager.shouldCreateSnapshot(world, nextWorld)
if (trigger) {
  const snapshot = SnapshotManager.createSnapshot(nextWorld, trigger)
  SnapshotManager.saveSnapshot(snapshot)
  SnapshotManager.cleanupAutoSnapshots(nextWorld.world_id, 10)
}

return nextWorld
```

Note: Insert this after all system updates (reputation, tension, etc.) but before returning nextWorld.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/orchestrator.ts src/engine/orchestrator.test.ts
git commit -m "feat(snapshot): integrate snapshot detection into orchestrator

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 14: Create Snapshot Panel UI

**Files:**
- Create: `src/components/panel/snapshot-panel.tsx`

- [ ] **Step 1: Create basic panel structure**

```typescript
// src/components/panel/snapshot-panel.tsx
'use client'

import React from 'react'
import type { WorldSlice } from '@/domain/world'
import type { SnapshotMetadata } from '@/domain/snapshot'
import { SnapshotManager } from '@/engine/snapshot-manager'
import { Camera, Star, Trash2, Eye } from 'lucide-react'

type SnapshotPanelProps = {
  world: WorldSlice
  onPreview: (snapshotId: string) => void
}

export function SnapshotPanel({ world, onPreview }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = React.useState<SnapshotMetadata[]>([])
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    const list = SnapshotManager.listSnapshots(world.world_id)
    setSnapshots(list.sort((a, b) => b.tick - a.tick))
  }, [world.world_id, world.tick])

  const handleCreateManual = () => {
    setCreating(true)
    const snapshot = SnapshotManager.createSnapshot(world, 'manual')
    SnapshotManager.saveSnapshot(snapshot)
    setSnapshots(prev => [snapshot, ...prev])
    setCreating(false)
  }

  const handleDelete = (snapshotId: string) => {
    if (confirm('Delete this snapshot?')) {
      SnapshotManager.deleteSnapshot(world.world_id, snapshotId)
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId))
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Snapshots</h3>
        <button
          onClick={handleCreateManual}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Create Snapshot
        </button>
      </div>

      <div className="space-y-2">
        {snapshots.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            No snapshots yet. Create one to save the current world state.
          </div>
        )}

        {snapshots.map(snapshot => (
          <SnapshotCard
            key={snapshot.id}
            snapshot={snapshot}
            onPreview={() => onPreview(snapshot.id)}
            onDelete={() => handleDelete(snapshot.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SnapshotCard({
  snapshot,
  onPreview,
  onDelete
}: {
  snapshot: SnapshotMetadata
  onPreview: () => void
  onDelete: () => void
}) {
  const triggerColors: Record<string, string> = {
    manual: 'bg-blue-50 text-blue-700 border-blue-200',
    agent_death: 'bg-red-50 text-red-700 border-red-200',
    agent_birth: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    tension_climax: 'bg-purple-50 text-purple-700 border-purple-200',
    narrative_turn: 'bg-amber-50 text-amber-700 border-amber-200',
    relationship: 'bg-pink-50 text-pink-700 border-pink-200',
    resource: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    world_event: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }

  const colorClass = triggerColors[snapshot.trigger] || 'bg-slate-50 text-slate-700 border-slate-200'

  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {snapshot.isManual && <Star className="h-3.5 w-3.5 fill-current" />}
            <span className="text-sm font-semibold">Tick {snapshot.tick}</span>
            <span className="text-xs opacity-75">{snapshot.trigger.replace('_', ' ')}</span>
          </div>
          <p className="mt-1 text-xs opacity-90">{snapshot.description}</p>
          <div className="mt-2 flex gap-3 text-xs opacity-75">
            <span>{snapshot.thumbnail.aliveAgentCount}/{snapshot.thumbnail.agentCount} agents</span>
            <span>{snapshot.thumbnail.narrativeCount} narratives</span>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={onPreview}
            className="rounded p-1.5 transition-colors hover:bg-black/10"
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>
          {!snapshot.isManual && (
            <button
              onClick={onDelete}
              className="rounded p-1.5 transition-colors hover:bg-black/10"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test UI manually**

1. Start dev server: `npm run dev`
2. Navigate to a world page
3. Add SnapshotPanel to the tabs
4. Verify snapshots list appears
5. Click "Create Snapshot" - verify new snapshot appears
6. Verify manual snapshots have star icon
7. Verify auto-snapshots have delete button

- [ ] **Step 3: Commit**

```bash
git add src/components/panel/snapshot-panel.tsx
git commit -m "feat(snapshot): add snapshot panel UI component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 15: Add Snapshot Tab to World Page

**Files:**
- Modify: `app/worlds/[id]/page.tsx`

- [ ] **Step 1: Import SnapshotPanel and Camera icon**

```typescript
// Add to imports in app/worlds/[id]/page.tsx
import { SnapshotPanel } from '@/components/panel/snapshot-panel'
import { Camera } from 'lucide-react' // Add Camera to existing lucide-react import
```

- [ ] **Step 2: Add snapshot tab to TABS array**

```typescript
// Modify TABS array in app/worlds/[id]/page.tsx (around line 36)
const TABS = [
  { key: 'world', label: 'World', icon: Globe },
  { key: 'observer', label: 'Agents', icon: Users },
  { key: 'agents', label: 'Create', icon: UserPlus },
  { key: 'snapshots', label: 'Snapshots', icon: Camera }, // ADD THIS
  { key: 'narratives', label: 'Narrative', icon: BookOpen },
  // ... rest of tabs
] as const
```

- [ ] **Step 3: Remove TODO from snapshot panel**

```typescript
// Modify tab content section in app/worlds/[id]/page.tsx (around line 380)
// Replace the TODO version with actual handler
{activeTab === 'snapshots' && (
  <SnapshotPanel
    world={world}
    onPreview={handlePreviewSnapshot}
  />
)}
```

Note: handlePreviewSnapshot will be implemented in Task 16.

- [ ] **Step 4: Test manually**

1. Reload world page
2. Verify "Snapshots" tab appears
3. Click tab - verify panel loads
4. Create a snapshot - verify it appears in list

- [ ] **Step 5: Commit**

```bash
git add app/worlds/[id]/page.tsx
git commit -m "feat(snapshot): add snapshots tab to world page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 16: Implement Preview Mode

**Files:**
- Modify: `app/worlds/[id]/page.tsx`

- [ ] **Step 1: Add preview state and import**

```typescript
// Add to imports in app/worlds/[id]/page.tsx
import { Eye } from 'lucide-react' // Add Eye to existing lucide-react import
import { SnapshotManager } from '@/engine/snapshot-manager'
import type { WorldSnapshot } from '@/domain/snapshot'

// Add to state declarations (around line 56)
const [previewSnapshot, setPreviewSnapshot] = React.useState<WorldSnapshot | null>(null)
```

- [ ] **Step 2: Implement preview handlers**

```typescript
// Add functions in app/worlds/[id]/page.tsx (after handleAdvanceTime function)
const handlePreviewSnapshot = (snapshotId: string) => {
  const snapshot = SnapshotManager.loadSnapshot(worldId, snapshotId)
  if (snapshot) {
    setPreviewSnapshot(snapshot)
    setWorld(snapshot.worldState)
  }
}

const handleCancelPreview = () => {
  if (previewSnapshot) {
    // Reload current world from localStorage (same key used in line 89 and 121)
    const savedWorld = localStorage.getItem(`world_${worldId}`)
    if (savedWorld) {
      setWorld(JSON.parse(savedWorld))
    }
  }
  setPreviewSnapshot(null)
}

const handleConfirmRestore = () => {
  if (previewSnapshot && confirm('This will replace the current world state. Continue?')) {
    // Save restored state to localStorage (same key used throughout the file)
    localStorage.setItem(`world_${worldId}`, JSON.stringify(previewSnapshot.worldState))
    setWorld(previewSnapshot.worldState)
    setPreviewSnapshot(null)
  }
}
```

- [ ] **Step 3: Update SnapshotPanel to use handler**

```typescript
// This was already done in Task 15 Step 3 - verify it uses handlePreviewSnapshot
// Location: app/worlds/[id]/page.tsx around line 380
{activeTab === 'snapshots' && (
  <SnapshotPanel
    world={world}
    onPreview={handlePreviewSnapshot}
  />
)}
```

- [ ] **Step 4: Add preview mode banner**

```typescript
// Add after header (after line 329), before main content in app/worlds/[id]/page.tsx
// Insert between </div> closing the header and <div className="mx-auto max-w-7xl p-6">
{previewSnapshot && (
  <div className="sticky top-16 z-10 border-b border-amber-200 bg-amber-50 px-6 py-3">
    <div className="mx-auto max-w-7xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 text-amber-600" />
        <div>
          <div className="font-semibold text-amber-900">
            Preview Mode - Tick {previewSnapshot.tick}
          </div>
          <div className="text-sm text-amber-700">
            {previewSnapshot.description}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCancelPreview}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50"
        >
          Cancel Preview
        </button>
        <button
          onClick={handleConfirmRestore}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Confirm Restore
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Disable tick actions in preview mode**

```typescript
// Modify tick control buttons in app/worlds/[id]/page.tsx
// Find the auto-advance toggle button (around line 300) and single tick button (around line 318)
// Update their disabled prop:

// Auto-advance button:
disabled={!world || world.agents.npcs.length === 0 || advancing || previewSnapshot !== null}

// Single tick button:
disabled={advancing || !world || world.agents.npcs.length === 0 || autoAdvancing || previewSnapshot !== null}
```

- [ ] **Step 6: Test manually**

1. Create a snapshot at tick 10
2. Advance to tick 15
3. Click "Preview" on tick 10 snapshot
4. Verify banner appears
5. Verify world view shows tick 10 state
6. Verify tick buttons are disabled
7. Click "Cancel Preview" - verify returns to tick 15
8. Preview again, click "Confirm Restore" - verify world restored to tick 10

- [ ] **Step 7: Commit**

```bash
git add app/worlds/[id]/page.tsx
git commit -m "feat(snapshot): implement preview mode with restore confirmation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 17: Add Error Handling for Storage Quota

**Files:**
- Modify: `src/engine/snapshot-storage.ts`
- Test: `src/engine/snapshot-storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/engine/snapshot-storage.test.ts
it('should handle localStorage quota exceeded', () => {
  const worldId = 'test-world'
  const snapshotId = 'snap-1'

  // Mock localStorage.setItem to throw quota error
  const originalSetItem = localStorage.setItem
  localStorage.setItem = vi.fn(() => {
    throw new DOMException('QuotaExceededError')
  })

  expect(() => {
    SnapshotStorage.saveSnapshotState(worldId, snapshotId, { tick: 10 } as any)
  }).toThrow('Storage quota exceeded')

  localStorage.setItem = originalSetItem
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: FAIL (no error thrown)

- [ ] **Step 3: Add error handling**

```typescript
// Modify src/engine/snapshot-storage.ts
static saveSnapshotState(worldId: string, snapshotId: string, state: WorldSlice): void {
  if (typeof window === 'undefined') return
  const key = this.getSnapshotKey(worldId, snapshotId)
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old snapshots.')
    }
    throw error
  }
}

static saveMetadata(worldId: string, metadata: SnapshotMetadata[]): void {
  if (typeof window === 'undefined') return
  const key = this.getMetaKey(worldId)
  try {
    localStorage.setItem(key, JSON.stringify(metadata))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old snapshots.')
    }
    throw error
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/snapshot-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Add UI error handling**

```typescript
// Modify handleCreateManual in src/components/panel/snapshot-panel.tsx
const handleCreateManual = () => {
  setCreating(true)
  try {
    const snapshot = SnapshotManager.createSnapshot(world, 'manual')
    SnapshotManager.saveSnapshot(snapshot)
    setSnapshots(prev => [snapshot, ...prev])
  } catch (error) {
    alert((error as Error).message)
  } finally {
    setCreating(false)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/snapshot-storage.ts src/engine/snapshot-storage.test.ts src/components/panel/snapshot-panel.tsx
git commit -m "feat(snapshot): add error handling for storage quota exceeded

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 18: Final Integration Test

**Files:**
- Create: `src/engine/snapshot-integration.test.ts`

- [ ] **Step 1: Write end-to-end integration test**

```typescript
// src/engine/snapshot-integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SnapshotManager } from './snapshot-manager'
import { runWorldTick } from './orchestrator'
import type { WorldSlice } from '@/domain/world'

describe('Snapshot Integration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should complete full snapshot lifecycle', async () => {
    // 1. Create initial world
    const world: WorldSlice = {
      world_id: 'integration-test',
      tick: 0,
      agents: {
        npcs: [
          { genetics: { seed: 'a1' }, life_status: 'alive' }
        ]
      }
    } as any

    // 2. Create manual snapshot
    const manual = SnapshotManager.createSnapshot(world, 'manual', 'Initial state')
    SnapshotManager.saveSnapshot(manual)

    // 3. Verify snapshot saved
    const list1 = SnapshotManager.listSnapshots('integration-test')
    expect(list1).toHaveLength(1)
    expect(list1[0].isManual).toBe(true)

    // 4. Load snapshot
    const loaded = SnapshotManager.loadSnapshot('integration-test', manual.id)
    expect(loaded).not.toBeNull()
    expect(loaded?.worldState.tick).toBe(0)

    // 5. Create auto-snapshot
    const auto = SnapshotManager.createSnapshot(world, 'agent_death')
    SnapshotManager.saveSnapshot(auto)

    // 6. Verify both snapshots exist
    const list2 = SnapshotManager.listSnapshots('integration-test')
    expect(list2).toHaveLength(2)

    // 7. Delete auto-snapshot
    const deleted = SnapshotManager.deleteSnapshot('integration-test', auto.id)
    expect(deleted).toBe(true)

    // 8. Verify manual snapshot remains
    const list3 = SnapshotManager.listSnapshots('integration-test')
    expect(list3).toHaveLength(1)
    expect(list3[0].id).toBe(manual.id)

    // 9. Try to delete manual snapshot (should fail)
    const deletedManual = SnapshotManager.deleteSnapshot('integration-test', manual.id)
    expect(deletedManual).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test src/engine/snapshot-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/snapshot-integration.test.ts
git commit -m "test(snapshot): add end-to-end integration test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 4: Run snapshot tests**

Run: `npm test -- snapshot`
Expected: All snapshot-related tests PASS

Note: Pre-existing type errors in other files (attention-mechanism, cognitive-bias-system, dramatic-tension-system) are documented in MEMORY.md and not related to snapshot implementation.

- [ ] **Step 5: Final commit and push**

```bash
git push
```

---

## Implementation Complete

All tasks completed! The snapshot/rollback system is now fully implemented with:

✅ Core data structures and storage layer
✅ Snapshot manager with create/save/load/delete/cleanup
✅ Trigger detection for all 6 event types
✅ Orchestrator integration
✅ UI panel with timeline view
✅ Preview mode with restore confirmation
✅ Error handling for storage quota
✅ Comprehensive test coverage

**Next Steps:**
- Test manually with real world simulations
- Monitor localStorage usage
- Consider IndexedDB migration if needed
- Add snapshot export/import feature (future enhancement)

