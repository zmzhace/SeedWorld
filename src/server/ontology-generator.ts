import 'server-only'

import { randomUUID } from 'node:crypto'
import type { WorldOntology } from '@/domain/novel-graph'
import { chatJson } from '@/server/llm/openai-compat'
import { ONTOLOGY_RULES } from '@/server/llm/rules'
import { splitText } from '@/server/source-ingestion'

/**
 * Ontology generation.
 *
 * Prompt stays fiction-oriented (SeedWorld principle: ontologies are
 * work-specific and dynamic, no genre constants). All engineering around it
 * is ported from MiroFish `backend/app/services/ontology_generator.py` +
 * `backend/app/utils/ontology.py`:
 * - representative chunk sampling for long texts (head/middle/tail coverage
 *   instead of truncating to the first 50k chars)
 * - name normalization (PascalCase entities / UPPER_SNAKE relations /
 *   snake_case fields), reserved-name guard, dedupe
 * - guaranteed fallback attributes so Zep never receives an empty field map
 * - 10/10 type caps, edge endpoints resolved AFTER capping so no edge can
 *   reference a removed type
 * - actionable safety net: the simulation agent-sync only picks up
 *   `actionable` types, so if the model marks none, person-like types are
 *   promoted instead of leaving the world without agents
 */

const MAX_ONTOLOGY_TYPES = 10
const MAX_ONTOLOGY_ATTRIBUTES = 10
const MAX_ONTOLOGY_SOURCE_TARGETS = 10
const RESERVED_ATTRIBUTE_NAMES = new Set([
  'uuid',
  'name',
  'group_id',
  'graph_id',
  'name_embedding',
  'summary',
  'created_at',
])
const FALLBACK_ATTRIBUTE = {
  name: 'details',
  type: 'text' as const,
  description: 'Additional details about this ontology type.',
}

// Fiction fallback types: concrete enough to seed agents, generic enough to
// fit any genre. Only appended when the model omits an equivalent.
const PERSON_FALLBACK = {
  name: 'Person',
  displayName: '人物',
  description: 'Any individual person with agency in this work.',
  fields: [
    { name: 'full_name', type: 'text' as const, description: 'Full name of the person' },
    { name: 'role', type: 'text' as const, description: 'Role or occupation' },
  ],
  actionable: true,
}
const ORG_FALLBACK = {
  name: 'Organization',
  displayName: '组织',
  description: 'Any organized group, faction, or institution in this work.',
  fields: [
    { name: 'org_name', type: 'text' as const, description: 'Name of the organization' },
    { name: 'org_type', type: 'text' as const, description: 'Kind of organization' },
  ],
  actionable: false,
}

const pascal = (value: string) => {
  const words = value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  const result = words.map((part) => part[0].toUpperCase() + part.slice(1)).join('')
  return result || 'Entity'
}
const relationName = (value: string) => {
  let normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  if (!normalized) return 'RELATES_TO'
  if (/^[0-9]/.test(normalized)) normalized = `REL_${normalized}`
  return normalized
}
const fieldName = (value: string) => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  if (!normalized || RESERVED_ATTRIBUTE_NAMES.has(normalized)) return `entity_${normalized || 'field'}`
  return normalized
}

type RawField = { name?: unknown; type?: unknown; description?: unknown }

function normalizeFields(raw: unknown): WorldOntology['entityTypes'][number]['fields'] {
  const list = Array.isArray(raw) ? raw : []
  const fields: WorldOntology['entityTypes'][number]['fields'] = []
  for (const item of list) {
    if (typeof item === 'string') {
      if (!item.trim()) continue
      fields.push({ name: fieldName(item), type: 'text', description: item.trim() })
    } else if (item && typeof item === 'object') {
      const field = item as RawField
      if (typeof field.name !== 'string' || !field.name.trim()) continue
      const type =
        field.type === 'integer' || field.type === 'float' || field.type === 'boolean'
          ? field.type
          : 'text'
      fields.push({
        name: fieldName(field.name),
        type,
        description:
          typeof field.description === 'string' && field.description ? field.description : field.name,
      })
    }
    if (fields.length === MAX_ONTOLOGY_ATTRIBUTES) break
  }
  if (!fields.length) fields.push({ ...FALLBACK_ATTRIBUTE })
  return fields
}

