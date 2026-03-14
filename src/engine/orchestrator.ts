import { createHookBus } from './hooks'
import { createNuwaService } from './nuwa-service'
import { applyMemoryDecay } from './memory'
import { updateVitalsAfterTick } from './vitals'
import { applyPersonaDrift } from './persona'
import { mapSearchResultsToSocialContext } from '@/server/search/mapper'
import { executeNpcAgents } from './npc-agent-executor'
import type { AgentAction } from '@/domain/actions'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import type { SearchSignal } from '@/domain/search'
import { arbitratePatches } from './arbiter'
import { judgeLife, decideReincarnation, createHoutuConfig } from '@/domain/houtu'
import { createPersonalAgent } from '@/domain/agents'
import { createTimeEngine } from './time-engine'
import { createRecommendationSystem } from './recommendation-system'
import { createKnowledgeGraph } from './knowledge-graph'
import { NarrativeRecognizer } from './narrative-recognizer'
import { StoryArcDetector } from './story-arc-detector'
import { NarrativeSummarizer } from './narrative-summarizer'
import { NarrativeInfluenceSystem } from './narrative-influence'
import { CollectiveMemorySystem } from './collective-memory'
import { AgentDecisionMaker } from './agent-decision-maker'
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
  nuwa?: { trigger: 'event'; seed: string; environment: { region: string; social_state: string } }
  panguRegistry?: { runAll: (world: WorldSlice) => Promise<{ agentId: string; patch?: unknown; error?: string }[]> }
}

// 全局系统实例（跨 tick 保持状态）
let globalReputationSystem: ReputationSystem | null = null
let globalBiasSystem: CognitiveBiasSystem | null = null
let globalResourceSystem: ResourceCompetitionSystem | null = null
let globalTensionSystem: DramaticTensionSystem | null = null
let globalEmergenceDetector: EmergentPropertyDetector | null = null
let globalRoleSystem: SocialRoleSystem | null = null
let globalMemeSystem: MemePropagationSystem | null = null
let globalMemorySystems: Map<string, HierarchicalMemorySystem> = new Map()
let globalAttentionMechanism: AttentionMechanism | null = null

