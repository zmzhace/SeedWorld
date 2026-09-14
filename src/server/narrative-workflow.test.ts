import { describe, expect, it } from 'vitest'
import { createInitialWorldSlice } from '@/domain/world'
import type { EvolutionContract } from '@/domain/narrative-workflow'
import { materializeContractEvent, validateNarrativeEvents } from '@/domain/narrative-validation'

describe('strict narrative workflow', () => {
  it('rejects placeholder evolution and accepts a consequential shared event', () => {
    const previous = createInitialWorldSlice()
    previous.agents.npcs = [
      { ...previous.agents.personal, genetics: { seed: 'a' }, identity: { name: '甲' }, goals: ['阻止交易'] },
      { ...previous.agents.personal, genetics: { seed: 'b' }, identity: { name: '乙' }, goals: ['完成交易'] },
    ]
    const contract: EvolutionContract = { id:'c',worldId:previous.world_id,tick:1,status:'active',coreEvent:'甲乙围绕交易证据正面冲突',participants:[{actorId:'a',reason:'持有证据',goal:'阻止交易',risk:'身份暴露'},{actorId:'b',reason:'必须成交',goal:'完成交易',risk:'失去资格'}],requiredStateChanges:['交易状态改变'],foreshadowActions:[],allowedAnswers:[],forbiddenMoves:[],emotionTarget:'压迫',climaxForm:'选择',hookType:'choice',hookGoal:'乙必须表态',requiredBeats:['对峙'],continuityChecks:[],evaluationFocus:[],causalAnchorEventIds:[],narrativePurpose:'advance_mainline',createdAt:new Date().toISOString() }
    const placeholder = { ...previous, tick:1, events:[...previous.events,{ id:'e1',type:'action',timestamp:new Date().toISOString(),payload:{summary:'甲停在原地观察周围，暂时没有贸然行动'}}] }
    expect(() => validateNarrativeEvents(previous, placeholder, contract)).toThrow(/占位剧情/)
    const consequential = { ...previous, tick:1, events:[...previous.events,{ id:'isolated',type:'action',timestamp:new Date().toISOString(),payload:{summary:'甲独自整理了手里的证据'}},{ id:'e2',type:'conflict',timestamp:new Date().toISOString(),payload:{summary:'甲当众截断乙的交易，并交出证据；乙因此失去退路，只能公开选择阵营',participants:['a','b']}}] }
    expect(validateNarrativeEvents(previous, consequential, contract).map((event) => event.id)).toEqual(['e2'])
  })

  it('materializes one shared event only when two participants made real new choices', () => {
    const previous = createInitialWorldSlice()
    previous.agents.npcs = [
      { ...previous.agents.personal, genetics:{seed:'a'}, identity:{name:'甲'}, goals:['阻止交易'] },
      { ...previous.agents.personal, genetics:{seed:'b'}, identity:{name:'乙'}, goals:['完成交易'] },
    ]
    const contract = { id:'c2',worldId:previous.world_id,tick:1,status:'active',coreEvent:'争夺证据',participants:[{actorId:'a',reason:'证据',goal:'阻止',risk:'暴露'},{actorId:'b',reason:'交易',goal:'完成',risk:'失败'}],requiredStateChanges:['交易破裂'],foreshadowActions:[],allowedAnswers:[],forbiddenMoves:[],emotionTarget:'紧张',climaxForm:'选择',hookType:'choice',hookGoal:'表态',requiredBeats:[],continuityChecks:[],evaluationFocus:[],causalAnchorEventIds:[],narrativePurpose:'advance_mainline',createdAt:new Date().toISOString() } as EvolutionContract
    const next = { ...previous, time:'2026-01-01T00:00:00.000Z', agents:{...previous.agents,npcs:[{...previous.agents.npcs[0],last_action_description:'当众亮出账本，截断交易'},{...previous.agents.npcs[1],last_action_description:'扣住证人，逼甲撤回指控'}]} }
    const event = materializeContractEvent(previous, next, contract)
    expect(event?.payload.participants).toEqual(['a','b'])
    expect(event?.payload.summary).toContain('互相改变了对方的处境')
  })
})
