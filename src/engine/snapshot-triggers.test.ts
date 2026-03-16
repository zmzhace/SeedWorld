import { describe, it, expect } from 'vitest';
import { detectAgentDeathOrBirth } from './snapshot-triggers';
import type { WorldSlice } from '../domain/world';

describe('snapshot-triggers', () => {
  describe('detectAgentDeathOrBirth', () => {
    const createMockWorld = (agentCount: number): WorldSlice => ({
      id: 'test-world',
      name: 'Test World',
      config: {
        language: 'en',
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        tickInterval: 60000,
        maxAgents: 10,
        autoSaveInterval: 300000,
      },
      environment: {
        description: 'Test environment',
        time: { tick: 0, hour: 12, dayOfYear: 1, season: 'spring' },
        locations: [],
        resources: [],
      },
      agents: {
        npcs: Array.from({ length: agentCount }, (_, i) => ({
          id: `agent-${i}`,
          name: `Agent ${i}`,
          persona: {
            traits: [],
            goals: [],
            relationships: [],
            memories: [],
            emotionalState: { valence: 0, arousal: 0, dominance: 0 },
          },
          state: {
            location: 'location-1',
            activity: 'idle',
            inventory: [],
            status: 'active' as const,
          },
        })),
      },
      systems: {
        reputation: { profiles: [] },
        dramaticTension: { patterns: [], globalTension: 0 },
        resourceCompetition: { claims: [], conflicts: [] },
        memePropagation: { memes: [] },
        knowledgeGraph: { nodes: [], edges: [] },
        socialRole: { roles: [] },
        attentionMechanism: { focusQueue: [] },
        cognitiveBias: { biasRecords: [] },
        circadianRhythm: { agentRhythms: [] },
        conversationSystem: { activeConversations: [] },
      },
      narrative: {
        events: [],
        arcs: [],
      },
      metadata: {
        createdAt: Date.now(),
        lastModified: Date.now(),
        version: '1.0.0',
      },
    });

    it('detects agent death when count decreased', () => {
      const prevWorld = createMockWorld(5);
      const currentWorld = createMockWorld(4);

      const result = detectAgentDeathOrBirth(prevWorld, currentWorld);

      expect(result.trigger).toBe('agent_death');
      expect(result.description).toBe('Agent died');
    });

    it('detects agent birth when count increased', () => {
      const prevWorld = createMockWorld(3);
      const currentWorld = createMockWorld(4);

      const result = detectAgentDeathOrBirth(prevWorld, currentWorld);

      expect(result.trigger).toBe('agent_birth');
      expect(result.description).toBe('Agent born');
    });

    it('returns null when agent count unchanged', () => {
      const prevWorld = createMockWorld(5);
      const currentWorld = createMockWorld(5);

      const result = detectAgentDeathOrBirth(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });
  });
});
