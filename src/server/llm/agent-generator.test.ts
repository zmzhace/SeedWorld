import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePersonalAgents } from './agent-generator'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  seed: 'brave-explorer',
                  persona: { openness: 0.8, stability: 0.6, attachment: 0.5, agency: 0.7, empathy: 0.6 },
                  vitals: { energy: 0.8, stress: 0.2, sleep_debt: 0.1, focus: 0.7, aging_index: 0.1 },
                },
                {
                  seed: 'cautious-scholar',
                  persona: { openness: 0.6, stability: 0.8, attachment: 0.7, agency: 0.5, empathy: 0.7 },
                  vitals: { energy: 0.6, stress: 0.3, sleep_debt: 0.2, focus: 0.8, aging_index: 0.2 },
                },
                {
                  seed: 'wild-adventurer',
                  persona: { openness: 0.9, stability: 0.4, attachment: 0.3, agency: 0.9, empathy: 0.5 },
                  vitals: { energy: 0.9, stress: 0.4, sleep_debt: 0.0, focus: 0.6, aging_index: 0.05 },
                },
              ]),
            },
          ],
        }),
      }
    },
  }
})

describe('generatePersonalAgents', () => {
  it('generates multiple personal agents from natural language prompt', async () => {
    const agents = await generatePersonalAgents({
      prompt: '创建三个不同性格的探险者',
      count: 3,
    })
    
    expect(agents).toHaveLength(3)
    expect(agents[0].genetics.seed).toBeTruthy()
    expect(agents[0].kind).toBe('personal')
    expect(agents[0].persona).toBeDefined()
    expect(agents[0].vitals).toBeDefined()
  })
})