export async function runWorldTick(world: WorldSlice, options: OrchestratorOptions = {}): Promise<WorldSlice> {
  const bus = createHookBus()
  await bus.emit('before_tick', { world })

  const nextTick = world.tick + 1
  const timestamp = new Date(Date.parse(world.time) + 1000).toISOString()

  // 初始化新系统
  const timeEngine = createTimeEngine()
  const recSystem = createRecommendationSystem()
  const knowledgeGraph = createKnowledgeGraph(world)
  const narrativeInfluence = new NarrativeInfluenceSystem()
  const collectiveMemory = new CollectiveMemorySystem()
  const decisionMaker = new AgentDecisionMaker()
  
  // 初始化 Phase 4-5 系统（全局单例）
  if (!globalReputationSystem) {
    globalReputationSystem = new ReputationSystem()
    console.log('[Orchestrator] Initialized ReputationSystem')
  }
  if (!globalBiasSystem) {
    globalBiasSystem = new CognitiveBiasSystem()
    console.log('[Orchestrator] Initialized CognitiveBiasSystem')
  }
  if (!globalResourceSystem) {
    globalResourceSystem = new ResourceCompetitionSystem()
    globalResourceSystem.initializeResources(world)
    console.log('[Orchestrator] Initialized ResourceCompetitionSystem')
  }
  if (!globalTensionSystem) {
    globalTensionSystem = new DramaticTensionSystem()
    console.log('[Orchestrator] Initialized DramaticTensionSystem')
  }
  if (!globalEmergenceDetector) {
    globalEmergenceDetector = new EmergentPropertyDetector()
    console.log('[Orchestrator] Initialized EmergentPropertyDetector')
  }
  if (!globalRoleSystem) {
    globalRoleSystem = new SocialRoleSystem()
    console.log('[Orchestrator] Initialized SocialRoleSystem')
  }
  if (!globalMemeSystem) {
    globalMemeSystem = new MemePropagationSystem()
    console.log('[Orchestrator] Initialized MemePropagationSystem')
  }
  if (!globalAttentionMechanism) {
    globalAttentionMechanism = new AttentionMechanism()
    console.log('[Orchestrator] Initialized AttentionMechanism')
  }
  
  const reputationSystem = globalReputationSystem
  const biasSystem = globalBiasSystem
  const resourceSystem = globalResourceSystem
  const tensionSystem = globalTensionSystem
  const emergenceDetector = globalEmergenceDetector
  const roleSystem = globalRoleSystem
  const memeSystem = globalMemeSystem
  const attentionMechanism = globalAttentionMechanism

  // 时间引擎：初始化所有 agents 的时间模式（如果还没有）
  const npcsWithTimePatterns = timeEngine.initializeTimePatterns(world.agents.npcs)

  // 时间引擎：获取当前时间应该激活的 agents
  const activeNpcs = timeEngine.getActiveAgents(npcsWithTimePatterns, world)
  
  console.log(`[Orchestrator] Tick ${nextTick}: ${activeNpcs.length}/${npcsWithTimePatterns.length} agents active`)

  // Parallel update for personal agent
  const updatedMemoryShort = applyMemoryDecay(world.agents.personal.memory_short)
  const updatedMemoryLong = applyMemoryDecay(world.agents.personal.memory_long)
  const updatedVitals = updateVitalsAfterTick(world.agents.personal.vitals)
  const updatedPersona = applyPersonaDrift(world.agents.personal.persona, [])

  // Parallel update for all NPC agents (只更新激活的 agents)
  const updatedNpcs = await Promise.all(
    npcsWithTimePatterns.map(async (npc) => {
      // 如果 agent 未激活，直接返回
      if (!activeNpcs.find(a => a.genetics.seed === npc.genetics.seed)) {
        return npc
      }
      
      return {
        ...npc,
        memory_short: applyMemoryDecay(npc.memory_short),
        memory_long: applyMemoryDecay(npc.memory_long),
        vitals: updateVitalsAfterTick(npc.vitals),
        persona: applyPersonaDrift(npc.persona, []),
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

  if (options.nuwa) {
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
    nuwa.createAgent(options.nuwa)
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

  if (!options.panguRegistry) {
    await bus.emit('after_tick', { world: baseNext })
    return baseNext
  }

  // 并行执行 Pangu agents 和 NPC agents（只执行激活的 agents）
  const [panguResults, npcResults] = await Promise.all([
    options.panguRegistry.runAll(world),
    executeNpcAgents({ ...world, agents: { ...world.agents, npcs: activeNpcs } }),
  ])

  // 合并所有 agent 的结果
  const allResults = [
    ...panguResults,
    ...npcResults.map(r => ({ agentId: r.agentId, patch: r.patch })),
  ]

  const patch = arbitratePatches(allResults as { agentId: string; patch?: any; error?: string }[])

  // 应用 NPC agents 的状态更新
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

  // 后土系统 - 生死轮回判定
  const houtuConfig = createHoutuConfig()
  const houtuEvents: Array<{ id: string; type: string; timestamp: string; payload?: Record<string, unknown> }> = []
  
  // 1. 判定生死
  const updatedNpcsAfterHoutu: PersonalAgentState[] = []
  const deadAgents: PersonalAgentState[] = []
  
  for (const npc of next.agents.npcs) {
    const judgment = judgeLife(npc, next.tick, houtuConfig)
    
    if (judgment.should_die && npc.life_status === 'alive') {
      // 标记为死亡
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
  
  // 2. 处理轮回
  const reincarnatedAgents: PersonalAgentState[] = []
  
  for (const deadAgent of deadAgents) {
    const reincarnation = decideReincarnation(deadAgent, next.tick, houtuConfig)
    
    if (reincarnation.should_reincarnate) {
      // 创建轮回后的新 agent
      const newAgent = createPersonalAgent(`${deadAgent.genetics.seed}-reborn-${next.tick}`)
      newAgent.life_status = 'alive'
      newAgent.identity.name = `${deadAgent.identity.name}·转世`
      
      // 继承部分特质
      if (reincarnation.inherited_traits) {
        if (reincarnation.inherited_traits.goals) {
          newAgent.goals = reincarnation.inherited_traits.goals
        }
        if (reincarnation.inherited_traits.relations) {
          newAgent.relations = reincarnation.inherited_traits.relations
        }
        if (reincarnation.inherited_traits.memories) {
          // 将记忆转为模糊的长期记忆
          newAgent.memory_long = reincarnation.inherited_traits.memories.map((content, idx) => ({
            id: `inherited-${next.tick}-${idx}`,
            content: `前世记忆：${content}`,
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
  
  // 3. 清理死亡 agents（延迟清理）
  const cleanedNpcs = updatedNpcsAfterHoutu.filter(npc => {
    if (npc.life_status === 'dead' && npc.death_tick) {
      const ticksSinceDeath = next.tick - npc.death_tick
      return ticksSinceDeath < houtuConfig.cleanup_delay
    }
    return true
  })
  
  // 4. 添加轮回的新 agents
  const finalNpcs = [...cleanedNpcs, ...reincarnatedAgents]
  
  // 更新世界状态
  next = {
    ...next,
    agents: {
      ...next.agents,
      npcs: finalNpcs,
    },
    events: [...next.events, ...houtuEvents],
  }

  // 涌现式叙事系统 - 识别叙事模式
  const narrativeRecognizer = new NarrativeRecognizer()
  
  // 1. 识别新的叙事模式（从最近 100 个事件）
  const recentEvents = next.events.slice(-100)
  const newPatterns = await narrativeRecognizer.recognizePatterns(recentEvents, next)
  
  // 2. 更新现有叙事模式（追踪发展）
  const recentEventsForTracking = next.events.slice(-10)
  const updatedPatterns = await Promise.all(
    next.narratives.patterns.map(pattern =>
      narrativeRecognizer.trackNarrativeDevelopment(pattern, recentEventsForTracking, next)
    )
  )
  
  // 3. 合并新旧模式（去重）
  const allPatterns = [...updatedPatterns, ...newPatterns]
  const uniquePatterns = allPatterns.filter((pattern, index, self) =>
    index === self.findIndex(p => p.id === pattern.id)
  )
  
  // 4. 检测故事弧
  const storyArcDetector = new StoryArcDetector()
  const detectedArcs = await storyArcDetector.detectArcs(uniquePatterns)
  
  // 5. 更新现有故事弧
  const updatedArcs = await Promise.all(
    next.narratives.arcs.map(async arc => {
      // 找到相关的新模式
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
  
  // 6. 合并新旧故事弧
  const allArcs = [...updatedArcs, ...detectedArcs]
  const uniqueArcs = allArcs.filter((arc, index, self) =>
    index === self.findIndex(a => a.id === arc.id)
  )
  
  // 7. 生成叙事总结（每 10 个 tick）
  let summaries = next.narratives.summaries
  if (next.tick % 10 === 0 && uniquePatterns.length > 0) {
    const summarizer = new NarrativeSummarizer()
    const newSummary = await summarizer.summarize(uniquePatterns, next.events)
    summaries = [...summaries, newSummary]
    
    console.log(`[NarrativeSummarizer] Generated summary: "${newSummary.title}"`)
  }
  
  // 8. 更新统计信息
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
  
  // 9. 更新世界的叙事系统
  next = {
    ...next,
    narratives: {
      patterns: uniquePatterns,
      arcs: uniqueArcs,
      summaries,
      stats: narrativeStats
    }
  }
  
  // 10. 叙事影响系统 - 让叙事影响 agents
  const npcsWithNarrativeInfluence = next.agents.npcs.map(agent =>
    narrativeInfluence.applyNarrativeInfluence(agent, uniquePatterns, next)
  )
  
  // 11. 群体记忆系统 - 检测和传播群体记忆
  const newCollectiveMemories = collectiveMemory.detectCollectiveMemory(
    npcsWithNarrativeInfluence,
    next.tick
  )
  
  if (newCollectiveMemories.length > 0) {
    console.log(`[CollectiveMemory] Formed ${newCollectiveMemories.length} new collective memories`)
    
    // 传播群体记忆
    const npcsWithCollectiveMemory = collectiveMemory.propagateMemory(
      newCollectiveMemories[0],  // 传播第一个群体记忆
      npcsWithNarrativeInfluence,
      next.tick
    )
    
    // 提取文化规范
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
  
  // 群体记忆统计
  const memoryStats = collectiveMemory.getStats()
  if (memoryStats.total_memories > 0) {
    console.log(`[CollectiveMemory] ${memoryStats.total_memories} memories, ${memoryStats.total_norms} norms`)
  }

  // 知识图谱更新：重建图谱（每个 tick）
  const updatedKnowledgeGraph = createKnowledgeGraph(next)
  const graphStats = updatedKnowledgeGraph.getStats()
  console.log(`[KnowledgeGraph] Tick ${nextTick}: ${graphStats.totalNodes} nodes, ${graphStats.totalEdges} edges`)

  // 时间引擎统计
  const activityStats = timeEngine.getActivityStats(next)
  console.log(`[TimeEngine] Activity: ${activityStats.active}/${activityStats.total} (${(activityStats.activityRate * 100).toFixed(1)}%)`)

  // ===== Phase 4-5: 高级机制系统 =====
  
  // 1. 声誉系统 - 更新社交网络和应用衰减
  reputationSystem.updateSocialNetwork(next)
  reputationSystem.applyDecay(nextTick)
  const reputationStats = reputationSystem.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[ReputationSystem] Avg trust: ${reputationStats.avg_trustworthiness.toFixed(2)}, Events: ${reputationStats.total_events}`)
  }
  
  // 2. 社会角色系统 - 为所有 agents 分配角色
  const npcsWithRoles = next.agents.npcs.map(agent => {
    const roles = roleSystem.assignRoles(agent, next)
    const conflicts = roleSystem.detectRoleConflicts(agent)
    return agent  // 角色信息存储在 roleSystem 中
  })
  const roleStats = roleSystem.getStats()
  if (nextTick % 10 === 0 && roleStats.total_roles > 0) {
    console.log(`[RoleSystem] ${roleStats.total_roles} roles, ${roleStats.total_conflicts} conflicts`)
  }
  
  // 3. 资源竞争系统 - 分配资源
  const resourceResults = resourceSystem.allocateAllResources(next.agents.npcs)
  resourceSystem.regenerateResources()
  const resourceStats = resourceSystem.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[ResourceSystem] Scarcity: ${resourceStats.scarcity_avg.toFixed(2)}, Claims: ${resourceStats.total_claims}`)
  }
  
  // 4. 戏剧张力系统 - 检测和累积张力
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
  
  // 5. 涌现属性检测器 - 检测涌现
  const worldHistory = []  // TODO: 维护历史窗口
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
  
  // 6. 模因传播系统 - 提取和传播模因
  // 从 agents 提取新模因
  for (const agent of next.agents.npcs.slice(0, 5)) {  // 每次只从 5 个 agents 提取
    const newMemes = memeSystem.extractMemesFromAgent(agent, nextTick)
  }
  
  // 传播现有模因
  const socialNetwork = new Map<string, Set<string>>()
  for (const agent of next.agents.npcs) {
    const friends = new Set<string>()
    for (const [target, value] of Object.entries(agent.relations)) {
      if (value > 0.3) friends.add(target)
    }
    socialNetwork.set(agent.genetics.seed, friends)
  }
  
  const allMemes = Array.from(memeSystem.getAllMemes().values())
  for (const meme of allMemes.slice(0, 10)) {  // 每次只传播 10 个模因
    memeSystem.propagateMeme(meme, socialNetwork, next.agents.npcs, nextTick)
  }
  
  // 模因衰减
  memeSystem.decayMemes(nextTick)
  
  const memeStats = memeSystem.getStats()
  if (nextTick % 10 === 0 && memeStats.total_memes > 0) {
    console.log(`[MemeSystem] Memes: ${memeStats.total_memes}, Transmissions: ${memeStats.successful_transmissions}, Mutation rate: ${(memeStats.mutation_rate * 100).toFixed(1)}%`)
  }
  
  // 7. 注意力机制 - 分配注意力
  const npcsWithAttention = next.agents.npcs.map(agent => {
    const stimuli = attentionMechanism.generateStimuliFromWorld(next, agent)
    const allocations = attentionMechanism.allocateAttention(agent, stimuli, nextTick)
    
    // 如果在休息，恢复注意力
    if (agent.vitals.energy > 0.7 && agent.vitals.stress < 0.3) {
      attentionMechanism.recoverAttention(agent)
    }
    
    return agent  // 注意力状态存储在 attentionMechanism 中
  })
  
  const attentionStats = attentionMechanism.getStats()
  if (nextTick % 10 === 0) {
    console.log(`[AttentionMechanism] Avg focus: ${attentionStats.avg_focus_count.toFixed(1)}/${attentionStats.avg_capacity.toFixed(1)}, Fatigue: ${(attentionStats.avg_fatigue * 100).toFixed(1)}%`)
  }
  
  // 8. 分层记忆系统 - 为每个 agent 管理记忆（按需初始化）
  for (const agent of next.agents.npcs) {
    if (!globalMemorySystems.has(agent.genetics.seed)) {
      const memorySystem = new HierarchicalMemorySystem()
      memorySystem.migrateFromAgent(agent, nextTick)
      globalMemorySystems.set(agent.genetics.seed, memorySystem)
    }
    
    const memorySystem = globalMemorySystems.get(agent.genetics.seed)!
    
    // 应用衰减和巩固
    memorySystem.applyDecay(nextTick)
    
    // 导出回 agent（保持兼容性）
    const exported = memorySystem.exportToAgent()
    agent.memory_short = exported.memory_short
    agent.memory_long = exported.memory_long
  }
  
  // 记忆系统统计（采样）
  if (nextTick % 10 === 0 && globalMemorySystems.size > 0) {
    const sampleSystem = Array.from(globalMemorySystems.values())[0]
    const memStats = sampleSystem.getStats()
    console.log(`[MemorySystem] WM: ${memStats.working_memory.count}/${memStats.working_memory.capacity}, STM: ${memStats.short_term_memory.count}/${memStats.short_term_memory.capacity}, LTM: ${memStats.long_term_memory.count}`)
  }
  
  // 更新 next 的 agents
  next = {
    ...next,
    agents: {
      ...next.agents,
      npcs: npcsWithAttention
    }
  }

  await bus.emit('after_tick', { world: next })

  return next
}