function normalizeSourceTargets(raw: unknown): Array<{ source: string; target: string }> {
  if (!Array.isArray(raw)) return []
  const pairs: Array<{ source: string; target: string }> = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { source, target } = item as { source?: unknown; target?: unknown }
    if (typeof source !== 'string' || !source.trim()) continue
    if (typeof target !== 'string' || !target.trim()) continue
    const key = `${source.trim()}→${target.trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ source: source.trim(), target: target.trim() })
    if (pairs.length === MAX_ONTOLOGY_SOURCE_TARGETS) break
  }
  return pairs
}

// Representative sampling ported from MiroFish `_build_document_context`:
// equidistant chunk selection so head/middle/tail are all covered, each
// excerpt keeping its head+tail instead of only its beginning.
const MAX_TEXT_FOR_LLM = 50_000
const SAMPLE_CHUNK_SIZE = 8000
const SAMPLE_CHUNK_OVERLAP = 200
const MAX_SAMPLE_CHUNKS = 60
const MIN_EXCERPT = 400

function excerptText(text: string, charLimit: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= charLimit) return trimmed
  const marker = '\n...(本分块中间内容省略)...\n'
  if (charLimit <= marker.length + 20) return trimmed.slice(0, charLimit)
  const remaining = charLimit - marker.length
  const headLen = Math.floor(remaining / 2)
  return `${trimmed.slice(0, headLen).trimEnd()}${marker}${trimmed.slice(trimmed.length - (remaining - headLen)).trimStart()}`
}

function buildDocumentContext(texts: string[]): string {
  const combined = texts.join('\n\n---\n\n')
  if (combined.length <= MAX_TEXT_FOR_LLM) return combined
  const chunks: Array<{ doc: number; index: number; total: number; text: string }> = []
  texts.forEach((text, docIndex) => {
    const parts = splitText(text, SAMPLE_CHUNK_SIZE, SAMPLE_CHUNK_OVERLAP)
    parts.forEach((part, partIndex) => {
      chunks.push({ doc: docIndex + 1, index: partIndex + 1, total: parts.length, text: part })
    })
  })
  if (!chunks.length) return ''
  let selected = chunks
  if (chunks.length > MAX_SAMPLE_CHUNKS) {
    const indexes = new Set<number>()
    for (let i = 0; i < MAX_SAMPLE_CHUNKS; i++) {
      indexes.add(Math.round((i * (chunks.length - 1)) / (MAX_SAMPLE_CHUNKS - 1)))
    }
    selected = [...indexes].sort((a, b) => a - b).map((i) => chunks[i])
  }
  let budget = Math.max(MIN_EXCERPT, Math.floor((MAX_TEXT_FOR_LLM - 600 - 120 * selected.length) / Math.max(selected.length, 1)))
  const render = (limit: number) => {
    const lines = [
      `【长文本自动分块摘要】原文共${combined.length}字，已分为${chunks.length}个文本块用于全局覆盖分析。`,
      `以下展示其中${selected.length}个代表性文本块的摘录，覆盖开头、中段和结尾；请基于这些跨全文线索设计本体，不要只依赖第一段内容。`,
    ]
    for (const chunk of selected) {
      lines.push(`--- 文档 ${chunk.doc} / 分块 ${chunk.index}/${chunk.total} ---\n${excerptText(chunk.text, limit)}`)
    }
    return lines.join('\n\n')
  }
  let context = render(budget)
  while (context.length > MAX_TEXT_FOR_LLM && budget > MIN_EXCERPT) {
    budget = Math.max(MIN_EXCERPT, Math.floor(budget * 0.85))
    context = render(budget)
  }
  if (context.length > MAX_TEXT_FOR_LLM) {
    const marker = '\n\n...(分块上下文已压缩到本体分析长度限制内)...'
    context = context.slice(0, MAX_TEXT_FOR_LLM - marker.length) + marker
  }
  return context
}

export async function generateOntology(
  worldId: string,
  texts: string[],
  version: number,
): Promise<WorldOntology> {
  const maxTypes = Number(process.env.SEEDWORLD_ONTOLOGY_MAX_TYPES || MAX_ONTOLOGY_TYPES)
  const excerpt = buildDocumentContext(texts)
  const prompt = `You design a knowledge-graph ontology for a fiction simulation platform.
${ONTOLOGY_RULES}
Return JSON ONLY, no other text, following this exact schema:
\`\`\`json
{
  "entityTypes": [
    {"name": "Student", "displayName": "学生", "description": "A student character.", "fields": [{"name": "full_name", "type": "text", "description": "Full name"}], "actionable": true}
  ],
  "relationTypes": [
    {"name": "STUDIES_AT", "displayName": "就读于", "description": "Enrollment relation.", "sourceTargets": [{"source": "Student", "target": "University"}], "fields": []}
  ],
  "rationale": "Why these types fit this work."
}
\`\`\`

Naming rules (strict — types with bad names are discarded):
- "name" MUST be English: PascalCase for entities (e.g. Student, MountainClan), UPPER_SNAKE_CASE for relations (e.g. STUDIES_AT), snake_case for fields. NEVER Chinese or mixed-language identifiers.
- "displayName" uses the source language (Chinese display names when the source is Chinese).
- Field "type" is one of: text, integer, float, boolean.

Content rules:
- At most ${maxTypes} entity types and ${maxTypes} relation types. Mark types that possess agency as actionable.

SOURCE MATERIAL:
${excerpt}`
  // Explicit output cap: gateways like OpenRouter pre-check credit coverage
  // against max_tokens, so an uncapped request can 402. The client doubles
  // the cap once if the output is truncated.
  const raw = await chatJson(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3, maxTokens: 8192, maxAttempts: 2 },
  )

  const rawEntities = Array.isArray(raw.entityTypes) ? raw.entityTypes : []
  const rawRelations = Array.isArray(raw.relationTypes) ? raw.relationTypes : []

  // Entities first (with fiction fallbacks), capped before edges resolve.
  const entityTypes: WorldOntology['entityTypes'] = []
  const seenEntityNames = new Set<string>()
  const entityNameMap = new Map<string, string>()
  for (const item of rawEntities) {
    const entry = typeof item === 'string' ? { name: item } : item
    if (!entry || typeof entry !== 'object') continue
    const original = (entry as { name?: unknown }).name
    if (typeof original !== 'string' || !original.trim()) continue
    const name = pascal(original.trim())
    if (name === 'Entity' && original.trim() !== 'Entity') continue
    if (seenEntityNames.has(name)) {
      entityNameMap.set(original.trim(), name)
      entityNameMap.set(original.trim().toLowerCase(), name)
      continue
    }
    const record = entry as Record<string, unknown>
    const description =
      typeof record.description === 'string' && record.description
        ? record.description.slice(0, 100)
        : `A ${name} entity.`
    entityTypes.push({
      name,
      displayName: typeof record.displayName === 'string' && record.displayName ? record.displayName : name,
      description,
      fields: normalizeFields(record.fields),
      actionable: record.actionable === true,
    })
    seenEntityNames.add(name)
    entityNameMap.set(original.trim(), name)
    entityNameMap.set(original.trim().toLowerCase(), name)
    entityNameMap.set(name, name)
    entityNameMap.set(name.toLowerCase(), name)
  }

  const names = new Set(entityTypes.map((type) => type.name))
  const fallbacks = []
  if (!names.has(PERSON_FALLBACK.name)) fallbacks.push(PERSON_FALLBACK)
  if (!names.has(ORG_FALLBACK.name)) fallbacks.push(ORG_FALLBACK)
  if (fallbacks.length) {
    const overflow = entityTypes.length + fallbacks.length - maxTypes
    if (overflow > 0) entityTypes.splice(entityTypes.length - overflow, overflow)
    entityTypes.push(...fallbacks)
  }
  const cappedEntities = entityTypes.slice(0, maxTypes)
  const validNames = new Set(cappedEntities.map((type) => type.name))
  for (const name of validNames) {
    entityNameMap.set(name, name)
    entityNameMap.set(name.toLowerCase(), name)
  }
  const resolveEntityName = (value: string): string | null => {
    const stripped = value.trim()
    if (stripped === 'Entity') return stripped
    const mapped = entityNameMap.get(stripped) ?? entityNameMap.get(stripped.toLowerCase())
    if (mapped && validNames.has(mapped)) return mapped
    const candidate = pascal(stripped)
    return validNames.has(candidate) ? candidate : null
  };

  // Edges resolve only against surviving entity names.
  const relationTypes: WorldOntology['relationTypes'] = []
  const seenEdgeNames = new Set<string>()
  for (const item of rawRelations) {
    if (typeof item === 'string' || !item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.name !== 'string' || !record.name.trim()) continue
    const name = relationName(record.name)
    if (name === 'RELATES_TO' && record.name.trim() !== 'RELATES_TO') continue
    if (seenEdgeNames.has(name)) continue
    const targets = normalizeSourceTargets(record.sourceTargets)
      .map((pair) => {
        const source = resolveEntityName(pair.source)
        const target = resolveEntityName(pair.target)
        return source && target ? { source, target } : null
      })
      .filter((pair): pair is { source: string; target: string } => pair !== null)
    const description =
      typeof record.description === 'string' && record.description
        ? record.description.slice(0, 100)
        : `A ${name} relationship.`
    seenEdgeNames.add(name)
    relationTypes.push({
      name,
      displayName: typeof record.displayName === 'string' && record.displayName ? record.displayName : name,
      description,
      sourceTargets: targets,
      fields: normalizeFields(record.fields),
    })
    if (relationTypes.length === maxTypes) break
  }

  // Actionable safety net: agent-sync only picks up actionable types.
  if (!cappedEntities.some((type) => type.actionable)) {
    const personLike = /(person|people|character|actor|figure|protagonist|人物|角色|主角|居民|成员)/i
    for (const type of cappedEntities) {
      if (personLike.test(type.name) || personLike.test(type.displayName)) type.actionable = true
    }
  }

  return {
    id: randomUUID(),
    worldId,
    version,
    entityTypes: cappedEntities,
    relationTypes,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
    createdAt: new Date().toISOString(),
  }
}
