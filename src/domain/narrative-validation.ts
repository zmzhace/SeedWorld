import type { EvolutionContract } from './narrative-workflow'
import type { WorldSlice } from './world'

const PLACEHOLDER = /观察周围|停在原地|陷入思考|暂时没有|没有贸然|静静等待|quietly observes|等待更多信息/

export function materializeContractEvent(previous: WorldSlice, next: WorldSlice, contract: EvolutionContract) {
  const before = new Map(previous.agents.npcs.map((actor) => [actor.genetics.seed, actor]))
  const actions = next.agents.npcs.flatMap((actor) => {
    if (!contract.participants.some((item) => item.actorId === actor.genetics.seed)) return []
    const prior = before.get(actor.genetics.seed)
    const action = String(actor.last_action_description || '').trim()
    const dialogue = String(actor.last_dialogue || '').trim()
    if (!action || action === prior?.last_action_description || PLACEHOLDER.test(action)) return []
    return [{ actorId: actor.genetics.seed, name: actor.identity.name, action, dialogue: dialogue && dialogue !== prior?.last_dialogue ? dialogue : undefined }]
  })
  if (actions.length < 2) return null
  return {
    id: `contract-${contract.id}`,
    type: 'narrative_event',
    timestamp: next.time,
    payload: {
      summary: `${contract.coreEvent}，互相改变了对方的处境。直接结果：${contract.requiredStateChanges.join('；')}。`,
      participants: actions.map((item) => item.actorId),
      actions,
      consequence: contract.requiredStateChanges,
      conflict: contract.coreEvent,
    },
  }
}

export function validateNarrativeEvents(previous: WorldSlice, next: WorldSlice, contract: EvolutionContract) {
  const existing = new Set(previous.events.map((event) => event.id))
  const candidates = next.events.filter((event) => !existing.has(event.id))
  const accepted = candidates.filter((event) => {
    const summary = String(event.payload?.summary || event.payload?.description || event.type || '')
    return summary.length >= 12 && !PLACEHOLDER.test(summary) && event.type !== 'tick'
  })
  if (!accepted.length) throw new Error('本轮没有产生可成章的有效事件，已拒绝占位剧情')
  const shared = accepted.find((event) => Array.isArray(event.payload?.participants) && (event.payload!.participants as unknown[]).length >= 2)
  if (!shared) throw new Error('主场景人物没有在同一核心冲突中形成可辨认的相互影响')
  const participants = new Set(contract.participants.map((item) => item.actorId))
  const eventParticipants = Array.isArray(shared.payload?.participants) ? (shared.payload!.participants as unknown[]).map(String) : []
  if (eventParticipants.some((id) => !participants.has(id))) throw new Error('事件包含演化契约外的人物')
  if (shared.type === 'narrative_event') {
    const beats = Array.isArray(shared.payload?.beats) ? shared.payload!.beats as Array<Record<string, unknown>> : []
    if (beats.length < 2) throw new Error('场景事件缺少有序节拍，拒绝将角色日志直接成章')
    if (!beats.some((beat) => Array.isArray(beat.targetActorIds) && (beat.targetActorIds as unknown[]).some((id) => participants.has(String(id))) && String(beat.reaction || '').trim() && String(beat.changedOption || '').trim())) {
      throw new Error('场景事件没有证明他人的反应改变了后续选择')
    }
  }
  // Chapters consume one shared dramatic event instead of a ledger containing
  // every agent's isolated engine event. Individual state still lives in the snapshot.
  return [shared]
}
