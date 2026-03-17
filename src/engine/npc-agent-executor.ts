import type { PersonalAgentState, WorldSlice, MemoryRecord } from '@/domain/world'
import type { AgentPatch } from '@/domain/agents'
import type { LLMDecisionResult, SystemFeedback } from '@/server/llm/agent-decision-llm'
import { selectConversationPairs, runConversationScene } from './conversation-scene'
import type { ConversationResult } from '../domain/conversation'

/**
 * NPC Agent Executor - 分波执行，同位置互动者能看到彼此的行动
 */

type AgentDecision = {
  agentId: string
  action: {
    type: string
    target?: string
    intensity: number
  }
  reasoning?: string
  inner_monologue?: string
  dialogue?: string
  behavior_description?: string
  new_location?: string
  effects?: {
    energy_delta: number
    stress_delta: number
    focus_delta: number
    emotion: string
    emotion_intensity: number
    relationship_delta?: number
    is_conflict: boolean
    goal_progress?: string
  }
  systemFeedback?: SystemFeedback
}

/**
 * 为单个 NPC agent 生成决策（通过 LLM API）
 * thisTickContext: 本轮已经发生的事（同位置的人的行动）
 */
async function makeAgentDecision(
  agent: PersonalAgentState,
  world: WorldSlice,
  thisTickContext?: string
): Promise<AgentDecision> {
  try {
    const baseUrl = typeof window !== 'undefined'
      ? ''
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds

    const res = await fetch(`${baseUrl}/api/agents/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, world, thisTickContext }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `API ${res.status}`)
    }

    const { result: llmResult } = await res.json() as { result: LLMDecisionResult }
    console.log(`[LLM Agent] ${agent.identity.name}: ${llmResult.action.type} - ${llmResult.behavior_description.substring(0, 60)}...`)
    return {
      agentId: agent.genetics.seed,
      action: llmResult.action,
      reasoning: llmResult.reasoning,
      inner_monologue: llmResult.inner_monologue,
      dialogue: llmResult.dialogue,
      behavior_description: llmResult.behavior_description,
      new_location: llmResult.new_location,
      effects: llmResult.effects,
      systemFeedback: llmResult.system_feedback,
    }
  } catch (error) {
    console.warn(`[LLM Agent] ${agent.identity.name} LLM failed, using minimal fallback:`, (error as Error).message)
    return makeMinimalFallback(agent)
  }
}

/**
 * 最小 fallback — 只在 LLM 完全不可用时触发
 */
function makeMinimalFallback(agent: PersonalAgentState): AgentDecision {
  const name = agent.identity.name
  const goal = agent.goals[0]
  const desc = goal
    ? `${name} is deep in thought, pondering how to advance "${goal}".`
    : `${name} quietly observes the surroundings, contemplating their situation.`
  return {
    agentId: agent.genetics.seed,
    action: { type: 'contemplate', intensity: 0.3 },
    behavior_description: desc,
    new_location: agent.location,
    effects: {
      energy_delta: -0.03, stress_delta: -0.05, focus_delta: 0.05,
      emotion: 'pensive', emotion_intensity: 0.3,
      is_conflict: false,
    },
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * 将 agent 决策转换为世界补丁
 */
function decisionToPatch(decision: AgentDecision, agent: PersonalAgentState, world: WorldSlice): { patch: AgentPatch; updatedAgent: PersonalAgentState } {
  const { action, effects } = decision
  const updatedAgent = { ...agent }

  if (effects) {
    updatedAgent.vitals = {
      ...updatedAgent.vitals,
      energy: clamp(updatedAgent.vitals.energy + effects.energy_delta, 0, 1),
      stress: clamp(updatedAgent.vitals.stress + effects.stress_delta, 0, 1),
      focus: clamp(updatedAgent.vitals.focus + effects.focus_delta, 0, 1),
    }
    updatedAgent.emotion = {
      label: effects.emotion,
      intensity: clamp(effects.emotion_intensity, 0, 1),
    }
    if (action.target && effects.relationship_delta != null) {
      updatedAgent.relations = {
        ...updatedAgent.relations,
        [action.target]: clamp(
          (updatedAgent.relations[action.target] || 0) + effects.relationship_delta,
          -1, 1
        ),
      }
    }
    if (effects.goal_progress && updatedAgent.goals.length > 0) {
      const goalIdx = updatedAgent.goals.findIndex(g => g.includes(effects.goal_progress!) || effects.goal_progress!.includes(g))
      if (goalIdx >= 0 && updatedAgent.success_metrics) {
        updatedAgent.success_metrics.power = (updatedAgent.success_metrics.power || 0) + 1
      }
    }
  } else {
    updatedAgent.vitals = {
      ...updatedAgent.vitals,
      energy: clamp(updatedAgent.vitals.energy - 0.05, 0, 1),
    }
  }

  updatedAgent.vitals.aging_index = Math.min(1, updatedAgent.vitals.aging_index + 0.001)

  updatedAgent.action_history = [
    ...(updatedAgent.action_history || []),
    { type: action.type, timestamp: new Date().toISOString() }
  ]

  const memoryContent = decision.behavior_description || action.type
  updatedAgent.memory_short = [
    ...(updatedAgent.memory_short || []),
    {
      id: `decision-${agent.genetics.seed}-${world.tick}`,
      content: memoryContent,
      importance: action.intensity * 0.6,
      emotional_weight: (effects?.emotion_intensity || 0.3) * 0.4,
      source: 'self' as const,
      timestamp: new Date().toISOString(),
      decay_rate: 0.1,
      retrieval_strength: 0.7,
    }
  ].slice(-20)

  updatedAgent.last_action_description = decision.behavior_description
  updatedAgent.last_dialogue = decision.dialogue
  updatedAgent.last_inner_monologue = decision.inner_monologue
  if (decision.new_location) {
    updatedAgent.location = decision.new_location
  }

  // Build rich summary: behavior + dialogue + inner monologue
  const summaryParts: string[] = []
  if (decision.behavior_description) summaryParts.push(decision.behavior_description)
  if (decision.dialogue) summaryParts.push(`"${decision.dialogue}"`)
  if (decision.inner_monologue) summaryParts.push(`（${decision.inner_monologue}）`)
  const eventSummary = summaryParts.join(' ') || `${agent.identity.name} ${action.type}`

  const event = {
    id: `agent-${agent.genetics.seed}-${world.tick}`,
    kind: 'micro' as const,
    summary: eventSummary,
    conflict: effects?.is_conflict || false,
  }

  const notes: string[] = []
  if (decision.reasoning) notes.push(decision.reasoning)
  if (decision.inner_monologue) notes.push(`💭 ${decision.inner_monologue}`)
  if (decision.dialogue) notes.push(`💬 ${decision.dialogue}`)

  const patch: AgentPatch = {
    timeDelta: 0,
    events: [event],
    rulesDelta: [],
    notes,
    meta: {
      agentId: decision.agentId,
      actionType: action.type,
      intensity: action.intensity,
      dialogue: decision.dialogue,
      inner_monologue: decision.inner_monologue,
    },
  }

  return { patch, updatedAgent }
}

/**
 * 分波执行 NPC agents：
 * 1. 按位置分组，同位置的人分到同一波
 * 2. 每波内部并行决策，但波与波之间串行
 * 3. 前一波的行动结果（对话、行为）注入后一波的上下文
 * 这样同一位置的互动对象能"看到"彼此的行动并做出回应
 */
export async function executeNpcAgents(
  world: WorldSlice
): Promise<Array<{
  agentId: string
  patch: AgentPatch
  updatedAgent: PersonalAgentState
  systemFeedback?: SystemFeedback
  conversationFeedback?: Array<{ agentId: string; feedback: SystemFeedback }>
}>> {
  const { npcs } = world.agents

  if (npcs.length === 0) {
    return []
  }

  // 按位置分组
  const locationGroups = new Map<string, PersonalAgentState[]>()
  for (const npc of npcs) {
    const loc = npc.location || 'unknown'
    if (!locationGroups.has(loc)) locationGroups.set(loc, [])
    locationGroups.get(loc)!.push(npc)
  }

  const allResults: Array<{
    agentId: string
    patch: AgentPatch
    updatedAgent: PersonalAgentState
    systemFeedback?: SystemFeedback
    conversationFeedback?: Array<{ agentId: string; feedback: SystemFeedback }>
  }> = []

  // 收集本轮已发生的行动（跨位置也能看到摘要）
  const tickActions: Array<{ name: string; location: string; action: string; dialogue?: string }> = []

  // 每个位置组内分两波执行：先行动者 → 回应者
  for (const [location, agents] of locationGroups) {
    // --- Conversation pre-phase ---
    const CONVERSATION_THRESHOLD = 0.4
    const conversationPairs = selectConversationPairs(agents, world, CONVERSATION_THRESHOLD)

    // Get seeds of agents in conversations (they skip the wave)
    const conversingSeedSet = new Set(conversationPairs.flatMap(p => p.participants))
    const conversationResults: ConversationResult[] = []

    // Run all conversation scenes at this location in parallel
    if (conversationPairs.length > 0) {
      const scenePromises = conversationPairs.map(pair =>
        runConversationScene(pair.agents, pair.trigger, location, world)
      )
      conversationResults.push(...await Promise.all(scenePromises))
    }

    // Build bystander context from conversation results
    const bystanderContext = conversationResults
      .map(r => r.bystander_summary)
      .join('\n')

    // Filter out conversing agents from waves
    const waveAgents = agents.filter(
      a => !conversingSeedSet.has(a.genetics.seed)
    )

    // 第一波：随机选一半先行动
    const shuffled = [...waveAgents].sort(() => Math.random() - 0.5)
    const wave1 = shuffled.slice(0, Math.ceil(shuffled.length / 2))
    const wave2 = shuffled.slice(Math.ceil(shuffled.length / 2))

    // 构建本位置已有的上下文（来自其他位置的行动）
    const priorContext = [
      bystanderContext,
      ...tickActions
        .filter(a => a.location === location)
        .map(a => `${a.name}: ${a.action}${a.dialogue ? ` (said: "${a.dialogue}")` : ''}`),
    ].filter(Boolean).join('\n')

    // 第一波并行
    const wave1Decisions = await Promise.all(
      wave1.map(async (agent) => {
        try {
          return await makeAgentDecision(agent, world, priorContext || undefined)
        } catch (error) {
          console.error(`Failed for ${agent.identity.name}:`, error)
          return null
        }
      })
    )

    // 收集第一波结果
    const wave1Context: string[] = []
    for (const decision of wave1Decisions) {
      if (!decision) continue
      const agent = agents.find(a => a.genetics.seed === decision.agentId)
      if (!agent) continue

      const { patch, updatedAgent } = decisionToPatch(decision, agent, world)
      allResults.push({ agentId: decision.agentId, patch, updatedAgent, systemFeedback: decision.systemFeedback })

      // 记录行动供第二波参考
      const actionDesc = decision.behavior_description || decision.action.type
      wave1Context.push(
        `${agent.identity.name}${decision.dialogue ? ` said: "${decision.dialogue}"` : ''} — ${actionDesc}`
      )
      tickActions.push({
        name: agent.identity.name,
        location,
        action: actionDesc,
        dialogue: decision.dialogue,
      })
    }

    // 第二波：能看到第一波的行动
    if (wave2.length > 0) {
      const fullContext = [priorContext, ...wave1Context].filter(Boolean).join('\n')
      const contextForWave2 = fullContext
        ? `[What just happened around you]\n${fullContext}`
        : undefined

      const wave2Decisions = await Promise.all(
        wave2.map(async (agent) => {
          try {
            return await makeAgentDecision(agent, world, contextForWave2)
          } catch (error) {
            console.error(`Failed for ${agent.identity.name}:`, error)
            return null
          }
        })
      )

      for (const decision of wave2Decisions) {
        if (!decision) continue
        const agent = agents.find(a => a.genetics.seed === decision.agentId)
        if (!agent) continue

        const { patch, updatedAgent } = decisionToPatch(decision, agent, world)
        allResults.push({ agentId: decision.agentId, patch, updatedAgent, systemFeedback: decision.systemFeedback })

        tickActions.push({
          name: agent.identity.name,
          location,
          action: decision.behavior_description || decision.action.type,
          dialogue: decision.dialogue,
        })
      }
    }
    // Collect conversation results into allResults
    for (const convResult of conversationResults) {
      for (const participant of convResult.scene.participants) {
        const agent = agents.find(a => a.genetics.seed === participant)
        if (!agent) continue
        const agentRounds = convResult.scene.rounds.filter(r => r.speaker === participant)
        const lastRound = agentRounds[agentRounds.length - 1]
        if (!lastRound) continue

        const conversationMemory: MemoryRecord = {
          id: `conv-mem-${convResult.scene.id}-${participant}`,
          content: `Conversation with ${convResult.scene.participants.filter(p => p !== participant).join(', ')}: ${convResult.bystander_summary}`,
          importance: Math.min(1, 0.4 + convResult.scene.rounds.length * 0.1),
          emotional_weight: lastRound.action.intensity,
          source: 'social',
          timestamp: new Date().toISOString(),
          decay_rate: 0.02,
          retrieval_strength: 0.8,
        }

        allResults.push({
          agentId: participant,
          patch: {
            timeDelta: 0,
            events: [{
              id: `conv-${convResult.scene.id}-${participant}`,
              kind: 'micro' as const,
              summary: convResult.bystander_summary,
            }],
            rulesDelta: [],
            notes: [],
            meta: {},
          },
          updatedAgent: {
            ...agent,
            last_action_description: lastRound.dialogue,
            last_dialogue: lastRound.dialogue,
            last_inner_monologue: lastRound.inner_monologue,
            memory_short: [
              ...agent.memory_short,
              conversationMemory,
            ].slice(-20),
          },
          systemFeedback: undefined,
          conversationFeedback: convResult.accumulated_feedback,
        })
      }
    }
  }

  return allResults
}
