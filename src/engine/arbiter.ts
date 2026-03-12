import { createPatch, type AgentPatch, type AgentEvent } from '../domain/agents'

type AgentResult = { agentId: string; patch?: AgentPatch; error?: string }

export const arbitratePatches = (results: AgentResult[]) => {
  const merged = createPatch({})

  const eventsById = new Map<string, AgentEvent>()

  for (const result of results) {
    if (!result.patch) continue

    merged.timeDelta = Math.max(merged.timeDelta, result.patch.timeDelta ?? 0)

    for (const event of result.patch.events ?? []) {
      const existing = eventsById.get(event.id)
      if (existing) {
        eventsById.set(event.id, { ...existing, conflict: true })
      } else {
        eventsById.set(event.id, event)
      }
    }

    merged.rulesDelta.push(...(result.patch.rulesDelta ?? []))
    merged.notes.push(...(result.patch.notes ?? []))
  }

  merged.events = Array.from(eventsById.values())

  return merged
}
