import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { getWorld } from '@/server/novel-repository'

export const runtime = 'nodejs'

const parse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Entity wiki page: the entity itself, outgoing facts (with object names),
 * incoming facts / backlinks (with subject names), and provenance.
 * Facts whose other endpoint has no entity row are flagged `orphan: true`
 * instead of being silently dropped.
 */
export async function GET(_: Request, { params }: { params: { id: string; entityId: string } }) {
  const world = getWorld(params.id)
  if (!world) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
  const db = getDatabase()
  const row = db.prepare('SELECT *, CASE WHEN origin=\'simulation\' THEN \'evolution\' ELSE \'source\' END AS graph_layer FROM entities WHERE id=? AND world_id=?').get(params.entityId, params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return NextResponse.json({ error: '实体不存在' }, { status: 404 })

  const nameOf = (id: unknown): string | null => {
    if (typeof id !== 'string' || !id) return null
    const found = db.prepare('SELECT name FROM entities WHERE id=?').get(id) as { name: string } | undefined
    return found ? found.name : null
  }
  const shapeFact = (fact: Record<string, unknown>, otherId: unknown) => {
    const otherName = nameOf(otherId)
    return {
      id: String(fact.id),
      predicate: String(fact.predicate),
      scope: String(fact.claim_scope),
      confidence: Number(fact.confidence ?? 1),
      value: parse(fact.value_json, null),
      believer_id: fact.believer_id ? String(fact.believer_id) : null,
      otherId: typeof otherId === 'string' ? otherId : null,
      otherName,
      orphan: typeof otherId === 'string' && Boolean(otherId) && !otherName,
      excerpt: parse<{ excerpt?: string }>(fact.provenance_json, {}).excerpt,
      createdAt: String(fact.created_at),
    }
  }

  const outgoing = (
    db
      .prepare(`SELECT *, CASE WHEN origin='simulation' THEN 'evolution' ELSE 'source' END AS graph_layer FROM claims WHERE world_id=? AND subject_id=? ORDER BY created_at DESC LIMIT 200`)
      .all(params.id, params.entityId) as Record<string, unknown>[]
  ).map((fact) => shapeFact(fact, fact.object_id))
  const incoming = (
    db
      .prepare(`SELECT *, CASE WHEN origin='simulation' THEN 'evolution' ELSE 'source' END AS graph_layer FROM claims WHERE world_id=? AND object_id=? ORDER BY created_at DESC LIMIT 200`)
      .all(params.id, params.entityId) as Record<string, unknown>[]
  ).map((fact) => shapeFact(fact, fact.subject_id))

  return NextResponse.json({
    entity: {
      ...row,
      aliases: parse(row.aliases_json, []),
      properties: parse(row.properties_json, {}),
      provenance: parse(row.provenance_json, {}),
    },
    outgoing,
    incoming,
    orphanOutgoing: outgoing.filter((f) => f.orphan).length,
    orphanIncoming: incoming.filter((f) => f.orphan).length,
  })
}
