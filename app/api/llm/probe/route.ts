import { NextResponse } from 'next/server'
import { getModel, getOpenAIClient, llmConfig } from '@/server/llm/openai-compat'

export const runtime = 'nodejs'

/**
 * Read-only provider liveness probe (ainovel-cli #91 `observe-probe` idea):
 * one minimal request against the configured model. Catches bad keys,
 * wrong base URLs and empty credit BEFORE a multi-step extraction burns time.
 */
export async function POST() {
  const startedAt = Date.now()
  try {
    const { baseURL } = llmConfig()
    const model = getModel()
    const completion = await getOpenAIClient().chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    })
    return NextResponse.json({
      ok: true,
      model,
      baseURL,
      latencyMs: Date.now() - startedAt,
      reply: completion.choices[0]?.message?.content ?? '',
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    return NextResponse.json(
      {
        ok: false,
        model: process.env.WORLD_SLICE_MODEL || '',
        baseURL: process.env.WORLD_SLICE_API_BASE || '',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        status: status ?? null,
      },
      { status: 200 },
    )
  }
}
