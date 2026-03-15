import { createHookBus } from './hooks'
import { createNuwaService } from './nuwa-service'
import { applyMemoryDecay } from './memory'
import { updateVitalsAfterTick } from './vitals'
import { applyPersonaDrift, generateDriftSignals } from './persona'
import { selectActiveAgents, applyCircadianEffects, getWorldHour, generateDefaultSleepSchedule } from './circadian-rhythm'
import { mapSearchResultsToSocialContext } from '@/server/search/mapper'
import { executeNpcAgents } from './npc-agent-executor'
import type { AgentAction } from '@/domain/actions'
import type { WorldSlice, PersonalAgentState, SystemsState } from '@/domain/world'
import type { SearchSignal } from '@/domain/search'
import { arbitratePatches } from './arbiter'
import { judgeLife, decideReincarnation, createHoutuConfig } from '@/domain/houtu'
import { createPersonalAgent } from '@/domain/agents'
import { createRecommendationSystem } from './recommendation-system'
import { createKnowledgeGraph, KnowledgeGraph } from './knowledge-graph'
import { NarrativeRecognizer } from './narrative-recognizer'
import { StoryArcDetector } from './story-arc-detector'
import { NarrativeSummarizer } from './narrative-summarizer'
import { NarrativeInfluenceSystem } from './narrative-influence'
import { CollectiveMemorySystem } from './collective-memory'
import { ReputationSystem } from './reputation-system'
import { CognitiveBiasSystem } from './cognitive-bias-system'
import { ResourceCompetitionSystem } from './resource-competition-system'
import { DramaticTensionSystem } from './dramatic-tension-system'
import { EmergentPropertyDetector } from './emergent-property-detector'
import { SocialRoleSystem } from './social-role-system'
import { MemePropagationSystem } from './meme-propagation-system'
import { HierarchicalMemorySystem } from './hierarchical-memory-system'
import { AttentionMechanism } from './attention-mechanism'

type OrchestratorOptions = {
  search?: () => Promise<SearchSignal[]>
  creator?: { trigger: 'event'; seed: string; environment: { region: string; social_state: string } }
  directorRegistry?: { runAll: (world: WorldSlice) => Promise<{ agentId: string; patch?: unknown; error?: string }[]> }
}

// Global system instances (persist across ticks, hydrated from world.systems)
let globalReputationSystem: ReputationSystem | null = null
let globalBiasSystem: CognitiveBiasSystem | null = null
let globalResourceSystem: ResourceCompetitionSystem | null = null
let globalTensionSystem: DramaticTensionSystem | null = null
let globalEmergenceDetector: EmergentPropertyDetector | null = null
let globalRoleSystem: SocialRoleSystem | null = null
let globalMemeSystem: MemePropagationSystem | null = null
let globalMemorySystems: Map<string, HierarchicalMemorySystem> = new Map()
let globalAttentionMechanism: AttentionMechanism | null = null
let globalCollectiveMemory: CollectiveMemorySystem | null = null

/**
 * Hydrate global system singletons from world.systems
 */
function hydrateSystemsFromWorld(world: WorldSlice): void {
  const sys = world.systems || {}

  // Reputation system
  globalReputationSystem = new ReputationSystem()
  if (sys.reputation) {
    globalReputationSystem.fromSnapshot(sys.reputation)
  }

  // Cognitive bias
  globalBiasSystem = new CognitiveBiasSystem()
  if (sys.cognitive_bias) {
    globalBiasSystem.fromSnapshot(sys.cognitive_bias)
  }

  // Resource competition
  globalResourceSystem = new ResourceCompetitionSystem()
  if (sys.resources) {
    globalResourceSystem.fromSnapshot(sys.resources)
  } else {
    globalResourceSystem.initializeResources(world)
  }

  // Dramatic tension
  globalTensionSystem = new DramaticTensionSystem()
  if (sys.tension) {
    globalTensionSystem.fromSnapshot(sys.tension)
  }

  // Emergence detection
  globalEmergenceDetector = new EmergentPropertyDetector()
  if (sys.emergence) {
    globalEmergenceDetector.fromSnapshot(sys.emergence)
  }

  // Social roles
  globalRoleSystem = new SocialRoleSystem()
  if (sys.social_roles) {
    globalRoleSystem.fromSnapshot(sys.social_roles)
  }

  // Meme propagation
  globalMemeSystem = new MemePropagationSystem()
  if (sys.memes) {
    globalMemeSystem.fromSnapshot(sys.memes)
  }

  // Attention mechanism
  globalAttentionMechanism = new AttentionMechanism()
  if (sys.attention) {
    globalAttentionMechanism.fromSnapshot(sys.attention)
  }

  // Collective memory
  globalCollectiveMemory = new CollectiveMemorySystem()
  if (sys.collective_memory) {
    globalCollectiveMemory.fromSnapshot(sys.collective_memory)
  }

  // Hierarchical memory (per-agent, stored as Record<seed, snapshot>)
  if (sys.hierarchical_memory) {
    const hmData = sys.hierarchical_memory as Record<string, any>
    globalMemorySystems = new Map()
    for (const [seed, snapshot] of Object.entries(hmData)) {
      const memSys = new HierarchicalMemorySystem()
      memSys.fromSnapshot(snapshot)
      globalMemorySystems.set(seed, memSys)
    }
  }
}

