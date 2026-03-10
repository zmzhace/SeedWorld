import { createInitialWorldSlice } from '@/domain/world'
import { runWorldTick } from '@/engine/orchestrator'
import { loadWorldSlice, saveWorldSlice } from './persistence'

type ChatTurnInput = {
  message: string
}

type ChatTurnResult = {
  reply: string
  worldSummary: string
  world: ReturnType<typeof createInitialWorldSlice>
}

export async function handleChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const existing = await loadWorldSlice()
  const world = existing ?? createInitialWorldSlice()

  const next = await runWorldTick({
    ...world,
    events: [
      ...world.events,
      {
        id: `user-${world.tick + 1}`,
        type: 'user_message',
        timestamp: new Date().toISOString(),
        payload: { message: input.message },
      },
    ],
  })

  await saveWorldSlice(next)

  return {
    reply: `收到：${input.message}`,
    worldSummary: `tick ${next.tick} • events ${next.events.length}`,
    world: next,
  }
}
