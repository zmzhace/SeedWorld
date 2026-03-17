import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'

vi.mock('./llm/anthropic', () => {
  const streamText = vi.fn()
  return {
    createAnthropicClient: vi.fn(() => ({ messages: { stream: vi.fn() } })),
    getModel: () => 'test-model',
    streamText,
    __streamTextMock: streamText,
  }
})

import { handleChatTurn } from './chat'
import { registerDirectorAgent } from './director-registry'
import { __streamTextMock as streamTextMock } from './llm/anthropic'

describe('handleChatTurn', () => {
  beforeEach(() => {
    streamTextMock.mockReset()
  })

  it('returns a reply and updates the world summary after a user message', async () => {
    streamTextMock
      .mockResolvedValueOnce('{"event_description":"A weary mood spreads through the camp.","affected_agents":[],"event_type":"social","intensity":0.4}')
      .mockResolvedValueOnce('{"events":[]}')
      .mockResolvedValueOnce('A hush passes through the camp as the mood settles over everyone.')

    const world = createInitialWorldSlice()
    const result = await handleChatTurn({ message: '我今天有点累。', world })

    expect(result.reply.length).toBeGreaterThan(0)
    expect(result.worldSummary.length).toBeGreaterThan(0)
    expect(result.world.tick).toBeGreaterThan(0)
  })

  it('uses the shared director registry when running ticks', async () => {
    streamTextMock
      .mockResolvedValueOnce('{"event_description":"News ripples outward.","affected_agents":[],"event_type":"social","intensity":0.5}')
      .mockResolvedValueOnce('{"events":[]}')
      .mockResolvedValueOnce('The news changes the mood of the settlement.')

    registerDirectorAgent({
      id: 'hot-2',
      role: 'macro',
      run: () => ({ events: [{ id: 'e2', kind: 'macro', summary: 'news' }] }),
    })

    const world = createInitialWorldSlice()
    const result = await handleChatTurn({ message: 'hi', world })

    expect(result.world.events.find((e) => e.id === 'e2')).toBeDefined()
  })

  it('falls back to a world summary reply when narrative generation fails', async () => {
    streamTextMock
      .mockResolvedValueOnce('{"event_description":"A rumor cuts across the district.","affected_agents":[],"event_type":"social","intensity":0.6}')
      .mockResolvedValueOnce('{"events":[]}')
      .mockRejectedValueOnce(new Error('llm reply failed'))

    const world = createInitialWorldSlice()

    await expect(handleChatTurn({ message: '传言扩散了', world })).resolves.toMatchObject({
      reply: expect.any(String),
      world: expect.objectContaining({ tick: expect.any(Number) }),
    })
  })
})
