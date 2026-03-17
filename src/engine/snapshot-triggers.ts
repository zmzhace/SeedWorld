import type { WorldSlice } from '../domain/world';

/**
 * Trigger detection result
 */
export interface TriggerResult {
  trigger: 'agent_death' | 'agent_birth' | 'tension_climax' | 'narrative_turn' | 'relationship' | 'resource' | null;
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
  const prevTension = readGlobalTension(prevWorld);
  const currentTension = readGlobalTension(currentWorld);

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

function readGlobalTension(world: WorldSlice): number {
  return world.systems.tension?.globalTension
    ?? (world.systems as { dramaticTension?: { globalTension?: number } }).dramaticTension?.globalTension
    ?? 0;
}

/**
 * Detects narrative turning point when new narrative patterns appear
 */
export function detectNarrativeTurn(
  prevWorld: WorldSlice,
  currentWorld: WorldSlice
): TriggerResult {
  const prevCount = prevWorld.narratives.patterns.length;
  const currentCount = currentWorld.narratives.patterns.length;

  if (currentCount > prevCount) {
    return {
      trigger: 'narrative_turn',
      description: 'Narrative turning point detected',
    };
  }

  return {
    trigger: null,
  };
}

/**
 * Detects significant relationship changes by comparing reputation scores
 * Triggers when any reputation dimension changes by more than 0.3
 */
export function detectRelationshipChange(
  prevWorld: WorldSlice,
  currentWorld: WorldSlice
): TriggerResult {
  const prevReputations = prevWorld.systems.reputation?.reputations || {};
  const currentReputations = currentWorld.systems.reputation?.reputations || {};

  // Check all agents that exist in both worlds
  for (const agentId of Object.keys(prevReputations)) {
    const prevRep = prevReputations[agentId];
    const currentRep = currentReputations[agentId];

    // Skip if agent doesn't exist in current world
    if (!currentRep) continue;

    // Check all reputation dimensions
    const dimensions: Array<keyof typeof prevRep> = [
      'trustworthiness',
      'competence',
      'benevolence',
      'status',
      'influence',
    ];

    for (const dimension of dimensions) {
      const prevValue = prevRep[dimension];
      const currentValue = currentRep[dimension];

      if (typeof prevValue === 'number' && typeof currentValue === 'number') {
        const delta = Math.abs(currentValue - prevValue);

        if (delta > 0.3) {
          return {
            trigger: 'relationship',
            description: 'Significant relationship change',
          };
        }
      }
    }
  }

  return {
    trigger: null,
  };
}

/**
 * Detects resource depletion or discovery by comparing resource amounts
 * Triggers when a resource amount goes to 0 (depletion) or from 0 (discovery)
 */
export function detectResourceEvent(
  prevWorld: WorldSlice,
  currentWorld: WorldSlice
): TriggerResult {
  const prevResources = prevWorld.systems.resources?.resources || {};
  const currentResources = currentWorld.systems.resources?.resources || {};

  // Check all resources that exist in both worlds
  const allResourceIds = new Set([
    ...Object.keys(prevResources),
    ...Object.keys(currentResources),
  ]);

  for (const resourceId of allResourceIds) {
    const prevResource = prevResources[resourceId];
    const currentResource = currentResources[resourceId];

    // Skip if resource doesn't exist in both worlds
    if (!prevResource || !currentResource) continue;

    const prevAmount = prevResource.amount;
    const currentAmount = currentResource.amount;

    // Check for depletion: amount goes to 0
    if (prevAmount > 0 && currentAmount === 0) {
      return {
        trigger: 'resource',
        description: 'Resource event detected',
      };
    }

    // Check for discovery: amount goes from 0
    if (prevAmount === 0 && currentAmount > 0) {
      return {
        trigger: 'resource',
        description: 'Resource event detected',
      };
    }
  }

  return {
    trigger: null,
  };
}
