import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
})

type ObservationInput = {
  prompt: string
  world: unknown
}

export async function summarizeObservation(input: ObservationInput): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `Generate a natural language observation summary.\n\nUser prompt: ${input.prompt}\nWorld: ${JSON.stringify(input.world)}`,
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : ''
}
