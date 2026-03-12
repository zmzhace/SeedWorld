import { describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/agents/route'

vi.mock('@/server/llm/agent-generator', () => ({
  generatePersonalAgents: vi.fn(async () => [
    {
      kind: 'personal',
      genetics: { seed: 'agent-1' },
      identity: { name: 'agent-1' },
      memory_short: [],
      memory_long: [],
      vitals: { energy: 0.7, stress: 0.2, sleep_debt: 0.1, focus: 0.6, aging_index: 0.1 },
      emotion: { label: 'neutral', intensity: 0.2 },
      persona: { openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 },
      goals: [],
      relations: {},
      action_history: [],
    },
    {
      kind: 'personal',
      genetics: { seed: 'agent-2' },
      identity: { name: 'agent-2' },
      memory_short: [],
      memory_long: [],
      vitals: { energy: 0.7, stress: 0.2, sleep_debt: 0.1, focus: 0.6, aging_index: 0.1 },
      emotion: { label: 'neutral', intensity: 0.2 },
      persona: { openness: 0.5, stability: 0.5, attachment: 0.5, agency: 0.5, empathy: 0.5 },
      goals: [],
      relations: {},
      action_history: [],
    },
  ]),
}))

it('returns generated agents from prompt', async () => {
  const req = new Request('http://localhost/api/agents', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'create 2 agents' }),
  })
  const res = await POST(req)
  const json = await res.json()
  expect(json.agents.length).toBe(2)
})
