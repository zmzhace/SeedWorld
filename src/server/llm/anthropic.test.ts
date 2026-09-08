import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ constructor: vi.fn(), create: vi.fn() }))

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = { completions: { create: mocks.create } }
    constructor(options: unknown) { mocks.constructor(options) }
  },
}))

describe('OpenAI-compatible model facade', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.constructor.mockClear()
    mocks.create.mockReset()
    process.env.WORLD_SLICE_API_KEY = 'test-key'
    process.env.WORLD_SLICE_API_BASE = 'https://openrouter.ai/api/v1'
    process.env.WORLD_SLICE_MODEL = 'openrouter/free'
  })

  it('does not construct a client at module import time', async () => {
    await import('./anthropic')
    expect(mocks.constructor).not.toHaveBeenCalled()
  })

  it('streams text through the configured compatible client on demand', async () => {
    mocks.create.mockResolvedValue((async function* () { yield { choices: [{ delta: { content: 'summary' } }] } })())
    const { summarizeObservation } = await import('./anthropic')
    await expect(summarizeObservation({ prompt: 'test', world: { tick: 1 } })).resolves.toBe('summary')
    expect(mocks.constructor).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ model: 'openrouter/free', stream: true }))
  })
})