/**
 * Export all system states as SystemsState
 */
function exportSystemsState(knowledgeGraph: KnowledgeGraph): SystemsState {
  return {
    reputation: globalReputationSystem!.toSnapshot(),
    social_roles: globalRoleSystem!.toSnapshot(),
    resources: globalResourceSystem!.toSnapshot(),
    tension: globalTensionSystem!.toSnapshot(),
    emergence: globalEmergenceDetector!.toSnapshot(),
    memes: globalMemeSystem!.toSnapshot(),
    attention: globalAttentionMechanism!.toSnapshot(),
    knowledge_graph: knowledgeGraph.toJSON(),
    cognitive_bias: globalBiasSystem!.toSnapshot(),
    collective_memory: globalCollectiveMemory!.toSnapshot(),
    hierarchical_memory: (() => {
      const hm: Record<string, any> = {}
      for (const [seed, sys] of globalMemorySystems) {
        hm[seed] = sys.toSnapshot()
      }
      return hm
    })(),
  }
}

/**
 * World state evolution — update social_context based on this tick's events
 * Purely event-driven, no hardcoded threshold logic
 */
function evolveWorldState(world: WorldSlice, patch: ReturnType<typeof arbitratePatches>): WorldSlice {
  const updatedSocialContext = { ...world.social_context }

  // 1. All events with summaries are potential macro events
  const newEventSummaries = patch.events
    .filter(e => e.summary && e.summary.length > 5)
    .map(e => e.summary)

  if (newEventSummaries.length > 0) {
    const existingSet = new Set(updatedSocialContext.macro_events)
    for (const evt of newEventSummaries) {
      if (!existingSet.has(evt)) {
        updatedSocialContext.macro_events.push(evt)
      }
    }
    // Keep last 20
    if (updatedSocialContext.macro_events.length > 20) {
      updatedSocialContext.macro_events = updatedSocialContext.macro_events.slice(-20)
    }
  }

  // 2. Update narratives from narrative patterns
  const activeNarrativeDescriptions = world.narratives.patterns
    .filter(p => p.status === 'developing' || p.status === 'climax')
    .slice(0, 5)
    .map(p => {
      const participants = world.agents.npcs
        .filter(a => p.participants.includes(a.genetics.seed))
        .map(a => a.identity.name)
      return `${p.type}: ${participants.join(' & ')} — ${p.type} (${p.status === 'climax' ? 'climax' : 'developing'})`
    })

  if (activeNarrativeDescriptions.length > 0) {
    updatedSocialContext.narratives = activeNarrativeDescriptions
  }

  // 3. Generate ambient atmosphere from NPC emotions (direct stats, no threshold logic)
  const emotionCounts = new Map<string, number>()
  for (const npc of world.agents.npcs) {
    if (npc.emotion.label && npc.emotion.label !== 'neutral') {
      emotionCounts.set(npc.emotion.label, (emotionCounts.get(npc.emotion.label) || 0) + 1)
    }
  }
  const topEmotions = [...emotionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => `atmosphere of ${label}`)

  if (topEmotions.length > 0) {
    updatedSocialContext.ambient_noise = [
      ...topEmotions,
      ...updatedSocialContext.ambient_noise.slice(0, 2),
    ].slice(0, 4)
  }

  // 4. Trim old events (keep last 200)
  const trimmedEvents = world.events.length > 200
    ? world.events.slice(-200)
    : world.events

  return {
    ...world,
    social_context: updatedSocialContext,
    events: trimmedEvents,
  }
}

