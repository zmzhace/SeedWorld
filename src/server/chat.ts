import type { WorldSlice } from '@/domain/world'
import { runWorldTick } from '@/engine/orchestrator'
import { getDirectorRegistry } from './director-registry'
import { createAnthropicClient, getModel, streamText } from './llm/anthropic'

type ChatTurnInput = {
  message: string
  world: WorldSlice
}

type ChatTurnResult = {
  reply: string
  worldSummary: string
  world: WorldSlice
}

type LLMEventInterpretation = {
  event_description: string
  affected_agents: string[]
  event_type: 'environmental' | 'social' | 'political' | 'supernatural'
  intensity: number
}

/**
 * Build a concise world state summary for the LLM prompt.
 */
function buildWorldSummary(world: WorldSlice): string {
  const agentNames = world.agents.npcs
    .filter(a => a.life_status === 'alive')
    .map(a => `${a.identity.name} (seed: ${a.genetics.seed}, occupation: ${a.occupation || 'unknown'})`)
    .join(', ')

  const recentEvents = world.events
    .slice(-10)
    .map(e => {
      const summary = (e.payload as Record<string, unknown> | undefined)?.summary || e.type
      return `[${e.type}] ${summary}`
    })
    .join('\n')

  return [
    `World: ${world.environment.description}`,
    `Tick: ${world.tick}`,
    `Time: ${world.time}`,
    agentNames ? `Agents: ${agentNames}` : 'Agents: none',
    recentEvents ? `Recent events:\n${recentEvents}` : 'Recent events: none',
    world.social_context.macro_events.length > 0
      ? `Macro events: ${world.social_context.macro_events.slice(-5).join('; ')}`
      : '',
  ].filter(Boolean).join('\n')
}

/**
 * Use LLM to interpret a user's chat message as a world event.
 */
async function interpretMessageAsEvent(
  message: string,
  world: WorldSlice,
): Promise<LLMEventInterpretation> {
  const client = createAnthropicClient()
  const model = getModel()
  const worldSummary = buildWorldSummary(world)

  const agentSeeds = world.agents.npcs
    .filter(a => a.life_status === 'alive')
    .map(a => a.genetics.seed)

  const prompt = `You are the interpreter for a world simulation engine. A user has typed a message that should affect the simulated world. Your job is to interpret this message as a world event.

Current world state:
${worldSummary}

User's message: "${message}"

Interpret this message as a world event. What happens in this world as a result of this input? Describe the immediate effect as a world event.

Available agent seeds for affected_agents: [${agentSeeds.map(s => `"${s}"`).join(', ')}]
Only include agents in affected_agents if they would plausibly be affected. Use their seed values, not names.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "event_description": "A vivid description of what happens in the world",
  "affected_agents": ["seed1", "seed2"],
  "event_type": "environmental|social|political|supernatural",
  "intensity": 0.0-1.0
}`

  const raw = await streamText(client, {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response')
    }
    const parsed = JSON.parse(jsonMatch[0]) as LLMEventInterpretation
    // Clamp intensity
    parsed.intensity = Math.max(0, Math.min(1, parsed.intensity ?? 0.5))
    // Validate event_type
    const validTypes = ['environmental', 'social', 'political', 'supernatural']
    if (!validTypes.includes(parsed.event_type)) {
      parsed.event_type = 'social'
    }
    return parsed
  } catch {
    // Fallback if LLM returns invalid JSON
    return {
      event_description: message,
      affected_agents: [],
      event_type: 'social',
      intensity: 0.5,
    }
  }
}

/**
 * Use LLM to generate a narrative description of what happened.
 */
async function generateNarrativeReply(
  event: LLMEventInterpretation,
  world: WorldSlice,
): Promise<string> {
  const client = createAnthropicClient()
  const model = getModel()

  const language = world.config?.language || 'en'
  const affectedAgentNames = world.agents.npcs
    .filter(a => event.affected_agents.includes(a.genetics.seed))
    .map(a => a.identity.name)

  const prompt = `You are the narrator for a world simulation. An event has just occurred and you need to describe what happened in a vivid, immersive narrative style.

World setting: ${world.environment.description}
Event: ${event.event_description}
Event type: ${event.event_type}
Intensity: ${event.intensity}
Affected characters: ${affectedAgentNames.length > 0 ? affectedAgentNames.join(', ') : 'the world in general'}

Write a narrative response (2-4 sentences) describing what happened and its immediate impact on the world and characters. Be vivid and dramatic, matching the tone of the world setting.

IMPORTANT: Write your response in the language matching this code: "${language}". If the code is "zh", write in Chinese. If "en", write in English. If "ja", write in Japanese. Match the world description's language.

Do NOT include any JSON or metadata. Just write the narrative text.`

  return streamText(client, {
    model,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
}

export async function handleChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const world = input.world

  // 1. Use LLM to interpret the user's message as a world event
  const interpretation = await interpretMessageAsEvent(input.message, world)

  // 2. Create an event from the interpretation and inject into world
  const eventId = `user-event-${world.tick + 1}-${Date.now()}`
  const timestamp = new Date().toISOString()
  const worldWithEvent: WorldSlice = {
    ...world,
    events: [
      ...world.events,
      {
        id: eventId,
        type: interpretation.event_type,
        timestamp,
        payload: {
          source: 'user_chat',
          message: input.message,
          summary: interpretation.event_description,
          affected_agents: interpretation.affected_agents,
          intensity: interpretation.intensity,
        },
      },
    ],
  }

  // 3. Run a world tick so agents can react
  const next = await runWorldTick(worldWithEvent, {
    directorRegistry: getDirectorRegistry(),
  })

  // 4. Generate a narrative response describing what happened
  let reply: string
  try {
    reply = await generateNarrativeReply(interpretation, next)
  } catch {
    reply = `${interpretation.event_description} (tick ${next.tick})`
  }

  return {
    reply,
    worldSummary: `tick ${next.tick} | ${interpretation.event_type} event (intensity: ${interpretation.intensity.toFixed(1)}) | ${next.agents.npcs.filter(a => a.life_status === 'alive').length} agents alive`,
    world: next,
  }
}
