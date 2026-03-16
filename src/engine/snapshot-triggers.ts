import type { WorldSlice } from '../domain/world';

/**
 * Trigger detection result
 */
export interface TriggerResult {
  trigger: 'agent_death' | 'agent_birth' | null;
  description?: string;
}

/**
 * Detects agent death or birth by comparing agent counts between two world states
 */
export function detectAgentDeathOrBirth(
  prevWorld: WorldSlice,
  currentWorld: WorldSlice
): TriggerResult {
  const prevCount = prevWorld.agents.npcs.length;
  const currentCount = currentWorld.agents.npcs.length;

  if (currentCount < prevCount) {
    return {
      trigger: 'agent_death',
      description: 'Agent died',
    };
  }

  if (currentCount > prevCount) {
    return {
      trigger: 'agent_birth',
      description: 'Agent born',
    };
  }

  return {
    trigger: null,
  };
}
