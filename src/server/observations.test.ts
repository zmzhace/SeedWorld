import { describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/observations/route'
import { createInitialWorldSlice } from '@/domain/world'
import { createPersonalAgent } from '@/domain/agents'

vi.mock('@/server/llm/observation-generator', () => ({
  generateObservationSummary: vi.fn(async () => 'summary text'),
}))

it('returns observation summary', async () => {
  const world = createInitialWorldSlice()
  const agent = createPersonalAgent('test-agent')
  
  const req = new Request('http://localhost/api/observations', {
    method: 'POST',
    body: JSON.stringify({ world, agent }),
  })
  const res = await POST(req)
  const json = await res.json()
  expect(json.summary).toBe('summary text')
})
