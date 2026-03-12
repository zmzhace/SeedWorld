import Anthropic from '@anthropic-ai/sdk'
import type { PersonalAgentState } from '@/domain/world'
import { createPersonalAgent } from '@/domain/agents'

type GenerateAgentsOptions = {
  prompt: string
  count: number
}

type AgentSpec = {
  seed: string
  persona: {
    openness: number
    stability: number
    attachment: number
    agency: number
    empathy: number
  }
  vitals: {
    energy: number
    stress: number
    sleep_debt: number
    focus: number
    aging_index: number
  }
  backstory?: string
}

export async function generatePersonalAgents(
  options: GenerateAgentsOptions
): Promise<PersonalAgentState[]> {
  const { prompt, count } = options

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  const systemPrompt = `Generate ${count} distinct personal agents based on this description: "${prompt}"

For each agent, provide:
- A unique seed identifier (kebab-case, descriptive)
- Persona traits (openness, stability, attachment, agency, empathy) as values 0-1
- Initial vitals (energy, stress, sleep_debt, focus, aging_index) as values 0-1
- A brief backstory or motivation (optional)

Return as JSON array with this structure:
[
  {
    "seed": "curious-explorer",
    "persona": { "openness": 0.8, "stability": 0.6, "attachment": 0.5, "agency": 0.7, "empathy": 0.6 },
    "vitals": { "energy": 0.8, "stress": 0.2, "sleep_debt": 0.1, "focus": 0.7, "aging_index": 0.1 },
    "backstory": "A curious soul driven by wonder"
  }
]`

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: systemPrompt,
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

  // Extract JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse agent specifications from response')
  }

  const specs: AgentSpec[] = JSON.parse(jsonMatch[0])

  // Convert specs to PersonalAgentState
  return specs.map((spec) => {
    const agent = createPersonalAgent(spec.seed)
    return {
      ...agent,
      persona: spec.persona,
      vitals: spec.vitals,
    }
  })
}
