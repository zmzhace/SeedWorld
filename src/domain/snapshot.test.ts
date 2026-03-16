import { describe, it, expect, expectTypeOf } from 'vitest';
import type { SnapshotTrigger, WorldSnapshot, SnapshotMetadata } from './snapshot';
import type { WorldSlice } from './world';

describe('Snapshot Types', () => {
  it('should accept all valid SnapshotTrigger values', () => {
    const validTriggers: SnapshotTrigger[] = [
      'manual',
      'agent_death',
      'agent_birth',
      'tension_climax',
      'narrative_turn',
      'relationship',
      'resource',
      'world_event',
    ];

    // Type check - if this compiles, the union type is correct
    validTriggers.forEach((trigger) => {
      expect(typeof trigger).toBe('string');
    });

    expect(validTriggers).toHaveLength(8);
  });

  it('should define WorldSnapshot with all required fields', () => {
    expectTypeOf<WorldSnapshot>().toHaveProperty('id');
    expectTypeOf<WorldSnapshot>().toHaveProperty('worldId');
    expectTypeOf<WorldSnapshot>().toHaveProperty('tick');
    expectTypeOf<WorldSnapshot>().toHaveProperty('timestamp');
    expectTypeOf<WorldSnapshot>().toHaveProperty('trigger');
    expectTypeOf<WorldSnapshot>().toHaveProperty('description');
    expectTypeOf<WorldSnapshot>().toHaveProperty('worldState');
    expectTypeOf<WorldSnapshot>().toHaveProperty('thumbnail');
    expectTypeOf<WorldSnapshot>().toHaveProperty('isManual');
  });

  it('should define SnapshotMetadata without worldState', () => {
    expectTypeOf<SnapshotMetadata>().toHaveProperty('id');
    expectTypeOf<SnapshotMetadata>().toHaveProperty('worldId');
    expectTypeOf<SnapshotMetadata>().not.toHaveProperty('worldState');
  });
});
