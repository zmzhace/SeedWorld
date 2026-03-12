import { createHookBus } from './hooks'
import { createNuwaService } from './nuwa-service'
import { applyMemoryDecay } from './memory'
import { updateVitalsAfterTick } from './vitals'
import { applyPersonaDrift } from './persona'
import { mapSearchResultsToSocialContext } from '@/server/search/mapper'
import type { AgentAction } from '@/domain/actions'
import type { WorldSlice } from '@/domain/world'
import type { SearchSignal } from '@/domain/search'

type OrchestratorOptions = {
  search?: () => Promise<SearchSignal[]>
  nuwa?: { trigger: 'event'; seed: string; environment: { region: string; social_state: string } }
}

export async function runWorldTick(world: WorldSlice, options: OrchestratorOptions = {}): Promise<WorldSlice> {
  const bus = createHookBus()
  await bus.emit('before_tick', { world })

  const nextTick = world.tick + 1
  const timestamp = new Date(Date.parse(world.time) + 1000).toISOString()

  const updatedMemoryShort = applyMemoryDecay(world.agents.personal.memory_short)
  const updatedMemoryLong = applyMemoryDecay(world.agents.personal.memory_long)
  const updatedVitals = updateVitalsAfterTick(world.agents.personal.vitals)
  const updatedPersona = applyPersonaDrift(world.agents.personal.persona, [])

  const searchResults = options.search ? await options.search() : []
  const mappedContext = searchResults.length
    ? mapSearchResultsToSocialContext(searchResults)
    : world.social_context

  const action: AgentAction = { type: 'reflect', intensity: 0.5 }

  await bus.emit('before_action', { action })
  await bus.emit('after_action', { action })

  const events = [...world.events]

  if (options.nuwa) {
    const nuwa = createNuwaService({
      emit: (event) => {
        events.push({ type: event.type, payload: event.payload })
      },
    })
    nuwa.createAgent(options.nuwa)
  }

  const event = {
    id: `event-${nextTick}`,
    type: 'tick',
    timestamp,
  }

  events.push(event)

  const next: WorldSlice = {
    ...world,
    tick: nextTick,
    time: timestamp,
    social_context: mappedContext,
    events,
    agents: {
      ...world.agents,
      personal: {
        ...world.agents.personal,
        memory_short: updatedMemoryShort,
        memory_long: updatedMemoryLong,
        vitals: updatedVitals,
        persona: updatedPersona,
        action_history: [...world.agents.personal.action_history, { type: action.type, timestamp }],
      },
    },
  }

  await bus.emit('after_tick', { world: next })

  return next
}