export async function runWorldTick(world: WorldSlice, options: OrchestratorOptions = {}): Promise<WorldSlice> {
  const bus = createHookBus()
  await bus.emit('before_tick', { world })

  const nextTick = world.tick + 1
  const timestamp = new Date(Date.parse(world.time) + 1000).toISOString()

  // Initialize new systems
  const recSystem = createRecommendationSystem()
  const narrativeInfluence = new NarrativeInfluenceSystem()
  const collectiveMemory = globalCollectiveMemory!

  // Hydrate global systems from world.systems (replaces old if (!global) new() pattern)
  hydrateSystemsFromWorld(world)

  // Knowledge graph: restore from persisted snapshot if available, otherwise build from world state
  let knowledgeGraph: KnowledgeGraph
  if (world.systems?.knowledge_graph) {
    knowledgeGraph = KnowledgeGraph.fromJSON(world.systems.knowledge_graph)
  } else {
    knowledgeGraph = createKnowledgeGraph(world)
  }

  const reputationSystem = globalReputationSystem!
  const biasSystem = globalBiasSystem!
  const resourceSystem = globalResourceSystem!
  const tensionSystem = globalTensionSystem!
  const emergenceDetector = globalEmergenceDetector!
  const roleSystem = globalRoleSystem!
  const memeSystem = globalMemeSystem!
  const attentionMechanism = globalAttentionMechanism!

  // All alive NPCs participate in state updates, but only a subset makes LLM decisions
  const aliveNpcs = world.agents.npcs.filter(a => a.life_status === 'alive')

  // Ensure all agents have sleep schedules (backfill for agents created before circadian system)
  const npcsWithSchedules = aliveNpcs.map(a => {
    if (!a.sleep_schedule) {
      return { ...a, sleep_schedule: generateDefaultSleepSchedule(a) }
    }
    return a
  })

  // Calculate tension from recent conflicts + high-stress agents
  const recentConflicts = world.events.slice(-20).filter(e =>
    (e.payload as Record<string, unknown> | undefined)?.conflict === true
  ).length
  const conflictRatio = world.events.length > 0 ? recentConflicts / Math.min(20, world.events.length) : 0
  const highStressRatio = npcsWithSchedules.filter(a => a.vitals.stress > 0.6).length / Math.max(1, npcsWithSchedules.length)
  const tension = Math.min(1, conflictRatio + highStressRatio * 0.5)

  // Circadian-aware agent selection
  const activeNpcsForDecision = selectActiveAgents(npcsWithSchedules, world, tension)
  const activeSeeds = new Set(activeNpcsForDecision.map(a => a.genetics.seed))

  const worldHour = getWorldHour(world)
  console.log(`[Orchestrator] Tick ${nextTick} (hour ${worldHour}): ${activeNpcsForDecision.length}/${npcsWithSchedules.length} agents active (tension: ${(tension * 100).toFixed(0)}%)`)

  // Parallel update for personal agent
  const updatedMemoryShort = applyMemoryDecay(world.agents.personal.memory_short)
  const updatedMemoryLong = applyMemoryDecay(world.agents.personal.memory_long)
  const updatedVitals = updateVitalsAfterTick(world.agents.personal.vitals)
  const updatedPersona = applyPersonaDrift(world.agents.personal.persona, generateDriftSignals(world.agents.personal.action_history))

  // Parallel update for all NPC agents (with circadian effects)
  const updatedNpcs = await Promise.all(
    npcsWithSchedules.map(async (npc) => {
      const withCircadian = applyCircadianEffects(npc, worldHour)
      return {
        ...withCircadian,
        memory_short: applyMemoryDecay(npc.memory_short),
        memory_long: applyMemoryDecay(npc.memory_long),
        vitals: updateVitalsAfterTick(withCircadian.vitals),
        persona: applyPersonaDrift(npc.persona, generateDriftSignals(npc.action_history || [])),
      }
    })
  )

  const searchResults = options.search ? await options.search() : []
  const mappedContext = searchResults.length
    ? mapSearchResultsToSocialContext(searchResults)
    : world.social_context

  const action: AgentAction = { type: 'reflect', intensity: 0.5 }

  await bus.emit('before_action', { action })
  await bus.emit('after_action', { action })

  const events = [...world.events]

  if (options.creator) {
    const nuwa = createNuwaService({
      emit: (event) => {
        events.push({
          id: `event-${nextTick}-${events.length}`,
          type: event.type,
          timestamp,
          payload: event.payload as Record<string, unknown> | undefined,
        })
      },
    })
    nuwa.createAgent(options.creator)
  }

  const event = {
    id: `event-${nextTick}`,
    type: 'tick',
    timestamp,
  }

  events.push(event)

  const baseNext: WorldSlice = {
    ...world,
    tick: nextTick,
    time: timestamp,
    social_context: mappedContext,
    events,
    agents: {
      ...world.agents,
      personal: {
        ...world.agents.personal,
        memory_short: updatedMemoryShort,
        memory_long: updatedMemoryLong,
        vitals: updatedVitals,
        persona: updatedPersona,
        action_history: [...world.agents.personal.action_history, { type: action.type, timestamp }],
      },
      npcs: updatedNpcs,
    },
  }

  if (!options.directorRegistry) {
    const earlyNext = { ...baseNext, systems: exportSystemsState(knowledgeGraph) }
    await bus.emit('after_tick', { world: earlyNext })
    return earlyNext
  }

  // Execute Pangu agents and NPC agents in parallel
  const [directorResults, npcResults] = await Promise.all([
    options.directorRegistry.runAll(world),
    executeNpcAgents({ ...world, agents: { ...world.agents, npcs: activeNpcsForDecision } }),
  ])

  // Merge all agent results
  const allResults = [
    ...directorResults,
    ...npcResults.map(r => ({ agentId: r.agentId, patch: r.patch })),
  ]

  const patch = arbitratePatches(allResults as { agentId: string; patch?: any; error?: string }[])

  // Apply NPC agent state updates
  const updatedNpcsMap = new Map(npcResults.map(r => [r.agentId, r.updatedAgent]))
  const npcsAfterExecution = baseNext.agents.npcs.map(agent => 
    updatedNpcsMap.get(agent.genetics.seed) || agent
  )

  let next: WorldSlice = {
    ...baseNext,
    tick: baseNext.tick + patch.timeDelta,
    agents: {
      ...baseNext.agents,
      npcs: npcsAfterExecution,
    },
    events: [
      ...baseNext.events,
      ...patch.events.map((e) => ({
        id: e.id,
        type: e.kind,
        timestamp,
        payload: { summary: e.summary, conflict: e.conflict },
      })),
    ],
  }

  // Life cycle system - death and reincarnation
  const houtuConfig = createHoutuConfig()
  const houtuEvents: Array<{ id: string; type: string; timestamp: string; payload?: Record<string, unknown> }> = []
  
  // 1. Judge life and death
  const updatedNpcsAfterHoutu: PersonalAgentState[] = []
  const deadAgents: PersonalAgentState[] = []
  
  for (const npc of next.agents.npcs) {
    const judgment = judgeLife(npc, next.tick, houtuConfig)
    
    if (judgment.should_die && npc.life_status === 'alive') {
      // Mark as dead
      const dyingAgent: PersonalAgentState = {
        ...npc,
        life_status: 'dead',
        death_tick: next.tick,
        cause_of_death: judgment.reason,
        legacy: judgment.legacy,
      }
      deadAgents.push(dyingAgent)
      updatedNpcsAfterHoutu.push(dyingAgent)
      
      houtuEvents.push({
        id: `houtu-death-${next.tick}-${npc.genetics.seed}`,
        type: 'agent_death',
        timestamp,
        payload: {
          agent_seed: npc.genetics.seed,
          agent_name: npc.identity.name,
          cause: judgment.reason,
          death_type: judgment.death_type,
        },
      })
    } else {
      updatedNpcsAfterHoutu.push(npc)
    }
  }
  
  // 2. Handle reincarnation
  const reincarnatedAgents: PersonalAgentState[] = []
  
  for (const deadAgent of deadAgents) {
    const reincarnation = decideReincarnation(deadAgent, next.tick, houtuConfig)
    
    if (reincarnation.should_reincarnate) {
      // Create new agent after reincarnation
      const newAgent = createPersonalAgent(`${deadAgent.genetics.seed}-reborn-${next.tick}`)
      newAgent.life_status = 'alive'
      newAgent.identity.name = `${deadAgent.identity.name}${next.config?.reborn_suffix || ' Reborn'}`
      
      // Inherit partial traits
      if (reincarnation.inherited_traits) {
        if (reincarnation.inherited_traits.goals) {
          newAgent.goals = reincarnation.inherited_traits.goals
        }
        if (reincarnation.inherited_traits.relations) {
          newAgent.relations = reincarnation.inherited_traits.relations
        }
        if (reincarnation.inherited_traits.memories) {
          // Convert memories to fuzzy long-term memories
          newAgent.memory_long = reincarnation.inherited_traits.memories.map((content, idx) => ({
            id: `inherited-${next.tick}-${idx}`,
            content: `${next.config?.past_life_prefix || 'Past life: '}${content}`,
            importance: 0.3,
            emotional_weight: 0.2,
            source: 'self' as const,
            timestamp,
            decay_rate: 0.05,
            retrieval_strength: 0.4,
          }))
        }
      }
      
      reincarnatedAgents.push(newAgent)
      
      houtuEvents.push({
        id: `houtu-reincarnation-${next.tick}-${deadAgent.genetics.seed}`,
        type: 'agent_reincarnation',
        timestamp,
        payload: {
          old_seed: deadAgent.genetics.seed,
          new_seed: newAgent.genetics.seed,
          old_name: deadAgent.identity.name,
          new_name: newAgent.identity.name,
        },
      })
    }
  }
  
  // 3. Clean up dead agents (delayed cleanup)
  const cleanedNpcs = updatedNpcsAfterHoutu.filter(npc => {
    if (npc.life_status === 'dead' && npc.death_tick) {
      const ticksSinceDeath = next.tick - npc.death_tick
      return ticksSinceDeath < houtuConfig.cleanup_delay
    }
    return true
  })
  
  // 4. Add reincarnated agents
  const finalNpcs = [...cleanedNpcs, ...reincarnatedAgents]
  
  // Update world state
  next = {
    ...next,
    agents: {
      ...next.agents,
      npcs: finalNpcs,
    },
    events: [...next.events, ...houtuEvents],
  }

  // Emergent narrative system — recognize narrative patterns
  const narrativeRecognizer = new NarrativeRecognizer()
  
  // 1. Recognize new narrative patterns (from last 100 events)
  const recentEvents = next.events.slice(-100)
  const newPatterns = await narrativeRecognizer.recognizePatterns(recentEvents, next)
  
  // 2. Update existing narrative patterns (track development)
  const recentEventsForTracking = next.events.slice(-10)
  const updatedPatterns = await Promise.all(
    next.narratives.patterns.map(pattern =>
      narrativeRecognizer.trackNarrativeDevelopment(pattern, recentEventsForTracking, next)
    )
  )
  
  // 3. Merge old and new patterns (deduplicate)
  const allPatterns = [...updatedPatterns, ...newPatterns]
  const uniquePatterns = allPatterns.filter((pattern, index, self) =>
    index === self.findIndex(p => p.id === pattern.id)
  )
  
  // 4. Detect story arcs
  const storyArcDetector = new StoryArcDetector()
  const detectedArcs = await storyArcDetector.detectArcs(uniquePatterns)
  
  // 5. Update existing story arcs
  const updatedArcs = await Promise.all(
    next.narratives.arcs.map(async arc => {
      // Find related new patterns
      const relevantNewPatterns = uniquePatterns.filter(p =>
        p.participants.some(participant =>
          [...arc.protagonists, ...arc.antagonists, ...arc.supporting].includes(participant)
        )
      )
      
      if (relevantNewPatterns.length > 0) {
        return await storyArcDetector.updateArc(arc, relevantNewPatterns)
      }
      return arc
    })
  )
  
  // 6. Merge old and new story arcs
  const allArcs = [...updatedArcs, ...detectedArcs]
  const uniqueArcs = allArcs.filter((arc, index, self) =>
    index === self.findIndex(a => a.id === arc.id)
  )
  
  // 7. Generate narrative summary (every 10 ticks)
  let summaries = next.narratives.summaries
  if (next.tick % 10 === 0 && uniquePatterns.length > 0) {
    const summarizer = new NarrativeSummarizer()
    const newSummary = await summarizer.summarize(uniquePatterns, next.events)
    summaries = [...summaries, newSummary]
    
    console.log(`[NarrativeSummarizer] Generated summary: "${newSummary.title}"`)
  }
  
  // 8. Update statistics
  const narrativeStats = {
    total_patterns: uniquePatterns.length,
    active_patterns: uniquePatterns.filter(p => 
      p.status === 'developing' || p.status === 'climax'
    ).length,
    concluded_patterns: uniquePatterns.filter(p => p.status === 'concluded').length,
    total_arcs: uniqueArcs.length,
    completed_arcs: uniqueArcs.filter(a => a.status === 'concluded').length
  }
  
  console.log(`[NarrativeSystem] Tick ${nextTick}: ${narrativeStats.active_patterns} active patterns, ${narrativeStats.total_arcs} story arcs`)
  
  // 9. Update world's narrative system
  next = {
    ...next,
    narratives: {
      patterns: uniquePatterns,
      arcs: uniqueArcs,
      summaries,
      stats: narrativeStats
    }
  }
  
  // 10. Narrative influence system — let narratives affect agents
  const npcsWithNarrativeInfluence = next.agents.npcs.map(agent =>
    narrativeInfluence.applyNarrativeInfluence(agent, uniquePatterns, next)
  )
  
  // 11. Collective memory system — detect and propagate collective memories
  const newCollectiveMemories = collectiveMemory.detectCollectiveMemory(
    npcsWithNarrativeInfluence,
    next.tick
  )
  
  if (newCollectiveMemories.length > 0) {
    console.log(`[CollectiveMemory] Formed ${newCollectiveMemories.length} new collective memories`)
    
    // Propagate collective memory
    const npcsWithCollectiveMemory = collectiveMemory.propagateMemory(
      newCollectiveMemories[0],  // propagate first collective memory
      npcsWithNarrativeInfluence,
      next.tick
    )
    
    // Extract cultural norms
    const culturalNorms = collectiveMemory.extractCulturalNorms(
      collectiveMemory.getAllCollectiveMemories()
    )
    
    if (culturalNorms.length > 0) {
      console.log(`[CollectiveMemory] Extracted ${culturalNorms.length} cultural norms`)
    }
    
    next = {
      ...next,
      agents: {
        ...next.agents,
        npcs: npcsWithCollectiveMemory
      }
    }
  } else {
    next = {
      ...next,
      agents: {
        ...next.agents,
        npcs: npcsWithNarrativeInfluence
      }
    }
  }
  
  // Collective memory stats
  const memoryStats = collectiveMemory.getStats()
  if (memoryStats.total_memories > 0) {
    console.log(`[CollectiveMemory] ${memoryStats.total_memories} memories, ${memoryStats.total_norms} norms`)
  }

  // Knowledge graph: incremental update + ingest agent actions
  knowledgeGraph.incrementalUpdate(next)

  // Write agent actions back into the graph (action → graph closed loop)
  for (const result of npcResults) {
    const agent = next.agents.npcs.find(a => a.genetics.seed === result.agentId)
    if (!agent) continue
    knowledgeGraph.ingestAgentAction(
      result.agentId,
      {
        type: result.patch.meta?.actionType as string || 'unknown',
        target: result.patch.meta?.agentId as string || undefined,
        description: agent.last_action_description,
        location: agent.location,
        is_conflict: result.patch.events?.some(e => e.conflict) ?? false,
      },
      nextTick
    )
  }

  const graphStats = knowledgeGraph.getStats()
  console.log(`[KnowledgeGraph] Tick ${nextTick}: ${graphStats.totalNodes} nodes, ${graphStats.totalEdges} edges`)

  // ===== Route LLM system_feedback to mechanism systems =====
  for (const result of npcResults) {
    const fb = result.systemFeedback
    if (!fb) continue
    const agentId = result.agentId

    // Collect witnesses: colocated agents
    const agent = next.agents.npcs.find(a => a.genetics.seed === agentId)
    const witnesses = agent
      ? next.agents.npcs
          .filter(a => a.genetics.seed !== agentId && a.location === agent.location)
          .map(a => a.genetics.seed)
      : []

    if (fb.reputation_impact) {
      reputationSystem.updateFromLLMFeedback(agentId, fb.reputation_impact, witnesses, nextTick)
    }
    if (fb.current_role || fb.role_conflict) {
      roleSystem.updateFromLLMFeedback(agentId, fb.current_role, fb.role_conflict)
    }
    if (fb.resource_action) {
      resourceSystem.claimFromLLMFeedback(agentId, fb.resource_action)
    }
    if (fb.tension_effect) {
      tensionSystem.updateFromLLMFeedback(agentId, fb.tension_effect, nextTick)
    }
    if (fb.meme_spread) {
      memeSystem.ingestFromLLMFeedback(agentId, fb.meme_spread, nextTick)
    }
    if (fb.perceived_bias) {
      biasSystem.recordBias(agentId, fb.perceived_bias, nextTick)
    }
  }

  // ===== Phase 4-5: Advanced mechanism systems =====
  
  // 1. Reputation system — update from NPC actions + social network + decay
  reputationSystem.updateSocialNetwork(next)

  // Initialize reputation for all agents and update from their actions this tick
  for (const result of npcResults) {
    const agent = next.agents.npcs.find(a => a.genetics.seed === result.agentId)
    if (!agent) continue

    // Ensure agent has reputation
    if (!reputationSystem.getAllReputations().has(result.agentId)) {
      reputationSystem.initializeReputation(agent)
    }

    // Derive reputation impact from action
    const meta = result.patch.meta || {}
    const actionType = meta.actionType as string || ''
    const isConflict = result.patch.events?.some(e => e.conflict) ?? false
    const colocatedIds = next.agents.npcs
      .filter(a => a.genetics.seed !== result.agentId && a.location === agent.location)
      .map(a => a.genetics.seed)

    if (actionType && colocatedIds.length > 0) {
      reputationSystem.updateReputation(agent, {
        type: isConflict ? 'compete' : actionType.includes('help') ? 'help' : actionType.includes('teach') ? 'teach' : 'cooperate',
        target: meta.agentId as string || undefined,
        success: !isConflict,
        witnesses: colocatedIds,
      }, nextTick)
    }
  }

  reputationSystem.applyDecay(nextTick)
  const reputationStats = reputationSystem.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[ReputationSystem] Avg trust: ${reputationStats.avg_trustworthiness.toFixed(2)}, Events: ${reputationStats.total_events}`)
  }
  
  // 2. Social role system — assign roles to all agents and write back to agent state
  const npcsWithRoles = next.agents.npcs.map(agent => {
    const roles = roleSystem.assignRoles(agent, next)
    roleSystem.detectRoleConflicts(agent)
    // Write primary role to agent's narrative_roles
    const primaryRole = roles[0]
    if (primaryRole) {
      return {
        ...agent,
        narrative_roles: {
          ...agent.narrative_roles,
          [`role-${primaryRole.type}`]: {
            // Map social role to narrative role based on identity_strength and agent traits
            role: (agent.persona.agency > 0.7 && primaryRole.identity_strength > 0.5) ? 'protagonist' as const :
                  (agent.persona.empathy > 0.7) ? 'catalyst' as const :
                  (agent.persona.attachment > 0.6) ? 'supporting' as const :
                  'observer' as const,
            involvement: primaryRole.identity_strength,
            impact: primaryRole.identity_strength * 0.8,
          }
        }
      }
    }
    return agent
  })
  const roleStats = roleSystem.getStats()
  if (nextTick % 10 === 0 && roleStats.total_roles > 0) {
    console.log(`[RoleSystem] ${roleStats.total_roles} roles, ${roleStats.total_conflicts} conflicts`)
  }
  
  // 3. Resource competition system — allocate resources and apply results to agents
  const resourceResults = resourceSystem.allocateAllResources(next.agents.npcs)
  resourceSystem.regenerateResources()

  // Feed resource results back into agent vitals (generic: all material-type resources affect energy)
  for (const [, result] of resourceResults) {
    for (const npc of next.agents.npcs) {
      const allocation = result.allocations.get(npc.genetics.seed) || 0
      // Check if this resource is material type
      const resource = resourceSystem.getAllResources().get(result.resource_id)
      if (resource?.type === 'material') {
        if (allocation > 0) {
          npc.vitals.energy = Math.min(1, npc.vitals.energy + allocation * 0.005)
        } else if (npc.vitals.energy < 0.5 && resource.scarcity > 0.5) {
          npc.vitals.energy = Math.max(0, npc.vitals.energy - 0.01)
        }
      }
    }
    // Conflicts from resource competition feed into tension
    for (const conflict of result.conflicts) {
      if (conflict.agents.length >= 2) {
        tensionSystem.updateFromLLMFeedback(conflict.agents[0], 'building', nextTick)
      }
    }
  }

  const resourceStats = resourceSystem.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[ResourceSystem] Scarcity: ${resourceStats.scarcity_avg.toFixed(2)}, Claims: ${resourceStats.total_claims}`)
  }
  
  // 4. Dramatic tension system — detect and accumulate tension
  const newTensions = tensionSystem.detectAndCreateTension(next, uniquePatterns)
  for (const tension of tensionSystem.getActiveTensions()) {
    tensionSystem.buildupTension(tension.id, next.events, nextTick)
  }
  tensionSystem.checkReleaseConditions(next, uniquePatterns)
  const overallTension = tensionSystem.calculateOverallTension(next)
  const tensionStats = tensionSystem.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[TensionSystem] Overall: ${overallTension.toFixed(2)}, Active: ${tensionStats.active_tensions}, Peak: ${tensionStats.peak_tensions}`)
  }
  
  // 5. Emergent property detector — detect emergence
  const worldHistory: WorldSlice[] = []  // TODO: maintain history window
  const emergentProperties = emergenceDetector.detectEmergence(next, worldHistory)
  if (emergentProperties.length > 0) {
    console.log(`[EmergenceDetector] Detected ${emergentProperties.length} emergent properties:`)
    for (const prop of emergentProperties) {
      console.log(`  - ${prop.type}: ${prop.description} (strength: ${prop.strength.toFixed(2)})`)
    }
  }
  const emergenceStats = emergenceDetector.getStats()
  if (nextTick % 10 === 0 && emergenceStats.total_detected > 0) {
    console.log(`[EmergenceDetector] Total: ${emergenceStats.total_detected}, Avg novelty: ${emergenceStats.avg_novelty.toFixed(2)}`)
  }
  
  // 6. Meme propagation system — extract and propagate memes
  // Extract new memes from agents
  for (const agent of next.agents.npcs.slice(0, 5)) {  // extract from 5 agents per tick
    const newMemes = memeSystem.extractMemesFromAgent(agent, nextTick)
  }
  
  // Propagate existing memes
  const socialNetwork = new Map<string, Set<string>>()
  for (const agent of next.agents.npcs) {
    const friends = new Set<string>()
    for (const [target, value] of Object.entries(agent.relations)) {
      if (value > 0.3) friends.add(target)
    }
    socialNetwork.set(agent.genetics.seed, friends)
  }
  
  const allMemes = Array.from(memeSystem.getAllMemes().values())
  for (const meme of allMemes.slice(0, 10)) {  // propagate 10 memes per tick
    memeSystem.propagateMeme(meme, socialNetwork, next.agents.npcs, nextTick)
  }
  
  // Meme decay
  memeSystem.decayMemes(nextTick)
  
  const memeStats = memeSystem.getStats()
  if (nextTick % 10 === 0 && memeStats.total_memes > 0) {
    console.log(`[MemeSystem] Memes: ${memeStats.total_memes}, Transmissions: ${memeStats.successful_transmissions}, Mutation rate: ${(memeStats.mutation_rate * 100).toFixed(1)}%`)
  }
  
  // 7. Attention mechanism — allocate attention + integrate recommendation system
  // Build reputation influences map for attention cross-system feedback
  const reputationInfluences = new Map<string, number>()
  for (const agent of next.agents.npcs) {
    reputationInfluences.set(agent.genetics.seed, reputationSystem.getInfluence(agent.genetics.seed))
  }
  // Build active tensions for attention cross-system feedback
  const activeTensionsForAttention = tensionSystem.getActiveTensions().map(t => ({
    source: t.source,
    level: t.level,
    target_agents: t.target_agents,
  }))

  const npcsWithAttention = await Promise.all(next.agents.npcs.map(async agent => {
    // Recommendation system suggests events for agent
    const recommendedEvents = await recSystem.recommendEvents(agent, next)

    // Convert recommended events to stimuli
    const recStimuli = recommendedEvents.slice(0, 3).map(evt =>
      attentionMechanism.createStimulus('event', evt.id, `Recommended: ${evt.type}`, {
        salience: 0.8,
        urgency: 0.7,
        relevance: 0.9,
      })
    )

    const worldStimuli = attentionMechanism.generateStimuliFromWorld(next, agent, reputationInfluences, activeTensionsForAttention)
    const allStimuli = [...recStimuli, ...worldStimuli]
    const allocations = attentionMechanism.allocateAttention(agent, allStimuli, nextTick)

    // If resting, recover attention
    if (agent.vitals.energy > 0.7 && agent.vitals.stress < 0.3) {
      attentionMechanism.recoverAttention(agent)
    }

    // Write attention allocation results back to agent's focus
    const topFocus = allocations[0]
    const focusBoost = topFocus ? topFocus.weight * 0.1 : 0
    return {
      ...agent,
      vitals: {
        ...agent.vitals,
        focus: Math.min(1, agent.vitals.focus + focusBoost),
      },
    }
  }))
  
  const attentionStats = attentionMechanism.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[AttentionMechanism] Avg focus: ${attentionStats.avg_focus_count.toFixed(1)}/${attentionStats.avg_capacity.toFixed(1)}, Fatigue: ${(attentionStats.avg_fatigue * 100).toFixed(1)}%`)
  }
  
  // 8. Hierarchical memory system — manage memory per agent (lazy init)
  for (const agent of next.agents.npcs) {
    if (!globalMemorySystems.has(agent.genetics.seed)) {
      const memorySystem = new HierarchicalMemorySystem()
      memorySystem.migrateFromAgent(agent, nextTick)
      globalMemorySystems.set(agent.genetics.seed, memorySystem)
    }
    
    const memorySystem = globalMemorySystems.get(agent.genetics.seed)!
    
    // Apply decay and consolidation
    memorySystem.applyDecay(nextTick)
    
    // Export back to agent (maintain compatibility)
    const exported = memorySystem.exportToAgent()
    agent.memory_short = exported.memory_short
    agent.memory_long = exported.memory_long
  }
  
  // Memory system stats (sampled)
  if (nextTick % 10 === 0 && globalMemorySystems.size > 0) {
    const sampleSystem = Array.from(globalMemorySystems.values())[0]
    const memStats = sampleSystem.getStats()
    console.log(`[MemorySystem] WM: ${memStats.working_memory.count}/${memStats.working_memory.capacity}, STM: ${memStats.short_term_memory.count}/${memStats.short_term_memory.capacity}, LTM: ${memStats.long_term_memory.count}`)
  }
  
  // Update next's agents + export all system states to next.systems
  next = {
    ...next,
    agents: {
      ...next.agents,
      npcs: npcsWithAttention
    },
    systems: exportSystemsState(knowledgeGraph),
  }

  // ===== Auto-spawn new agents when population drops =====
  // Trigger: NPC deaths cause underpopulation / check every 20 ticks for new arrivals
  const aliveCount = next.agents.npcs.filter(a => a.life_status === 'alive').length
  const shouldSpawn = (
    // Deaths caused population to drop below threshold
    (aliveCount < 10 && nextTick > 5) ||
    // Every 20 ticks, 30% chance to introduce new characters (outsiders/new factions)
    (nextTick % 20 === 0 && Math.random() < 0.3 && aliveCount < 25)
  )

  if (shouldSpawn) {
    try {
      const spawnCount = aliveCount < 5 ? 3 : aliveCount < 10 ? 2 : 1
      console.log(`[AutoSpawn] Tick ${nextTick}: spawning ${spawnCount} new agents (alive: ${aliveCount})`)

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const existingNames = next.agents.npcs
        .filter(a => a.life_status === 'alive')
        .map(a => `${a.identity.name} (${a.occupation || 'unknown'})`)
        .join(', ')
      const recentEvents = next.social_context.macro_events.slice(-5).join('; ')
      const deadNames = next.agents.npcs
        .filter(a => a.life_status === 'dead')
        .map(a => `${a.identity.name} (${a.cause_of_death || 'deceased'})`)
        .join(', ')

      const res = await fetch(`${baseUrl}/api/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${next.environment.description}\n\nExisting characters: ${existingNames}\n${deadNames ? `Deceased: ${deadNames}` : ''}\nRecent major events: ${recentEvents || 'The world has just begun'}\n\nGenerate ${spawnCount} new character(s). **Important: their appearance must have a narrative reason**, for example:\n- An old friend/enemy/descendant of a deceased character, arriving after hearing the news\n- An outsider drawn by recent events\n- Someone who has been hiding nearby and is forced to emerge due to changing circumstances\n- A figure from an existing character's past with unfinished business\n\nTheir backstory must explain "why they appear now" and they must have relationships with at least 2 existing characters. Do not create characters out of thin air.\n\n**Language: Generate all content in the same language as the world description above.**`,
          count: spawnCount,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newAgents = data.agents || []
        if (newAgents.length > 0) {
          next = {
            ...next,
            agents: {
              ...next.agents,
              npcs: [...next.agents.npcs, ...newAgents],
            },
            events: [
              ...next.events,
              ...newAgents.map((a: PersonalAgentState) => ({
                id: `spawn-${nextTick}-${a.genetics.seed}`,
                type: 'agent_spawn',
                timestamp,
                payload: {
                  agent_name: a.identity.name,
                  summary: `${a.identity.name} (${a.occupation || 'unknown'}) has arrived in this world`,
                },
              })),
            ],
          }
          console.log(`[AutoSpawn] Created: ${newAgents.map((a: PersonalAgentState) => a.identity.name).join(', ')}`)
        }
      }
    } catch (error) {
      console.warn('[AutoSpawn] Failed:', (error as Error).message)
    }
  }

  // ===== World state evolution — feed events back into the world =====
  next = evolveWorldState(next, patch)

  // ===== Tick summary — collect all agent behavior descriptions for this tick =====
  const tickBehaviors = npcResults
    .map(r => {
      const agent = next.agents.npcs.find(a => a.genetics.seed === r.agentId)
      return agent?.last_action_description
    })
    .filter(Boolean)

  if (tickBehaviors.length > 0) {
    next = {
      ...next,
      tick_summary: tickBehaviors.join('\n'),
    }
  }

  await bus.emit('after_tick', { world: next })

  return next
}
