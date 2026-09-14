import 'server-only'

import { chatJson } from './llm/openai-compat'
import { listScenes, listStoryThreads, saveScene, saveStoryThread } from './novel-repository'
import { getDatabase } from './database'
import type { WorldSlice } from '@/domain/world'

type Candidate = { objective?: unknown; conflict?: unknown; locationEntityId?: unknown; entryCause?: unknown; exitCondition?: unknown; anchorEventIds?: unknown[] }

export async function generateSceneCandidates(worldId: string, world: WorldSlice): Promise<void> {
  const active = listScenes(worldId, { status: 'active', limit: 1 })[0]
  const threads = listStoryThreads(worldId, { status: 'active', limit: 8 })
  const anchors = world.events.slice(-8).map((event) => ({ id: event.id, summary: event.payload?.summary || event.payload?.description || event.type }))
  let candidates: Candidate[] = []
  try {
    const prompt = [
      '你是动态小说的场景导演。提出最多三个下一场景候选，不写正文，不强行推进固定大纲。',
      '每个候选必须引用已有事件 ID 作为因果锚点，不得凭空创造人物或设定。',
      '返回 JSON：{"candidates":[{"objective":"...","conflict":"...","locationEntityId":"可选实体ID","entryCause":"...","exitCondition":"...","anchorEventIds":["事件ID"]}]}',
      `当前时间：${world.time}`,
      `当前环境：${world.environment.description}`,
      `当前场景：${active ? JSON.stringify(active) : '无'}`,
      `活跃故事线：${JSON.stringify(threads)}`,
      `最近事件：${JSON.stringify(anchors)}`,
    ].join('\n')
    const result = await chatJson([{ role: 'user', content: prompt }], { maxTokens: 2048, maxAttempts: 2 })
    candidates = Array.isArray(result.candidates) ? result.candidates as Candidate[] : []
  } catch {
    candidates = []
  }
  if (!candidates.length) {
    const fallback = anchors[anchors.length - 1]
    candidates = [{ objective: '追查当前事件留下的后果', conflict: world.social_context.pressures.slice(-1)[0] || '行动者之间的判断出现分歧', entryCause: fallback ? `承接事件：${fallback.summary}` : '承接当前世界状态', exitCondition: '形成新的不可逆事件', anchorEventIds: fallback ? [fallback.id] : [] }]
  }
  const existing = listScenes(worldId, { status: 'proposed', limit: 100 })
  for (const candidate of candidates.slice(0, 3)) {
    const objective = String(candidate.objective || '').trim()
    const conflict = String(candidate.conflict || '').trim()
    const anchorEventIds = Array.isArray(candidate.anchorEventIds) ? candidate.anchorEventIds.map(String).filter(Boolean) : []
    if (!objective || !conflict || !anchorEventIds.length) continue
    if (existing.some((scene) => scene.objective === objective && scene.anchorEventIds.some((id) => anchorEventIds.includes(id)))) continue
    saveScene({ worldId, tick: world.tick, status: 'proposed', timeLabel: world.time, locationEntityId: candidate.locationEntityId ? String(candidate.locationEntityId) : undefined, objective, conflict, entryCause: candidate.entryCause ? String(candidate.entryCause) : undefined, exitCondition: candidate.exitCondition ? String(candidate.exitCondition) : undefined, anchorEventIds })
  }
}

export async function advanceBackgroundThreads(worldId: string, world: WorldSlice): Promise<void> {
  if (world.tick <= 0 || world.tick % 3 !== 0) return
  const threads = listStoryThreads(worldId, { status: 'active', limit: 3 })
  if (!threads.length) return
  try {
    const result = await chatJson([{ role: 'user', content: `作为背景故事线编排器，只推进以下故事线的结构化状态，不进入主场景，不新增人物。每条最多一句摘要，并返回 JSON：{"updates":[{"threadId":"...","summary":"...","pressure":0.0,"status":"active|escalating|resolved|failed"}]}\n当前 Tick：${world.tick}\n最近事件：${JSON.stringify(world.events.slice(-5))}\n故事线：${JSON.stringify(threads)}` }], { maxTokens: 1200, maxAttempts: 2 })
    const updates = Array.isArray(result.updates) ? result.updates as Array<Record<string, unknown>> : []
    const db = getDatabase(); const now = new Date().toISOString()
    for (const update of updates.slice(0, 3)) {
      const current = threads.find((thread) => thread.id === String(update.threadId || ''))
      if (!current) continue
      const pressure = update.pressure == null ? current.pressure : Math.max(0, Math.min(1, Number(update.pressure)))
      const status = ['active', 'escalating', 'resolved', 'failed'].includes(String(update.status)) ? String(update.status) as any : current.status
      saveStoryThread({ ...current, status, pressure, lastAdvancedTick: world.tick })
      const summary = String(update.summary || '').trim()
      if (summary) db.prepare(`INSERT OR IGNORE INTO events (id,world_id,tick,type,summary,payload_json,actor_ids_json,origin,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(`bg_${worldId.slice(0, 8)}_${current.id.slice(0, 8)}_${world.tick}`, worldId, world.tick, 'background_thread_update', summary, JSON.stringify({ threadId: current.id, summary }), '[]', 'simulation', now)
    }
  } catch {
    // Background work is advisory; a failed projection must not roll back the tick.
  }
}
