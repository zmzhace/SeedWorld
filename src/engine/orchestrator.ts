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

type OrchestratorOptions = {
  search?: () => Promise<SearchSignal[]>
  nuwa?: { trigger: 'event'; seed: string; environment: { region: string; social_state: string } }
  panguRegistry?: { runAll: (world: WorldSlice) => Promise<{ agentId: string; patch?: unknown; error?: string }[]> }
}

export async function runWorldTick(world: WorldSlice, options: OrchestratorOptions = {}): Promise<WorldSlice> {
  const bus = createHookBus()
  await bus.emit('before_tick', { world })

  const nextTick = world.tick + 1
  const timestamp = new Date(Date.parse(world.time) + 1000).toISOString()

  // Parallel update for personal agent
  const updatedMemoryShort = applyMemoryDecay(world.agents.personal.memory_short)
  const updatedMemoryLong = applyMemoryDecay(world.agents.personal.memory_long)
  const updatedVitals = updateVitalsAfterTick(world.agents.personal.vitals)
  const updatedPersona = applyPersonaDrift(world.agents.personal.persona, [])

  // Parallel update for all NPC agents
  const updatedNpcs = await Promise.all(
    world.agents.npcs.map(async (npc) => ({
      ...npc,
      memory_short: applyMemoryDecay(npc.memory_short),
      memory_long: applyMemoryDecay(npc.memory_long),
      vitals: updateVitalsAfterTick(npc.vitals),
      persona: applyPersonaDrift(npc.persona, []),
    }))
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

  // 并行执行 Pangu agents 和 NPC agents
  const [panguResults, npcResults] = await Promise.all([
    options.panguRegistry.runAll(world),
    executeNpcAgents(world),
  ])

  // 合并所有 agent 的结果
  const allResults = [
    ...panguResults,
    ...npcResults.map(r => ({ agentId: r.agentId, patch: r.patch })),
  ]

  const patch = arbitratePatches(allResults as { agentId: string; patch?: any; error?: string }[])

  let next: WorldSlice = {
    ...baseNext,
    tick: baseNext.tick + patch.timeDelta,
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
          role: npc.role,
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
      newAgent.role = reincarnation.new_role || 'npc'
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
          old_role: deadAgent.role,
          new_role: newAgent.role,
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

  await bus.emit('after_tick', { world: next })

  return next
}
