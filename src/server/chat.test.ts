import { describe, it, expect } from 'vitest'
import { handleChatTurn } from './chat'
import { registerPanguAgent } from './pangu'

it('returns a reply and updates the world summary after a user message', async () => {
  const result = await handleChatTurn({ message: '我今天有点累。' })

  expect(result.reply.length).toBeGreaterThan(0)
  expect(result.worldSummary.length).toBeGreaterThan(0)
  expect(result.world.tick).toBeGreaterThan(0)
})

it('uses the shared pangu registry when running ticks', async () => {
  registerPanguAgent({
    id: 'hot-2',
    role: 'macro',
    run: () => ({ events: [{ id: 'e2', kind: 'macro', summary: 'news' }] }),
  })

  const result = await handleChatTurn({ message: 'hi' })

  expect(result.world.events.find((e) => e.id === 'e2')).toBeDefined()
})
