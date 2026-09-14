import { describe, expect, it } from 'vitest'
import { matchedStoryAnchors, storyEngineSpecificityIssues } from './story-engine-validation'

const complete = {
  signatureExperience: '角色每次借用逆相能量，都必须决定由谁承担不可逆代价。',
  dramaticQuestion: '当共鸣网把所有人的生存绑在一起，个人还能拒绝成为人类容器吗？',
  repeatableSituation: '临江总控炉出现缺口，知情者必须在隐瞒真相和牺牲具体的人之间选择。',
  protagonistMethod: '调查能量流向，逼迫掌权者公开代价，再寻找第三条路。',
  oppositionSources: ['共鸣网的制度惯性', '人类容器计划的执行者'],
  scarceResources: ['逆相能量', '可信证据'],
  failureCosts: ['具体人物被选为容器'],
  progressionRewards: ['掌握一段能量流向证据'],
  variationAxes: ['知情者身份', '代价承担者'],
  escalationAxes: ['总控炉影响范围'],
  resetMechanisms: ['一次危机解决后暴露更深层的能量债务'],
  exhaustionSignals: ['连续使用相同的牺牲选择'],
  emotionalPromise: '每次胜利都救下一个具体的人，也让更大的共同体债务浮出水面。',
  forbiddenRepetitions: ['只换地点重复封炉'],
}

describe('storyEngineSpecificityIssues', () => {
  const anchors = ['逆相能量', '共鸣网', '人类容器计划', '临江总控炉']

  it('accepts a complete engine grounded in the work', () => {
    expect(storyEngineSpecificityIssues(complete, anchors)).toEqual([])
    expect(matchedStoryAnchors(complete, anchors)).toEqual(anchors)
  })

  it('rejects a complete-looking productivity template', () => {
    const generic = Object.fromEntries(Object.entries(complete).map(([key, value]) => [
      key,
      Array.isArray(value) ? ['任务拆解与反馈迭代'] : '用户提出复杂问题后，用八步结构化分析形成可执行方案。',
    ]))
    expect(storyEngineSpecificityIssues(generic, anchors).join('\n')).toMatch(/生产力|作品专属锚点/)
  })

  it('rejects an ungrounded generic fiction loop', () => {
    const generic = { ...complete, signatureExperience: '主人公面对危险并成长。', dramaticQuestion: '他能否胜利？', repeatableSituation: '新的敌人不断出现。' }
    expect(storyEngineSpecificityIssues(generic, anchors).join('\n')).toContain('核心体验')
  })
})
