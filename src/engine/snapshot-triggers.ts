import type { WorldSlice } from '../domain/world';

/**
 * Trigger detection result
 */
export interface TriggerResult {
  trigger: 'agent_death' | 'agent_birth' | 'tension_climax' | null;
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

/**
 * Detects dramatic tension climax when tension crosses 0.8 threshold from below
 */
export function detectTensionClimax(
  prevWorld: WorldSlice,
  currentWorld: WorldSlice
): TriggerResult {
  const prevTension = prevWorld.systems.dramaticTension.globalTension;
  const currentTension = currentWorld.systems.dramaticTension.globalTension;

  if (prevTension < 0.8 && currentTension >= 0.8) {
    return {
      trigger: 'tension_climax',
      description: 'Dramatic tension peaked',
    };
  }

  return {
    trigger: null,
  };
}
