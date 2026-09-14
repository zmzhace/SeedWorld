const values = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
  : []

export function microStoryIssues(
  chapter: Record<string, unknown>,
  options: { isFirst: boolean; publishedEventIds: Set<string>; readerQuestionIds: Set<string> },
): string[] {
  const issues: string[] = []
  const inherited = values(chapter.inheritedConsequenceEventIds)
  const advanced = values(chapter.advancedQuestionIds)
  const answered = values(chapter.answeredQuestionIds)
  const knownQuestions = [...advanced, ...answered]
  if (!options.isFirst && inherited.length === 0) issues.push('后续章没有引用上一章或已发布事件的具体后果')
  const unknownEvents = inherited.filter((id) => !options.publishedEventIds.has(id))
  if (unknownEvents.length) issues.push(`后果锚点不是已发布事件：${unknownEvents.join('、')}`)
  if (!knownQuestions.length) issues.push('本章没有推进或回答任何已有读者问题')
  const unknownQuestions = knownQuestions.filter((id) => !options.readerQuestionIds.has(id))
  if (unknownQuestions.length) issues.push(`读者问题 ID 不存在：${unknownQuestions.join('、')}`)
  const payoff = String(chapter.concretePayoff || '').trim()
  if (/^(谜团加深|局势升级|冲突升级|留下悬念|引出下文)[。！？]?$/.test(payoff)) issues.push('局部回报只是空泛悬念，没有给读者具体答案、胜负、发现或情绪结算')
  const choice = String(chapter.difficultChoice || '').trim()
  if (choice.length < 10 || !/(或|还是|否则|代价|放弃|牺牲|失去)/.test(choice)) issues.push('困难选择未写明不可兼得的选项或代价')
  if (values(chapter.createdQuestionIds).some((question) => question.length < 4)) issues.push('新读者问题不能是无法理解的简短代号')
  return issues
}
