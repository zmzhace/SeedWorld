import { describe, expect, it } from 'vitest'
import { microStoryIssues } from '@/domain/story-closure-validation'

const validChapter = {
  inheritedConsequenceEventIds: ['event-1'],
  immediateGoal: '在仓库封锁前拿到真实账本',
  centralObstacle: '仓库管理员已收到销毁账本的命令',
  difficultChoice: '他必须放弃不暴露身份的安全，或失去账本',
  concretePayoff: '他抢下账本，证实是内部人篡改了交易日期',
  advancedQuestionIds: ['question-1'],
  answeredQuestionIds: [],
  createdQuestionIds: ['是谁提前下令销毁账本？'],
}

describe('微型故事合同确定性闸门', () => {
  it('拒绝无前章后果、无代价选择和空泛回报的后续章', () => {
    const issues = microStoryIssues({
      ...validChapter,
      inheritedConsequenceEventIds: [],
      difficultChoice: '继续调查',
      concretePayoff: '谜团加深',
      advancedQuestionIds: [],
    }, { isFirst: false, publishedEventIds: new Set(['event-1']), readerQuestionIds: new Set(['question-1']) })
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('具体后果'),
      expect.stringContaining('困难选择'),
      expect.stringContaining('局部回报'),
      expect.stringContaining('读者问题'),
    ]))
  })

  it('放行由已发布事件引发且能给出具体结算的后续章', () => {
    expect(microStoryIssues(validChapter, {
      isFirst: false,
      publishedEventIds: new Set(['event-1']),
      readerQuestionIds: new Set(['question-1']),
    })).toEqual([])
  })

  it('首章可以使用作品起点压力而不伪造历史事件 ID', () => {
    expect(microStoryIssues({ ...validChapter, inheritedConsequenceEventIds: [] }, {
      isFirst: true,
      publishedEventIds: new Set(),
      readerQuestionIds: new Set(['question-1']),
    })).toEqual([])
  })
})
