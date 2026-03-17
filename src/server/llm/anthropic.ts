import Anthropic from '@anthropic-ai/sdk'

/**
 * 创建 Anthropic client 的统一工厂函数
 * 解决系统环境变量 ANTHROPIC_AUTH_TOKEN 与 .env.local 冲突的问题：
 * SDK 会自动把 ANTHROPIC_AUTH_TOKEN 写入 Authorization: Bearer header，
 * 即使我们显式传了 apiKey（写入 x-api-key header），两个 header 会冲突。
 * 所以这里统一用 defaultHeaders 覆盖 Authorization header。
 */
export function createAnthropicClient() {
  const apiKey = process.env.WORLD_SLICE_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || ''
  const baseURL = process.env.WORLD_SLICE_API_BASE || process.env.ANTHROPIC_BASE_URL

  return new Anthropic({
    apiKey,
    baseURL,
    defaultHeaders: {
      'authorization': `Bearer ${apiKey}`,
    },
  })
}

export function getModel() {
  return process.env.WORLD_SLICE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
}

/**
 * 流式调用 LLM 并收集完整文本响应。
 * 所有 LLM 调用都必须走流式，否则超过 10 分钟会被 SDK 拒绝。
 */
export async function streamText(
  client: Anthropic,
  params: { model: string; max_tokens: number; messages: Anthropic.MessageCreateParams['messages'] }
): Promise<string> {
  const stream = client.messages.stream({
    model: params.model,
    max_tokens: params.max_tokens,
    messages: params.messages,
  })
  const response = await stream.finalMessage()
  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : ''
}

type ObservationInput = {
  prompt: string
  world: unknown
}

export async function summarizeObservation(input: ObservationInput): Promise<string> {
  return streamText(createAnthropicClient(), {
    model: getModel(),
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate a natural language observation summary.\n\nUser prompt: ${input.prompt}\nWorld: ${JSON.stringify(input.world)}`,
      },
    ],
  })
}
