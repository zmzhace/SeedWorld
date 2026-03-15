import type { DirectorAgent } from '@/domain/agents'
import type { WorldSlice } from '@/domain/world'
import { generateStorylineEvent } from './llm/storyline-director'

/**
 * Story Director Agent
 * Observes world state and generates events to drive the narrative forward
 */
export const storylineDirector: DirectorAgent = {
  id: 'story-director',
  role: 'macro',
  run: async (world: unknown) => {
    const worldSlice = world as WorldSlice

    if (worldSlice.tick % 3 !== 0) {
      return {
        timeDelta: 0,
        events: [],
        rulesDelta: [],
        notes: ['Story director skipped this tick'],
        meta: {},
      }
    }

    console.log(`[StoryDirector] Running at tick ${worldSlice.tick}`)

    const patch = await generateStorylineEvent(worldSlice)

    console.log(`[StoryDirector] Generated event:`, patch.events?.[0]?.summary || 'none')

    return patch
  },
}
