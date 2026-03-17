import { describe, expect, it, vi } from 'vitest'

const anthropicCtor = vi.fn().mockImplementation(() => ({
  messages: {
    stream: () => ({
      finalMessage: async () => ({ content: [{ type: 'text', text: 'summary' }] }),
    }),
  },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: anthropicCtor,
}))

describe('anthropic module initialization', () => {
  it('does not construct a client at module import time', async () => {
    await import('./anthropic')

    expect(anthropicCtor).not.toHaveBeenCalled()
  })

  it('constructs a client only when summarizeObservation is called', async () => {
    const { summarizeObservation } = await import('./anthropic')

    const result = await summarizeObservation({ prompt: 'test', world: { tick: 1 } })

    expect(result).toBe('summary')
    expect(anthropicCtor).toHaveBeenCalledTimes(1)
  })
})
