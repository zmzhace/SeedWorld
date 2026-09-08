import 'server-only'

import { getDatabase } from './database'
import { getWorld, updateWorld } from './novel-repository'
import { ensureGraph, submitEpisodes, waitForEpisodes } from './zep-graph'

const running = new Set<string>()
// Evolution writes are small (a handful of tick payloads); a short bounded
// wait keeps the outbox flowing without hanging tick responses (flush runs
// fire-and-forget from the tick route). Anything unfinished stays retryable.
const OUTBOX_WAIT_MS = 10 * 60 * 1000

export async function flushOutbox(worldId: string) {
  if (running.has(worldId)) return
  running.add(worldId)
  try {
    const world = getWorld(worldId)
    if (!world) return
    const graphId = world.evolutionGraphId || `seedworld_${worldId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_evolution`
    await ensureGraph(graphId, `SeedWorld ${worldId} Evolution`)
    if (!world.evolutionGraphId) updateWorld(worldId, { evolutionGraphId: graphId })
    const rows = getDatabase()
      .prepare(
        `SELECT id,payload_json,attempts FROM outbox WHERE world_id=? AND status IN ('pending','retry') AND next_attempt_at<=? ORDER BY created_at LIMIT 20`,
      )
      .all(worldId, new Date().toISOString()) as Array<{ id: string; payload_json: string; attempts: number }>
    for (const row of rows) {
      try {
        const { episodeUuids } = await submitEpisodes(graphId, [
          { id: row.id, content: row.payload_json, sourceId: 'simulation', ordinal: row.attempts },
        ])
        await waitForEpisodes(episodeUuids, undefined, OUTBOX_WAIT_MS)
        getDatabase()
          .prepare(`UPDATE outbox SET status='completed',updated_at=? WHERE id=?`)
          .run(new Date().toISOString(), row.id)
      } catch (error) {
        const attempts = row.attempts + 1
        const delay = Math.min(3600, 2 ** attempts * 15)
        getDatabase()
          .prepare(`UPDATE outbox SET status='retry',attempts=?,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?`)
          .run(
            attempts,
            new Date(Date.now() + delay * 1000).toISOString(),
            error instanceof Error ? error.message : String(error),
            new Date().toISOString(),
            row.id,
          )
      }
    }
  } finally {
    running.delete(worldId)
  }
}
