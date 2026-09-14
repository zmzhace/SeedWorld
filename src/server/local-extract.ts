import 'server-only'

import type { ClaimScope, WorldOntology } from '@/domain/novel-graph'
import { chatJson } from './llm/openai-compat'

/**
 * Local extraction: ask the model (guided by the
 * work-specific ontology) to pull entities + facts out of each chunk and
 * persist them straight into SQLite. No extra key, no queue, no polling.
 */

export type ExtractedEntity = {
  name: string
  type: string
  aliases: string[]
  summary: string
  attributes: Record<string, unknown>
}

export type ExtractedFact = {
  subject: string
  predicate: string
  object?: string
  value?: unknown
  scope: ClaimScope
  believer?: string
  confidence: number
}

export type ChunkExtraction = { entities: ExtractedEntity[]; facts: ExtractedFact[] }

function ontologyBrief(ontology: WorldOntology): string {
  const entities = ontology.entityTypes
    .map((t) => `- ${t.name}(${t.displayName}): ${t.description}${t.actionable ? ' [actionable]' : ''}`)
    .join('\n')
  const relations = ontology.relationTypes
    .map((t) => {
      const pairs = t.sourceTargets.map((p) => `${p.source}→${p.target}`).join(', ')
      return `- ${t.name}(${t.displayName}): ${t.description}${pairs ? ` [${pairs}]` : ''}`
    })
    .join('\n')
  return `ENTITY TYPES (use "name" exactly):\n${entities}\n\nRELATION TYPES (use "name" exactly):\n${relations || '(none: use RELATES_TO)'}\n\n${ontology.rationale}`
}

export async function extractChunk(content: string, ontology: WorldOntology): Promise<ChunkExtraction> {
  const raw = await chatJson(
    [
      {
        role: 'user',
        content: `You extract a knowledge graph from fiction text. Use ONLY the entity/relation type names from the ontology below; if nothing fits, use entity type "Entity" and relation "RELATES_TO".
Classify every fact scope: "objective" (true in the world), "public_narrative" (what people openly say), or "character_belief" (one character's private belief, with "believer" = their name).
Extract concrete people, groups, places, objects, events and their relations. Skip generic filler.
Return JSON only: {"entities":[{"name":"...","type":"...","aliases":[],"summary":"...","attributes":{}}],"facts":[{"subject":"...","predicate":"...","object":"...","value":null,"scope":"objective","confidence":0.9}]}
"object" is another entity name when the fact links two entities, else omit it and put the detail in "value".
ONTOLOGY:
${ontologyBrief(ontology)}
TEXT:
${content}`,
      },
    ],
    { temperature: 0.2, maxTokens: 4096, maxAttempts: 2 },
  )

  const validTypes = new Set(ontology.entityTypes.map((t) => t.name))
  const entities: ExtractedEntity[] = []
  if (Array.isArray(raw.entities)) {
    for (const item of raw.entities) {
      if (!item || typeof item !== 'object') continue
      const e = item as Record<string, unknown>
      if (typeof e.name !== 'string' || !e.name.trim()) continue
      const rawType = typeof e.type === 'string' && e.type.trim() ? e.type.trim() : 'Entity'
      entities.push({
        name: e.name.trim(),
        type: rawType === 'Entity' || validTypes.has(rawType) ? rawType : 'Entity',
        aliases: Array.isArray(e.aliases) ? e.aliases.map(String).slice(0, 5) : [],
        summary: typeof e.summary === 'string' ? e.summary.slice(0, 500) : '',
        attributes:
          e.attributes && typeof e.attributes === 'object' && !Array.isArray(e.attributes)
            ? (e.attributes as Record<string, unknown>)
            : {},
      })
    }
  }
  const facts: ExtractedFact[] = []
  if (Array.isArray(raw.facts)) {
    for (const item of raw.facts) {
      if (!item || typeof item !== 'object') continue
      const f = item as Record<string, unknown>
      if (typeof f.subject !== 'string' || !f.subject.trim()) continue
      if (typeof f.predicate !== 'string' || !f.predicate.trim()) continue
      const scope =
        f.scope === 'public_narrative' || f.scope === 'character_belief' ? f.scope : ('objective' as ClaimScope)
      facts.push({
        subject: f.subject.trim(),
        predicate: f.predicate.trim(),
        object: typeof f.object === 'string' && f.object.trim() ? f.object.trim() : undefined,
        value: f.value === undefined ? undefined : f.value,
        scope,
        believer: typeof f.believer === 'string' && f.believer.trim() ? f.believer.trim() : undefined,
        confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.8,
      })
    }
  }
  return { entities, facts }
}
