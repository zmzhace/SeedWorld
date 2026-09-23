import type { WritingSettings } from '@/domain/novel-graph'

export type PlatformBranch = 'generic' | 'tomato_shuangwen'

export function getPlatformBranch(settings: WritingSettings): PlatformBranch {
  if (settings.platformBranch === 'tomato_shuangwen') return 'tomato_shuangwen'
  return /番茄|爽文/.test(`${settings.audience || ''} ${settings.genre || ''}`) ? 'tomato_shuangwen' : 'generic'
}

/** Full-book policy: this is deliberately shared by engine, outline, writer and editor prompts. */
export function platformBranchRules(branch: PlatformBranch): string {
  if (branch !== 'tomato_shuangwen') return ''
  return `
【番茄爽文全书分支】
- 作品每章必须同时完成“当章目标、可见收益、下一步压力”；不能连续两章只埋谜团或只解释设定。
- 开篇五百字内出现具体利益、尊严、资源或时间压力；主角必须主动行动，不等系统替他解决。
- 每章至少兑现一次可感知的反击、打脸、升级、资源增长、权限提升或关系逆转；收益必须改变后续选择。
- 系统无身体、记忆、情绪副作用；能力边界只能来自资源、时间、次数、范围、材料或暴露风险，且必须在正文中可理解。
- 主线持续升级：同一压迫不能换地点重复三次；每个故事弧至少改变一次对抗层级、收益规模或选择代价。
- 反派与阻力必须真实损失资源、信誉、权限或行动空间，不能只口头威胁后自动退场。
- 每章结尾留下由本章收益或反击直接产生的下一压力，不得凭空空降危机。
- Writer 不得写“系统播报流水账”，只写会影响当前选择的最小提示；不得堆砌等级、面板、商城和属性表。
`
}
