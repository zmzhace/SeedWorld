import 'server-only'

import { randomUUID } from 'node:crypto'
import { getDatabase } from './database'
import { saveKnowledgeState } from './novel-repository'

export type TransmissionInput = {
  worldId: string
  tick: number
  sourceHolderType: 'actor' | 'faction' | 'public'
  sourceHolderId?: string
  recipientHolderType: 'actor' | 'faction' | 'public'
  recipientHolderId?: string
  claimId: string
  channel: string
  sceneId?: string
  succeeded?: boolean
  distortion?: number
  derivedClaimId?: string
  payload?: Record<string, unknown>
}

/** Append an auditable transmission and, only on success, update recipient knowledge. */
export function recordTransmission(input: TransmissionInput) {
  const db = getDatabase()
  const id = randomUUID()
  const succeeded = input.succeeded !== false
  if (succeeded && input.sourceHolderType === 'actor' && input.sourceHolderId) {
    const known = db.prepare(`SELECT 1 FROM knowledge_states WHERE world_id=? AND holder_type='actor' AND holder_id=? AND claim_id=? AND stance!='rejected' LIMIT 1`).get(input.worldId, input.sourceHolderId, input.claimId)
    if (!known) throw new Error('传播者尚未掌握该命题')
  }
  db.prepare(`INSERT INTO transmissions (id,world_id,tick,source_holder_type,source_holder_id,recipient_holder_type,recipient_holder_id,claim_id,derived_claim_id,channel,scene_id,succeeded,distortion,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.worldId,input.tick,input.sourceHolderType,input.sourceHolderId||null,input.recipientHolderType,input.recipientHolderId||null,input.claimId,input.derivedClaimId||null,input.channel,input.sceneId||null,Number(succeeded),input.distortion||0,JSON.stringify(input.payload||{}),new Date().toISOString())
  if (succeeded && input.recipientHolderType !== 'public' && input.recipientHolderId) {
    saveKnowledgeState({ id: randomUUID(), worldId: input.worldId, holderType: input.recipientHolderType, holderId: input.recipientHolderId, claimId: input.derivedClaimId || input.claimId, stance: 'believed', confidence: Math.max(0, 1 - (input.distortion || 0)), learnedAtTick: input.tick, learnedFromTransmissionId: id, secrecy: input.distortion || 0 })
  }
  return { id, succeeded }
}
