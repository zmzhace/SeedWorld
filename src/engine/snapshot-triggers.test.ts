import { describe, it, expect } from 'vitest';
import { detectAgentDeathOrBirth, detectTensionClimax, detectNarrativeTurn, detectRelationshipChange, detectResourceEvent } from './snapshot-triggers';
import type { WorldSlice } from '../domain/world';
import type { Reputation } from './reputation-system';
import type { Resource } from './resource-competition-system';

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

  describe('detectTensionClimax', () => {
    const createMockWorldWithTension = (tension: number): WorldSlice => ({
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
        npcs: [],
      },
      systems: {
        reputation: { profiles: [] },
        dramaticTension: { patterns: [], globalTension: tension },
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

    it('detects climax when crossing 0.8 threshold from below', () => {
      const prevWorld = createMockWorldWithTension(0.75);
      const currentWorld = createMockWorldWithTension(0.85);

      const result = detectTensionClimax(prevWorld, currentWorld);

      expect(result.trigger).toBe('tension_climax');
      expect(result.description).toBe('Dramatic tension peaked');
    });

    it('returns null when already above 0.8', () => {
      const prevWorld = createMockWorldWithTension(0.85);
      const currentWorld = createMockWorldWithTension(0.9);

      const result = detectTensionClimax(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('returns null when below 0.8', () => {
      const prevWorld = createMockWorldWithTension(0.5);
      const currentWorld = createMockWorldWithTension(0.6);

      const result = detectTensionClimax(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });
  });

  describe('detectNarrativeTurn', () => {
    const createMockWorldWithPatterns = (patternCount: number): WorldSlice => ({
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
        npcs: [],
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
      narratives: {
        patterns: Array.from({ length: patternCount }, (_, i) => ({
          id: `pattern-${i}`,
          type: 'conflict' as const,
          participants: [],
          event_ids: [],
          intensity: 0.5,
          emotional_arc: [],
          sentiment: 0,
          started_at: 0,
          updated_at: 0,
          status: 'emerging' as const,
          turning_points: [],
          tags: [],
          confidence: 0.8,
        })),
        arcs: [],
        summaries: [],
        stats: {
          total_patterns: patternCount,
          active_patterns: patternCount,
          concluded_patterns: 0,
          total_arcs: 0,
          completed_arcs: 0,
        },
      },
      metadata: {
        createdAt: Date.now(),
        lastModified: Date.now(),
        version: '1.0.0',
      },
    });

    it('detects narrative turn when new pattern appears', () => {
      const prevWorld = createMockWorldWithPatterns(2);
      const currentWorld = createMockWorldWithPatterns(3);

      const result = detectNarrativeTurn(prevWorld, currentWorld);

      expect(result.trigger).toBe('narrative_turn');
      expect(result.description).toBe('Narrative turning point detected');
    });

    it('returns null when pattern count unchanged', () => {
      const prevWorld = createMockWorldWithPatterns(3);
      const currentWorld = createMockWorldWithPatterns(3);

      const result = detectNarrativeTurn(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('returns null when pattern count decreases', () => {
      const prevWorld = createMockWorldWithPatterns(5);
      const currentWorld = createMockWorldWithPatterns(3);

      const result = detectNarrativeTurn(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });
  });

  describe('detectRelationshipChange', () => {
    const createMockWorldWithReputation = (reputations: Record<string, Reputation>): WorldSlice => ({
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
        npcs: [],
      },
      systems: {
        reputation: { reputations, socialNetwork: {} },
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

    const createReputation = (agentId: string, trustworthiness: number): Reputation => ({
      agent_id: agentId,
      trustworthiness,
      competence: 0.5,
      benevolence: 0.5,
      status: 0.5,
      influence: 0.5,
      history: [],
      last_updated: 0,
      decay_rate: 0.01,
    });

    it('detects relationship change when trustworthiness delta > 0.3', () => {
      const prevWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.3),
      });
      const currentWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.7),
      });

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBe('relationship');
      expect(result.description).toBe('Significant relationship change');
    });

    it('detects relationship change when competence delta > 0.3', () => {
      const prevWorld = createMockWorldWithReputation({
        'agent-1': {
          agent_id: 'agent-1',
          trustworthiness: 0.5,
          competence: 0.2,
          benevolence: 0.5,
          status: 0.5,
          influence: 0.5,
          history: [],
          last_updated: 0,
          decay_rate: 0.01,
        },
      });
      const currentWorld = createMockWorldWithReputation({
        'agent-1': {
          agent_id: 'agent-1',
          trustworthiness: 0.5,
          competence: 0.6,
          benevolence: 0.5,
          status: 0.5,
          influence: 0.5,
          history: [],
          last_updated: 0,
          decay_rate: 0.01,
        },
      });

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBe('relationship');
      expect(result.description).toBe('Significant relationship change');
    });

    it('returns null when delta <= 0.3', () => {
      const prevWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.5),
      });
      const currentWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.7),
      });

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('returns null when no reputation data', () => {
      const prevWorld = createMockWorldWithReputation({});
      const currentWorld = createMockWorldWithReputation({});

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('handles missing agents gracefully', () => {
      const prevWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.5),
      });
      const currentWorld = createMockWorldWithReputation({
        'agent-2': createReputation('agent-2', 0.5),
      });

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('detects negative reputation change', () => {
      const prevWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.8),
      });
      const currentWorld = createMockWorldWithReputation({
        'agent-1': createReputation('agent-1', 0.4),
      });

      const result = detectRelationshipChange(prevWorld, currentWorld);

      expect(result.trigger).toBe('relationship');
      expect(result.description).toBe('Significant relationship change');
    });
  });

  describe('detectResourceEvent', () => {
    const createMockWorldWithResources = (resources: Record<string, Resource>): WorldSlice => ({
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
        npcs: [],
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
        resources: { resources },
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

    const createResource = (id: string, amount: number): Resource => ({
      id,
      type: 'material',
      name: id,
      amount,
      max_amount: 100,
      regeneration_rate: 5,
      scarcity: 0.5,
      value: 0.7,
    });

    it('detects resource depletion when amount goes to 0', () => {
      const prevWorld = createMockWorldWithResources({
        'food': createResource('food', 50),
      });
      const currentWorld = createMockWorldWithResources({
        'food': createResource('food', 0),
      });

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBe('resource');
      expect(result.description).toBe('Resource event detected');
    });

    it('detects resource discovery when amount goes from 0', () => {
      const prevWorld = createMockWorldWithResources({
        'gold': createResource('gold', 0),
      });
      const currentWorld = createMockWorldWithResources({
        'gold': createResource('gold', 30),
      });

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBe('resource');
      expect(result.description).toBe('Resource event detected');
    });

    it('returns null when amount changes but not to/from 0', () => {
      const prevWorld = createMockWorldWithResources({
        'water': createResource('water', 50),
      });
      const currentWorld = createMockWorldWithResources({
        'water': createResource('water', 30),
      });

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('returns null when no resources exist', () => {
      const prevWorld = createMockWorldWithResources({});
      const currentWorld = createMockWorldWithResources({});

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('returns null when resources are undefined', () => {
      const prevWorld = createMockWorldWithResources({});
      const currentWorld = createMockWorldWithResources({});

      // Remove resources field to test undefined case
      delete prevWorld.systems.resources;
      delete currentWorld.systems.resources;

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('handles new resources appearing gracefully', () => {
      const prevWorld = createMockWorldWithResources({
        'food': createResource('food', 50),
      });
      const currentWorld = createMockWorldWithResources({
        'food': createResource('food', 50),
        'wood': createResource('wood', 20),
      });

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });

    it('handles resources disappearing gracefully', () => {
      const prevWorld = createMockWorldWithResources({
        'food': createResource('food', 50),
        'wood': createResource('wood', 20),
      });
      const currentWorld = createMockWorldWithResources({
        'food': createResource('food', 50),
      });

      const result = detectResourceEvent(prevWorld, currentWorld);

      expect(result.trigger).toBeNull();
      expect(result.description).toBeUndefined();
    });
  });
});
