import 'server-only'

import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import type { WorldSlice } from '@/domain/world'
import { listScenes, listStoryThreads, saveScene, saveStoryThread, upsertActorRuntime } from './novel-repository'
import { getDatabase } from './database'

/** Ensure every world has a resumable main scene before its first tick. */
export function ensurePrimaryScene(worldId: string, world: WorldSlice) {
  const active = listScenes(worldId, { status: 'active', limit: 1 })[0]
  if (active) return active
  const latest = listScenes(worldId, { limit: 1 })[0]
  return saveScene({
    worldId,
    tick: world.tick,
    status: 'active',
    timeLabel: world.time,
    objective: world.summary || '让世界在当前压力下继续变化',
    conflict: world.social_context.pressures.slice(-1)[0] || '尚未形成明确冲突',
    entryCause: latest ? `承接场景 ${latest.id}` : '世界初始化',
    exitCondition: '当前冲突产生不可逆后果或新的因果锚点',
    anchorEventIds: world.events.slice(-3).map((event) => event.id),
  })
}

/** Mirror the in-memory actor pool into lifecycle records without inventing agents. */
export function syncActorRuntime(worldId: string, world: WorldSlice, sceneId?: string) {
  const existingThreads = listStoryThreads(worldId, { limit: 100 })
  // An active line without a published causal anchor is not a story line yet;
  // keeping it active would make the mainline gate reject the very first tick.
  for (const thread of existingThreads) if (['active', 'escalating'].includes(thread.status) && !thread.anchorEventIds.length) {
    saveStoryThread({ ...thread, status: 'dormant' })
  }
  if (!existingThreads.length && world.active_hooks.length) {
    const anchors = world.events.slice(-3).map((event) => event.id)
    saveStoryThread({ id: randomUUID(), worldId, title: '未解决的世界压力', kind: 'hook', status: anchors.length ? 'active' : 'dormant', goal: world.active_hooks[0], pressure: 0.5, ownerEntityIds: [], anchorEventIds: anchors })
  }
  for (const actor of world.agents.npcs) {
    const db = getDatabase()
    db.prepare(`INSERT OR IGNORE INTO entities (id,world_id,type,name,aliases_json,properties_json,status,actionable,provenance_json,origin,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(actor.genetics.seed, worldId, 'Actor', actor.identity.name, '[]', JSON.stringify({ occupation: actor.occupation, goals: actor.goals }), actor.life_status === 'dead' ? 'dead' : 'active', 1, JSON.stringify({ source: 'world_snapshot' }), 'simulation', new Date().toISOString(), new Date().toISOString())
    const hasRecentAction = Boolean(actor.last_action_description || actor.last_dialogue || actor.last_inner_monologue)
    const score = Math.min(1, (actor.goals.length ? 0.2 : 0) + (Object.keys(actor.relations || {}).length ? 0.15 : 0) + (hasRecentAction ? 0.35 : 0) + (actor.expertise?.length ? 0.1 : 0))
    const active = actor.life_status === 'dead' ? 'dead' : hasRecentAction && sceneId ? 'active' : score >= 0.6 ? 'candidate' : 'background'
    upsertActorRuntime({ actorId: actor.genetics.seed, worldId, lifecycle: active, agencyScore: score, locked: false, currentSceneId: active === 'active' ? sceneId : undefined, lastActiveTick: active === 'active' ? world.tick : undefined, promotionReason: active === 'active' ? '本轮在主场景中产生行动' : '根据目标、关系和近期行动自动评估' })
  }
}

export function syncStoryThreadsFromEvents(worldId: string, world: WorldSlice) {
  const existing = listStoryThreads(worldId, { limit: 100 })
  const recent = world.events.slice(-8).filter((event) => Boolean(event.payload?.summary || event.payload?.description))
  for (const event of recent) {
    const summary = String(event.payload?.summary || event.payload?.description)
    if (!summary || existing.some((thread) => thread.anchorEventIds.includes(event.id))) continue
    if (!event.payload?.conflict && !/冲突|袭击|失控|死亡|背叛|泄密|失败|危机/.test(summary)) continue
    const eventId = `evt_${createHash('sha256').update(`${worldId}:${event.id}`).digest('hex').slice(0, 24)}`
    saveStoryThread({ worldId, title: summary.slice(0, 80), kind: 'emergent_conflict', status: 'active', goal: `处理事件：${summary}`, pressure: 0.5, ownerEntityIds: [], anchorEventIds: [eventId], lastAdvancedTick: world.tick })
  }
}
