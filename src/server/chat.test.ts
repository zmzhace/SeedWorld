import { describe, it, expect } from 'vitest'
import { handleChatTurn } from './chat'

it('returns a reply and updates the world summary after a user message', async () => {
  const result = await handleChatTurn({ message: '我今天有点累。' })

  expect(result.reply.length).toBeGreaterThan(0)
  expect(result.worldSummary.length).toBeGreaterThan(0)
  expect(result.world.tick).toBeGreaterThan(0)
})
