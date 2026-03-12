import { describe, it, expect, vi } from 'vitest'
import { generateObservationSummary } from './observation-generator'
import { createInitialWorldSlice } from '@/domain/world'
import { createPersonalAgent } from '@/domain/agents'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: 'I observe a calm world at its beginning. No other agents are present yet. The social context is quiet, with no major events unfolding. My memories are empty, as I have just awakened. I feel balanced - my energy is moderate, stress is low, and I am ready to explore.',
            },
          ],
        }),
      }
    },
  }
})

describe('generateObservationSummary', () => {
  it('generates comprehensive observation summary for selected agent', async () => {
    const world = createInitialWorldSlice()
    const agent = createPersonalAgent('test-agent')
    
    const summary = await generateObservationSummary({
      world,
      agent,
    })
    
    expect(summary).toBeTruthy()
    expect(summary.length).toBeGreaterThan(50)
    expect(typeof summary).toBe('string')
  })
})
