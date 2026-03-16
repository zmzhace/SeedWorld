import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import { createAnthropicClient, getModel, streamText } from './llm/anthropic'

type AgentChatInput = {
  message: string
  agentSeed: string
  world: WorldSlice
}

type AgentChatResult = {
  reply: string
  agentName: string
  agentSeed: string
}

/**
 * Build a prompt for the agent to respond to a direct message.
 */
function buildAgentChatPrompt(
  agent: PersonalAgentState,
  message: string,
  world: WorldSlice,
): string {
  const language = world.config?.language || 'en'

  // Get recent memories
  const recentMemories = [...agent.memory_short, ...agent.memory_long]
    .slice(-5)
    .map(m => `- ${m.content}`)
    .join('\n')

  // Get current goals
  const goals = agent.goals
    .map(g => `- ${g}`)
    .join('\n')

  // Get relationships
  const relationships = Object.entries(agent.relations)
    .map(([seed, strength]) => {
      const other = world.agents.npcs.find(a => a.genetics.seed === seed)
      const strengthNum = typeof strength === 'number' ? strength : 0
      return other ? `- ${other.identity.name}: ${strengthNum >= 0.5 ? 'positive' : 'negative'} (${strengthNum.toFixed(2)})` : null
    })
    .filter(Boolean)
    .join('\n')

  return `You are ${agent.identity.name}, a character in a simulated world.

# Your Identity
- Name: ${agent.identity.name}
- Occupation: ${agent.occupation || 'unknown'}
- Voice: ${agent.voice || 'neutral'}
- Approach: ${agent.approach || 'balanced'}
- Core belief: ${agent.core_belief || 'none'}

# Your Current State
- Location: ${agent.location || 'unknown'}
- Emotion: ${agent.emotion.label} (intensity: ${agent.emotion.intensity.toFixed(2)})

# Your Goals
${goals || 'No active goals'}

# Your Recent Memories
${recentMemories || 'No recent memories'}

# Your Relationships
${relationships || 'No relationships yet'}

# World Context
${world.environment.description}

---

A person is talking to you directly. They said: "${message}"

Respond as ${agent.identity.name} would, based on your personality, memories, and current state. Be natural and conversational. Stay in character.

IMPORTANT: Respond in the language matching this code: "${language}". If "zh", write in Chinese. If "en", write in English.

Do NOT include any JSON or metadata. Just write your response as ${agent.identity.name}.`
}

/**
 * Handle a direct chat with a specific agent.
 */
export async function handleAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const { message, agentSeed, world } = input

  // Find the agent
  const agent = world.agents.npcs.find(a => a.genetics.seed === agentSeed)
  if (!agent) {
    throw new Error(`Agent with seed "${agentSeed}" not found`)
  }

  if (agent.life_status !== 'alive') {
    throw new Error(`Agent ${agent.identity.name} is not alive`)
  }

  // Build prompt and get LLM response
  const client = createAnthropicClient()
  const model = getModel()
  const prompt = buildAgentChatPrompt(agent, message, world)

  const reply = await streamText(client, {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  return {
    reply,
    agentName: agent.identity.name,
    agentSeed: agent.genetics.seed,
  }
}
