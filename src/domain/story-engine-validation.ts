import type { StoryEngine } from './narrative-workflow'

const REQUIRED_TEXT = ['signatureExperience', 'dramaticQuestion', 'repeatableSituation', 'protagonistMethod', 'emotionalPromise'] as const
const REQUIRED_LISTS = ['oppositionSources', 'scarceResources', 'failureCosts', 'progressionRewards', 'variationAxes', 'escalationAxes', 'resetMechanisms', 'exhaustionSignals', 'forbiddenRepetitions'] as const

const PRODUCTIVITY_TEMPLATE_PATTERNS = [
  /用户提出/,
  /任务拆解/,
  /结构化分析/,
  /(?:8|八)步(?:法|流程|结构|框架)?/,
  /解决方案/,
  /可执行方案/,
  /方法论/,
  /项目计划/,
  /多团队协作/,
  /反馈迭代/,
  /成功标准/,
  /复用(?:流程|模板|框架)/,
]

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
}

export function storyEngineText(engine: Partial<StoryEngine> | Record<string, unknown>): string {
  return [
    ...REQUIRED_TEXT.map((key) => String(engine[key] ?? '')),
    ...REQUIRED_LISTS.flatMap((key) => stringList(engine[key])),
  ].join('\n')
}

export function matchedStoryAnchors(
  engine: Partial<StoryEngine> | Record<string, unknown>,
  anchors: string[],
): string[] {
  const body = storyEngineText(engine)
  return [...new Set(anchors.filter((anchor) => anchor.length >= 2 && body.includes(anchor)))]
}

export function storyEngineSpecificityIssues(
  engine: Partial<StoryEngine> | Record<string, unknown>,
  anchors: string[],
): string[] {
  const issues: string[] = []
  const missingText = REQUIRED_TEXT.filter((key) => !String(engine[key] ?? '').trim())
  const missingLists = REQUIRED_LISTS.filter((key) => stringList(engine[key]).length === 0)
  if (missingText.length) issues.push(`缺少文本字段：${missingText.join('、')}`)
  if (missingLists.length) issues.push(`缺少列表字段：${missingLists.join('、')}`)

  const body = storyEngineText(engine)
  const templateHits = PRODUCTIVITY_TEMPLATE_PATTERNS
    .filter((pattern) => pattern.test(body))
    .map((pattern) => pattern.source)
  if (templateHits.length) issues.push(`内容误写成任务管理或生产力方法：${templateHits.join('、')}`)

  const matched = matchedStoryAnchors(engine, anchors)
  const requiredAnchorCount = Math.min(3, Math.max(2, Math.ceil(anchors.length / 10)))
  if (anchors.length >= 2 && matched.length < requiredAnchorCount) {
    issues.push(`作品专属锚点不足：至少需要 ${requiredAnchorCount} 个，实际命中 ${matched.length} 个`)
  }

  const dramaticFields = [engine.signatureExperience, engine.dramaticQuestion, engine.repeatableSituation]
    .map((value) => String(value ?? ''))
    .join('\n')
  if (anchors.length >= 2 && !anchors.some((anchor) => dramaticFields.includes(anchor))) {
    issues.push('核心体验、戏剧问题和重复情境均未落到作品中的具体人物、组织、地点或机制')
  }
  return issues
}
