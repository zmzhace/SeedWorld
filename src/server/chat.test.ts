import { describe, it, expect } from 'vitest'
import { handleChatTurn } from './chat'
import { registerDirectorAgent } from './director-registry'
import { createInitialWorldSlice } from '@/domain/world'

it('returns a reply and updates the world summary after a user message', async () => {
  const world = createInitialWorldSlice()
  const result = await handleChatTurn({ message: '我今天有点累。', world })

  expect(result.reply.length).toBeGreaterThan(0)
  expect(result.worldSummary.length).toBeGreaterThan(0)
  expect(result.world.tick).toBeGreaterThan(0)
})

it('uses the shared director registry when running ticks', async () => {
  registerDirectorAgent({
    id: 'hot-2',
    role: 'macro',
    run: () => ({ events: [{ id: 'e2', kind: 'macro', summary: 'news' }] }),
  })

  const world = createInitialWorldSlice()
  const result = await handleChatTurn({ message: 'hi', world })

  expect(result.world.events.find((e) => e.id === 'e2')).toBeDefined()
})
