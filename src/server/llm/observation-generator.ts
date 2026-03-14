import Anthropic from '@anthropic-ai/sdk'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'

type ObservationOptions = {
  world: WorldSlice
  agent: PersonalAgentState
}

export async function generateObservationSummary(
  options: ObservationOptions
): Promise<string> {
  const { world, agent } = options

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  // Get recent memories
  const recentMemories = [...agent.memory_short, ...agent.memory_long]
    .slice(-5)
    .map((m) => `- ${m.content} (importance: ${m.importance})`)
    .join('\n')

  // Get recent events
  const recentEvents = world.events
    .slice(-10)
    .map((e) => `- ${e.type} at ${e.timestamp}`)
    .join('\n')

  // Get other agents (excluding this one)
  const otherAgents = Object.entries(world.agents)
    .filter(([key, a]) => {
      if (key === 'npcs') return false // Skip npcs array
      if (typeof a === 'object' && a !== null && 'kind' in a && a.kind === 'personal') {
        return (a as PersonalAgentState).genetics.seed !== agent.genetics.seed
      }
      return true
    })
    .map(([key, a]) => {
      if (typeof a === 'object' && a !== null && 'kind' in a) {
        return `- ${key}: ${(a as { kind: string }).kind}`
      }
      return `- ${key}: unknown`
    })
    .join('\n')

  const prompt = `You are observing the world through the perspective of agent "${agent.genetics.seed}".

Agent State:
- Persona: openness=${agent.persona.openness}, stability=${agent.persona.stability}, attachment=${agent.persona.attachment}, agency=${agent.persona.agency}, empathy=${agent.persona.empathy}
- Vitals: energy=${agent.vitals.energy}, stress=${agent.vitals.stress}, sleep_debt=${agent.vitals.sleep_debt}, focus=${agent.vitals.focus}, aging=${agent.vitals.aging_index}
- Emotion: ${agent.emotion.label} (intensity: ${agent.emotion.intensity})
- Recent memories:
${recentMemories || '  (none yet)'}

World State:
- Tick: ${world.tick}
- Time: ${world.time}
- Environment: ${world.environment.description}
- Recent events:
${recentEvents || '  (none yet)'}

Other Agents:
${otherAgents || '  (none yet)'}

Social Context:
- Narratives: ${world.social_context.narratives.join(', ') || '(none)'}
- Pressures: ${world.social_context.pressures.join(', ') || '(none)'}
- Macro events: ${world.social_context.macro_events.join(', ') || '(none)'}

Generate a natural language observation summary covering:
1. World understanding (what's happening in the world)
2. Understanding of other agents (who else is here, what are they doing)
3. Social event understanding (broader social/cultural context)
4. Memory/cognition (what this agent remembers and thinks about)
5. Self-state understanding (how this agent feels physically and emotionally)

Write in first person from the agent's perspective. Be concise but comprehensive (3-5 sentences).`

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Handle both standard and streaming responses
  let responseText = ''
  
  // Parse SSE format or standard format
  const responseAny = response as any
  if (typeof responseAny === 'string') {
    // Parse SSE format
    const lines = responseAny.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6))
          if (data.type === 'content_block_delta' && data.delta?.text) {
            responseText += data.delta.text
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  } else if (responseAny.content && responseAny.content[0]) {
    // Standard Anthropic format
    const content = responseAny.content[0]
    if (content.type === 'text') {
      responseText = content.text
    }
  }

  if (!responseText) {
    throw new Error('No text content in response')
  }

  return responseText
}
