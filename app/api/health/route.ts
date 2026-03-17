import { NextResponse } from 'next/server'
import { createAnthropicClient, getModel } from '@/server/llm/anthropic'

export async function GET() {
  try {
    const client = createAnthropicClient()
    const model = getModel()

    return NextResponse.json({
      status: 'ok',
      env: {
        hasApiKey: !!process.env.WORLD_SLICE_API_KEY,
        hasApiBase: !!process.env.WORLD_SLICE_API_BASE,
        model,
        nodeEnv: process.env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: (error as Error).message,
      stack: (error as Error).stack,
    }, { status: 500 })
  }
}
