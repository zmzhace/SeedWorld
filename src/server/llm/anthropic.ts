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

// 保留原有的 summarizeObservation 功能
const client = createAnthropicClient()

type ObservationInput = {
  prompt: string
  world: unknown
}

export async function summarizeObservation(input: ObservationInput): Promise<string> {
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 512,
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
