import 'server-only'

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDatabase } from './database'
import { chatJson, chatText } from './llm/openai-compat'
import { getWorld } from './novel-repository'
import { getLatestFoundation } from './narrative-planning-service'

export type OpeningDraftRun = {
  id: string
  worldId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: string
  progress: number
  message: string
  markdown?: string
  review?: Record<string, unknown>
  error?: string
  createdAt: string
  updatedAt: string
}

const active = new Set<string>()

function mapRun(row: Record<string, unknown>): OpeningDraftRun {
  let markdown = ''
  if (row.draft_path) try { markdown = readFileSync(String(row.draft_path), 'utf8') } catch { markdown = '' }
  let review: Record<string, unknown> | undefined
  if (row.review_json) try { review = JSON.parse(String(row.review_json)) } catch { review = undefined }
  return {
    id: String(row.id), worldId: String(row.world_id), status: String(row.status) as OpeningDraftRun['status'],
    stage: String(row.stage), progress: Number(row.progress), message: String(row.message), markdown: markdown || undefined,
    review, error: row.error ? String(row.error) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

function report(id: string, patch: { status: OpeningDraftRun['status']; stage: string; progress: number; message: string; draftPath?: string; review?: unknown; error?: string }) {
  getDatabase().prepare(`UPDATE opening_draft_runs SET status=?,stage=?,progress=?,message=?,draft_path=COALESCE(?,draft_path),review_json=COALESCE(?,review_json),error=?,updated_at=? WHERE id=?`)
    .run(patch.status, patch.stage, patch.progress, patch.message, patch.draftPath || null, patch.review ? JSON.stringify(patch.review) : null, patch.error || null, new Date().toISOString(), id)
}

const clip = (value: unknown, limit = 500) => String(value ?? '').trim().slice(0, limit)

async function runOpeningDraft(runId: string, worldId: string) {
  if (active.has(runId)) return
  active.add(runId)
  try {
    const persisted = getWorld(worldId)
    if (!persisted) throw new Error('作品不存在')
    const foundation = getLatestFoundation(worldId)
    if (!foundation) throw new Error('请先完成资料编译，让首章有可依据的作品根基')
    const actors = (persisted.snapshot as any)?.agents?.npcs?.filter((item: any) => item.life_status !== 'dead') || []
    if (!actors.length) throw new Error('没有可作为首章视角的行动人物')
    const sourceActors = actors.slice(0, 6).map((item: any) => ({ id: item.genetics?.seed, name: item.identity?.name, goal: item.goals?.[0], location: item.location }))
    report(runId, { status: 'running', stage: 'contract', progress: 15, message: '正在锁定单一视角和开篇压力' })
    const plan = await chatJson([{ role: 'user', content: `你是长篇类型小说的首章场景编辑。只设计一个能直接写成小说的现场，不写世界观，不写人物小传，不规划后续章节。
首章只需要回答七件事：谁在现场、他现在必须做什么、什么正在阻止他、他要在什么代价之间选择、选择造成什么结果、读者得到什么局部回报、下一章为什么必须继续。
开头必须从正在发生的动作或异常切入。只允许一个连续地点、一个POV、一个即时目标、一个主要阻碍、一次困难选择和一个不可逆结果。默认最多两名具名人物，不要求解释人物背景；最多一个陌生概念，不要求解释完整原理。
返回严格JSON，字段只能是：title,povId,povName,immediateGoal,obstacle,difficultChoice,consequence,localPayoff,hook,allowedNamedCharacters[],allowedConcepts[]。不要返回 beats、设定说明、历史、阵营或“为什么这样设计”。
作品承诺：${JSON.stringify({ corePromise: foundation.corePromise, centralConflict: foundation.centralConflict, thematicQuestion: foundation.thematicQuestion })}
可选POV：${JSON.stringify(sourceActors)}
` }], { maxTokens: 2400, maxAttempts: 2 })
    const povId = clip(plan.povId, 120)
    const povName = clip(plan.povName, 40)
    const allowedNames = Array.isArray(plan.allowedNamedCharacters) ? plan.allowedNamedCharacters.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 2) : [povName].filter(Boolean)
    if (povName && !allowedNames.includes(povName)) allowedNames.unshift(povName)
    const allowedConcepts = Array.isArray(plan.allowedConcepts) ? plan.allowedConcepts.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 1) : []
    if (!povId || !povName || !plan.immediateGoal || !plan.obstacle || !plan.difficultChoice || !plan.consequence || !plan.localPayoff) throw new Error('首章场景卡不完整，未生成通用兜底剧情')

    report(runId, { status: 'running', stage: 'draft', progress: 42, message: '正在按首章信息预算写作' })
    const contract = { title: clip(plan.title, 80), povId, povName, immediateGoal: clip(plan.immediateGoal, 260), obstacle: clip(plan.obstacle, 260), difficultChoice: clip(plan.difficultChoice, 260), consequence: clip(plan.consequence, 260), localPayoff: clip(plan.localPayoff, 260), hook: clip(plan.hook, 260), allowedNamedCharacters: allowedNames, allowedConcepts }
    let markdown = await chatText([{ role: 'user', content: `你是成熟的中文网络小说作者。根据首章场景卡写完整正文，只输出Markdown，不解释写法。
从现场正在发生的动作开始，不要从醒来、照镜子、天气、梦境、穿越说明或历史介绍开始。全文只写一个连续场景：POV为${contract.povName}，他有一个现在必须完成的目标，遇到一个正在发生的阻碍，在两个都有代价的选择中做决定，并承担结果。人物通过动作和对话自然出现，不轮流介绍，不平均分配戏份。
只允许出现这些具名人物：${JSON.stringify(allowedNames)}。只允许出现这个陌生概念清单：${JSON.stringify(allowedConcepts)}。清单为空就不要创造新术语。不要解释世界全貌、阵营、能力体系或人物前史。章末必须落在本章结果造成的下一压力上，不凭空增加危机。
建议长度 1800 至 2400 字，宁可把一个现场写完整，也不要添加第二个事件。
首章场景卡：${JSON.stringify(contract)}
` }], { maxTokens: 7000 })

    let review: Record<string, unknown> = {}
    for (let revision = 0; revision < 2; revision++) {
      report(runId, { status: 'running', stage: 'review', progress: 68 + revision * 12, message: revision ? '正在复审修订稿' : '正在执行首章读者测试' })
      review = await chatJson([{ role: 'user', content: `你是不知道世界设定的首章读者。只读正文与允许名单，返回严格JSON：pov,goal,obstacle,choice,result,payoff,reasonToContinue,namedCharacters[],newConcepts[],unexplainedItems[],informationDumpQuotes[],passed。
passed只能在以下条件全部成立时为true：可清楚复述目标-阻碍-选择-结果；有具体局部回报；具名人物不超过允许名单且总数不超过2；陌生核心概念不超过1；没有设定说明段；无需查资料即可理解当下场景。unexplainedItems只能列出会阻断当前场景理解的内容，不要因为人物背景、世界历史或术语原理尚未解释就列出问题。
允许人物：${JSON.stringify(allowedNames)}
允许概念：${JSON.stringify(allowedConcepts)}
正文：${markdown}` }], { maxTokens: 3200, maxAttempts: 2 })
      const names = Array.isArray(review.namedCharacters) ? review.namedCharacters.map(String).filter(Boolean) : []
      const concepts = Array.isArray(review.newConcepts) ? review.newConcepts.map(String).filter(Boolean) : []
      const unexplained = Array.isArray(review.unexplainedItems) ? review.unexplainedItems.map(String).filter(Boolean) : []
      const dumps = Array.isArray(review.informationDumpQuotes) ? review.informationDumpQuotes.map(String).filter(Boolean) : []
      const missingCore = ['pov', 'goal', 'obstacle', 'choice', 'result', 'payoff'].some((key) => !clip(review[key]))
      const unauthorizedNames = names.filter((name) => !allowedNames.includes(name))
      const unauthorizedConcepts = concepts.filter((concept) => !allowedConcepts.includes(concept))
      // A name is not an error merely because its history is not explained.
      // The first chapter only needs to make its current role legible.
      const passed = review.passed === true && !missingCore && names.length <= 2 && !unauthorizedNames.length && !unauthorizedConcepts.length && !unexplained.length && !dumps.length
      review = { ...review, namedCharacters: names, newConcepts: concepts, unexplainedItems: unexplained, informationDumpQuotes: dumps, passed }
      if (passed) break
      if (revision === 1) throw new Error(`首章修订后仍未通过读者测试：${[...unexplained, ...dumps].slice(0, 4).join('；') || '无法清楚复述目标、阻碍、选择和结果'}`)
      report(runId, { status: 'running', stage: 'revise', progress: 78, message: '正在删除多余人物、概念和设定解释' })
      markdown = await chatText([{ role: 'user', content: `根据读者测试修订整篇首章，只输出Markdown正文。不得新增人物、概念、历史、阵营或危机。优先删除信息，不得用更长解释修补。
读者测试：${JSON.stringify(review)}
首章合同：${JSON.stringify(contract)}
原文：${markdown}` }], { maxTokens: 10_000 })
    }

    const root = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
    const dir = path.join(root, 'worlds', worldId, 'opening-workshop')
    await mkdir(dir, { recursive: true })
    const draftPath = path.join(dir, `${runId}.md`)
    await writeFile(draftPath, markdown, 'utf8')
    report(runId, { status: 'completed', stage: 'completed', progress: 100, message: '首章重写稿已通过信息预算和读者测试，未覆盖已发布正文', draftPath, review })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report(runId, { status: 'failed', stage: 'blocked', progress: 100, message: '首章工坊已停止，原稿未变更', error: message })
  } finally { active.delete(runId) }
}

export function getLatestOpeningDraftRun(worldId: string): OpeningDraftRun | null {
  const row = getDatabase().prepare('SELECT * FROM opening_draft_runs WHERE world_id=? ORDER BY created_at DESC LIMIT 1').get(worldId) as Record<string, unknown> | undefined
  if (!row) return null
  const run = mapRun(row)
  if (run.status === 'queued' || run.status === 'running') void runOpeningDraft(run.id, worldId)
  return run
}

export function startOpeningDraftRun(worldId: string): OpeningDraftRun {
  const db = getDatabase()
  const running = db.prepare("SELECT * FROM opening_draft_runs WHERE world_id=? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1").get(worldId) as Record<string, unknown> | undefined
  if (running) return mapRun(running)
  const id = randomUUID(); const now = new Date().toISOString()
  db.prepare('INSERT INTO opening_draft_runs (id,world_id,status,stage,progress,message,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, worldId, 'queued', 'queued', 0, '等待首章工坊开始', now, now)
  void runOpeningDraft(id, worldId)
  return mapRun(db.prepare('SELECT * FROM opening_draft_runs WHERE id=?').get(id) as Record<string, unknown>)
}
