import 'server-only'

import { getDatabase } from './database'
import { chatJson } from './llm/openai-compat'
import { COMPASS_RULES } from './llm/rules'
import { getWorld } from './novel-repository'

/**
 * Story compass, split into far horizon (long) and working plan (current).
 * Idea ported from ainovel-cli #91 `feat-compass`: chapters read `current`
 * only; `long` is stable across chapters and refreshed at volume boundaries.
 * v1: generated once from the world prompt + visible facts, then reused.
 */

export type Compass = {
  worldId: string
  long: { direction: string; threads: string[] }
  current: { arcGoal: string; beats: string[] }
  updatedAt: string
}

function rowToCompass(worldId: string, row: { long_json: string; current_json: string; updated_at: string }): Compass {
  return {
    worldId,
    long: JSON.parse(row.long_json),
    current: JSON.parse(row.current_json),
    updatedAt: row.updated_at,
  }
}

export function getCompass(worldId: string): Compass | null {
  const row = getDatabase().prepare('SELECT long_json,current_json,updated_at FROM compass WHERE world_id=?').get(worldId) as
    | { long_json: string; current_json: string; updated_at: string }
    | undefined
  if (!row) return null
  try {
    return rowToCompass(worldId, row)
  } catch {
    return null
  }
}

export async function ensureCompass(worldId: string, material: string): Promise<Compass> {
  const existing = getCompass(worldId)
  if (existing) return existing
  const world = getWorld(worldId)
  const raw = await chatJson(
    [
      {
        role: 'user',
        content: `You are a story planner. Read the work premise and visible facts, then set the story compass.\n\n${COMPASS_RULES}\n\nReturn JSON only: {"long":{"direction":"...","threads":["..."]},"current":{"arcGoal":"...","beats":["..."]}}\n\nPREMISE:\n${world?.prompt || ''}\n\nVISIBLE FACTS (sample):\n${material.slice(0, 8000)}`,
      },
    ],
    { temperature: 0.4, maxTokens: 2048, maxAttempts: 2 },
  )
  const compass: Compass = {
    worldId,
    long: {
      direction: typeof (raw.long as any)?.direction === 'string' ? (raw.long as any).direction : '',
      threads: Array.isArray((raw.long as any)?.threads) ? (raw.long as any).threads.map(String).slice(0, 8) : [],
    },
    current: {
      arcGoal: typeof (raw.current as any)?.arcGoal === 'string' ? (raw.current as any).arcGoal : '',
      beats: Array.isArray((raw.current as any)?.beats) ? (raw.current as any).beats.map(String).slice(0, 6) : [],
    },
    updatedAt: new Date().toISOString(),
  }
  getDatabase()
    .prepare(`INSERT INTO compass (world_id,long_json,current_json,updated_at) VALUES (?,?,?,?) ON CONFLICT(world_id) DO UPDATE SET long_json=excluded.long_json,current_json=excluded.current_json,updated_at=excluded.updated_at`)
    .run(worldId, JSON.stringify(compass.long), JSON.stringify(compass.current), compass.updatedAt)
  return compass
}
