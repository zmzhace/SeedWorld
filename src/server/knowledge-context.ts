import 'server-only'

import type { MemoryRecord, WorldSlice } from '@/domain/world'
import { getDatabase } from './database'

export function hydrateVisibleKnowledge(worldId: string, input: WorldSlice): WorldSlice {
  const world = structuredClone(input)
  const facts = getDatabase().prepare(`SELECT f.id,f.subject_id,f.object_id,f.predicate,f.value_json,f.claim_scope,f.believer_id,
    s.name AS subject_name,o.name AS object_name
    FROM graph_facts f LEFT JOIN graph_entities s ON s.id=f.subject_id LEFT JOIN graph_entities o ON o.id=f.object_id
    WHERE f.world_id=? AND f.valid_until IS NULL ORDER BY f.created_at DESC LIMIT 500`).all(worldId) as Array<Record<string, unknown>>
  const explicit = getDatabase().prepare('SELECT target_id,effect,subject_kind,subject_id,condition_json,priority FROM visibility_rules WHERE world_id=? ORDER BY priority DESC').all(worldId) as Array<Record<string, unknown>>
  for (const agent of world.agents.npcs) {
    const visible = facts.filter(fact => {
      const rule = explicit.find(item => item.target_id === fact.id && (item.subject_kind === 'everyone' || item.subject_id === agent.genetics.seed))
      if (rule) return rule.effect === 'allow'
      if (fact.claim_scope === 'public_narrative') return true
      if (fact.claim_scope === 'character_belief') return fact.believer_id === agent.genetics.seed
      return fact.subject_id === agent.genetics.seed || fact.object_id === agent.genetics.seed
    }).slice(0, 30)
    const graphMemories: MemoryRecord[] = visible.map(fact => ({ id: `graph-${fact.id}`, content: `${fact.subject_name || fact.subject_id} ${fact.predicate} ${fact.object_name || parseValue(fact.value_json)}`, importance: 0.8, emotional_weight: 0, source: fact.claim_scope === 'public_narrative' ? 'social' : 'world', timestamp: new Date().toISOString(), decay_rate: 0, retrieval_strength: 1 }))
    const retained = agent.memory_long.filter(memory => !memory.id.startsWith('graph-'))
    agent.memory_long = [...retained, ...graphMemories]
  }
  return world
}

function parseValue(value: unknown) {
  if (typeof value !== 'string') return ''
  try { const parsed = JSON.parse(value); return typeof parsed === 'string' ? parsed : JSON.stringify(parsed) } catch { return value }
}
