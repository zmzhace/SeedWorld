import { describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = {
      create: async () => ({ content: [{ type: 'text', text: 'summary' }] }),
    }
  },
}))

import { summarizeObservation } from './anthropic'

it('returns summary text from LLM response', async () => {
  const result = await summarizeObservation({ prompt: 'test', world: { tick: 1 } })
  expect(result).toBe('summary')
})
