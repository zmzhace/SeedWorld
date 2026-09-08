import OpenAI from 'openai'

/**
 * Compatibility facade kept under the old filename so the simulation engine
 * can migrate providers without touching every call site. SeedWorld uses an
 * OpenAI-compatible chat endpoint selected entirely by server-side settings.
 */
export type ModelMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function createAnthropicClient(): OpenAI {
  const apiKey = (process.env.WORLD_SLICE_API_KEY || process.env.OPENROUTER_API_KEY || '').trim()
  const baseURL = (process.env.WORLD_SLICE_API_BASE || 'https://qianfan.baidubce.com/v2').trim()
  if (!apiKey) throw new Error('大模型 API Key 未配置')

  const defaultHeaders = baseURL.includes('openrouter.ai')
    ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000', 'X-Title': 'SeedWorld' }
    : undefined

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 300_000,
    maxRetries: 2,
    defaultHeaders,
  })
}

export function getModel(): string {
  return process.env.WORLD_SLICE_MODEL || process.env.OPENROUTER_MODEL || 'ernie-4.5-turbo-128k'
}

/** Stream through the configured provider and collect the complete response. */
export async function streamText(
  client: OpenAI,
  params: { model: string; max_tokens: number; messages: ModelMessage[] },
): Promise<string> {
  const stream = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    messages: params.messages,
    stream: true,
  })
  let text = ''
  for await (const chunk of stream) text += chunk.choices[0]?.delta?.content || ''
  return text
}

type ObservationInput = { prompt: string; world: unknown }

export async function summarizeObservation(input: ObservationInput): Promise<string> {
  return streamText(createAnthropicClient(), {
    model: getModel(),
    max_tokens: 2048,
    messages: [{ role: 'user', content: `Generate a natural language observation summary.\n\nUser prompt: ${input.prompt}\nWorld: ${JSON.stringify(input.world)}` }],
  })
}
