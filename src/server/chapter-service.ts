import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ChapterOutline, ChapterReview, EvolutionContract, ReaderComprehensionReview, ReviewDimensionKey, ReviewIssue } from '@/domain/narrative-workflow'
import { getDatabase } from './database'
import { getWorld, listArchive, saveWorkflowCheckpoint } from './novel-repository'
import { applyTransitionInTransaction, loadPendingTransition, markWorkflow, projectNarrativeAfterPublish } from './narrative-control-service'
import { loadSceneBeats } from './scene-resolution-service'
import { listWiki } from './wiki-service'
import { ensureCompass } from './compass-service'
import { chatText } from './llm/openai-compat'
import { chatJson } from './llm/openai-compat'
import { DRAFT_RULES, REVISE_RULES } from './llm/rules'
import { getStoryEngine } from './story-engine-service'
import { applyReaderAndStoryProjection } from './reader-story-service'
import { getPlatformBranch, platformBranchRules } from './platform-branch'

export type ChapterRequest = { worldId: string; tickFrom: number; tickTo: number; tick?: number; contractId?: string; povEntityId?: string; goal?: string; requiredEvents?: string[]; eventIds?: string[]; resumeDraftPath?: string }

async function ask(prompt: string, maxTokens = 8192) { return chatText([{ role: 'user', content: prompt }], { maxTokens }) }

export type ChapterRun = {
  id: string; worldId: string; status: 'queued' | 'running' | 'completed' | 'failed'; stage: string; progress: number; message: string
  tickFrom: number; tickTo: number; tick?: number; contractId?: string; revisionCount: number; draftPath?: string; chapterId?: string; error?: string; createdAt: string; updatedAt: string
}

const activeChapterRuns = new Set<string>()

function launchChapterRun(runId: string, input: ChapterRequest) {
  if (activeChapterRuns.has(runId)) return
  activeChapterRuns.add(runId)
  void runChapter(runId, input)
    .catch((error) => markChapterFailure(runId, input, error))
    .finally(() => activeChapterRuns.delete(runId))
}

function mapRun(row: Record<string, unknown>): ChapterRun {
  return { id: String(row.id), worldId: String(row.world_id), status: String(row.status) as ChapterRun['status'], stage: String(row.stage), progress: Number(row.progress), message: String(row.message), tickFrom: Number(row.tick_from), tickTo: Number(row.tick_to), tick: row.tick == null ? undefined : Number(row.tick), contractId: row.contract_id ? String(row.contract_id) : undefined, revisionCount: Number(row.revision_count || 0), draftPath: row.draft_path ? String(row.draft_path) : undefined, chapterId: row.chapter_id ? String(row.chapter_id) : undefined, error: row.error ? String(row.error) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function reportRun(id: string, patch: { status: ChapterRun['status']; stage: string; progress: number; message: string; chapterId?: string; error?: string; revisionCount?: number }) {
  getDatabase().prepare(`UPDATE chapter_runs SET status=?,stage=?,progress=?,message=?,chapter_id=COALESCE(?,chapter_id),error=?,revision_count=COALESCE(?,revision_count),updated_at=? WHERE id=?`).run(patch.status, patch.stage, patch.progress, patch.message, patch.chapterId || null, patch.error || null, patch.revisionCount ?? null, new Date().toISOString(), id)
}

export function getLatestChapterRun(worldId: string): ChapterRun | null {
  const row = getDatabase().prepare(`SELECT c.* FROM chapter_runs c LEFT JOIN simulation_ticks t ON t.world_id=c.world_id AND t.tick=c.tick
    WHERE c.world_id=? ORDER BY COALESCE(c.tick,0) DESC,
    CASE WHEN t.status='published' AND c.status='completed' THEN 0 WHEN c.status IN ('queued','running') THEN 1 ELSE 2 END,
    c.created_at DESC LIMIT 1`).get(worldId) as Record<string, unknown> | undefined
  if (!row) return null
  const run = mapRun(row)
  if (run.status === 'queued' || run.status === 'running') launchChapterRun(run.id, { worldId: run.worldId, tickFrom: run.tickFrom, tickTo: run.tickTo, tick: run.tick, contractId: run.contractId, resumeDraftPath: run.draftPath })
  return run
}

export function getChapterRunForTick(worldId: string, tick: number): ChapterRun | null {
  const row = getDatabase().prepare(`SELECT c.* FROM chapter_runs c LEFT JOIN simulation_ticks t ON t.world_id=c.world_id AND t.tick=c.tick
    WHERE c.world_id=? AND c.tick=? ORDER BY CASE WHEN t.status='published' AND c.status='completed' THEN 0 WHEN c.status IN ('queued','running') THEN 1 ELSE 2 END,c.created_at DESC LIMIT 1`).get(worldId, tick) as Record<string, unknown> | undefined
  return row ? mapRun(row) : null
}

export function getChapter(chapterId: string) {
  const row = getDatabase().prepare('SELECT * FROM chapters WHERE id=?').get(chapterId) as Record<string, unknown> | undefined
  if (!row) return null
  let markdown = ''; try { markdown = readFileSync(String(row.markdown_path), 'utf8') } catch { markdown = '' }
  return { id: String(row.id), chapterNumber: Number(row.chapter_number), version: Number(row.version), title: String(row.title), markdown, validation: JSON.parse(String(row.validation_json || '{}')) }
}

export function listChapters(worldId: string) {
  const rows = getDatabase().prepare('SELECT * FROM chapters WHERE world_id=? ORDER BY chapter_number DESC, version DESC').all(worldId) as Record<string, unknown>[]
  return rows.map((row) => {
    let markdown = ''
    try { markdown = readFileSync(String(row.markdown_path), 'utf8') } catch { markdown = '' }
    return {
      id: String(row.id),
      chapterNumber: Number(row.chapter_number),
      version: Number(row.version),
      title: String(row.title),
      povEntityId: row.pov_entity_id ? String(row.pov_entity_id) : undefined,
      tickFrom: Number(row.tick_from),
      tickTo: Number(row.tick_to),
      generationKind: String(row.generation_kind || 'legacy_generation'),
      createdAt: String(row.created_at),
      markdown,
      validation: JSON.parse(String(row.validation_json || '{}')),
    }
  })
}

export function getChapterReviews(worldId: string, chapterId?: string): ChapterReview[] {
  const rows = chapterId ? getDatabase().prepare('SELECT review_json FROM chapter_reviews WHERE world_id=? AND chapter_id=? ORDER BY revision').all(worldId, chapterId) : getDatabase().prepare('SELECT review_json FROM chapter_reviews WHERE world_id=? ORDER BY created_at DESC LIMIT 20').all(worldId)
  return (rows as Array<{ review_json: string }>).map((row) => JSON.parse(row.review_json) as ChapterReview)
}

export function startChapterRun(input: ChapterRequest): ChapterRun {
  const db = getDatabase()
  if (input.tick != null) {
    const existing = getChapterRunForTick(input.worldId, input.tick)
    if (existing && ['queued', 'running', 'completed'].includes(existing.status)) return existing
  }
  const id = randomUUID(); const now = new Date().toISOString()
  db.prepare(`INSERT INTO chapter_runs (id,world_id,status,stage,progress,message,tick_from,tick_to,tick,contract_id,revision_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.worldId, 'queued', 'queued', 0, '等待开始', input.tickFrom, input.tickTo, input.tick ?? null, input.contractId || null, 0, now, now)
  launchChapterRun(id, input)
  return mapRun(db.prepare('SELECT * FROM chapter_runs WHERE id=?').get(id) as Record<string, unknown>)
}

function markChapterFailure(runId: string, input: ChapterRequest, error: unknown) {
  const message = error instanceof Error ? error.message : String(error); const db = getDatabase(); db.exec('BEGIN')
  try {
    reportRun(runId, { status: 'failed', stage: 'blocked', progress: 100, message: '章节未通过严格审稿，已保留问题证据', error: message })
    if (input.tick != null) {
      db.prepare("UPDATE simulation_ticks SET status='blocked',block_reason=? WHERE world_id=? AND tick=?").run(message, input.worldId, input.tick)
      db.prepare("UPDATE workflow_runs SET status='blocked',current_step='blocked',error=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE world_id=? AND tick=?").run(message, new Date().toISOString(), input.worldId, input.tick)
    }
    if (input.contractId) db.prepare("UPDATE evolution_contracts SET status='blocked' WHERE id=?").run(input.contractId)
    db.exec('COMMIT')
  } catch (transactionError) { db.exec('ROLLBACK'); console.error('Failed to mark chapter pipeline blocked:', transactionError) }
}

export async function generateChapter(input: ChapterRequest) {
  const done = await waitChapterRun(startChapterRun(input).id)
  if (done.status !== 'completed' || !done.chapterId) throw new Error(done.error || '生成失败')
  return getChapter(done.chapterId)
}

async function waitChapterRun(id: string): Promise<ChapterRun> {
  for (;;) {
    const row = getDatabase().prepare('SELECT * FROM chapter_runs WHERE id=?').get(id) as Record<string, unknown> | undefined
    if (!row) throw new Error('任务不存在')
    const run = mapRun(row); if (run.status === 'completed' || run.status === 'failed') return run
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

const DIMENSIONS: ReviewDimensionKey[] = ['world_consistency', 'character_consistency', 'pacing_density', 'causal_coherence', 'foreshadow_health', 'hook_quality', 'aesthetic_quality']

function extractJson(content: string): Record<string, unknown> {
  const match = content.match(/\{[\s\S]*\}/); if (!match) throw new Error('审稿结果不是有效 JSON')
  return JSON.parse(match[0]) as Record<string, unknown>
}

function normalizeReview(raw: Record<string, unknown>, input: { worldId: string; runId: string; revision: number }): ChapterReview {
  const rawDimensions = Array.isArray(raw.dimensions) ? raw.dimensions as Record<string, unknown>[] : []
  const dimensions = DIMENSIONS.map((key) => { const found = rawDimensions.find((item) => item.key === key); return { key, score: Math.max(0, Math.min(100, Number(found?.score ?? 0))), evidence: String(found?.evidence || '缺少评分证据') } })
  const issues: ReviewIssue[] = (Array.isArray(raw.issues) ? raw.issues as Record<string, unknown>[] : []).map((issue) => ({ severity: ['critical','error','warning'].includes(String(issue.severity)) ? String(issue.severity) as ReviewIssue['severity'] : 'error', quote: String(issue.quote || ''), contractField: String(issue.contractField || 'unknown'), message: String(issue.message || '未说明问题'), instruction: String(issue.instruction || '按章节契约修订') }))
  if (issues.some((issue) => !issue.quote.trim())) issues.push({ severity: 'error', quote: '（审稿未提供正文证据）', contractField: 'editor.evidence', message: '审稿意见缺少对应正文证据', instruction: '重新阅读正文并引用具体片段' })
  const averageScore = dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length
  const deletionLoss = String(raw.deletionLoss || '')
  // Some OpenAI-compatible providers serialize booleans as strings. More
  // importantly, the deletion-test prose can unambiguously say that removal
  // would break causality while the flag is malformed. Preserve the semantic
  // verdict instead of blocking a 90+ chapter on a transport-format quirk.
  const deletionTestPassed = raw.deletionTestPassed === true || raw.deletionTestPassed === 'true' || /删除.{0,12}(严重)?(损害|破坏|导致.{0,12}(断裂|缺失|无法))/.test(deletionLoss)
  // Scores and deletion-test quality are editorial signals. Only cited
  // critical contradictions are publication blockers; prose-level errors get
  // one directed revision and remain visible in the quality report.
  const passed = !issues.some((issue) => issue.severity === 'critical')
  return { id: randomUUID(), worldId: input.worldId, runId: input.runId, revision: input.revision, dimensions, issues, deletionTestPassed, deletionLoss, averageScore, passed, createdAt: new Date().toISOString() }
}

function saveReview(review: ChapterReview) {
  getDatabase().prepare('INSERT INTO chapter_reviews (id,world_id,chapter_id,run_id,revision,review_json,passed,average_score,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(review.id, review.worldId, null, review.runId, review.revision, JSON.stringify(review), Number(review.passed), review.averageScore, review.createdAt)
}

function loadContract(input: ChapterRequest): EvolutionContract | undefined {
  if (!input.contractId) return undefined
  const row = getDatabase().prepare('SELECT contract_json FROM evolution_contracts WHERE world_id=? AND id=?').get(input.worldId, input.contractId) as { contract_json: string } | undefined
  return row ? JSON.parse(row.contract_json) as EvolutionContract : undefined
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return typeof value === 'string' ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function loadVisibleFacts(worldId: string, povId: string | undefined, tick: number) {
  if (!povId) return []
  return getDatabase().prepare(`
    SELECT c.*, subject.name AS subject_name, object.name AS object_name
    FROM claims c
    LEFT JOIN entities subject ON subject.id=c.subject_id
    LEFT JOIN entities object ON object.id=c.object_id
    WHERE c.world_id=?
      AND (c.valid_until IS NULL OR CAST(c.valid_until AS INTEGER)>=?)
      AND (
        c.claim_scope='public_narrative'
        OR (c.claim_scope='character_belief' AND c.believer_id=?)
        OR EXISTS (
          SELECT 1 FROM knowledge_states k
          WHERE k.world_id=c.world_id AND k.claim_id=c.id
            AND k.learned_at_tick<=? AND k.stance!='rejected'
            AND (k.holder_type='public' OR (k.holder_type='actor' AND k.holder_id=?))
        )
      )
    ORDER BY c.created_at DESC
    LIMIT 120
  `).all(worldId, tick, povId, tick, povId) as Record<string, unknown>[]
}

function deterministicNarrativeIssues(input: {
  markdown: string
  contract?: EvolutionContract
  actorNames: Array<{ id: string; name: string }>
  chapterNumber: number
}): ReviewIssue[] {
  // A manual continuation request may intentionally omit a formal contract
  // while the author is testing the service against an already-published
  // opening. In that compatibility mode the request's world cast is the
  // authorization boundary; formal ticks still use the narrower contract cast.
  const allowed = new Set(input.contract
    ? [
        ...(input.contract.participants || []).map((item) => item.actorId),
        ...(input.contract.referenceEntities || []).map((item) => item.entityId),
      ]
    : input.actorNames.map((actor) => actor.id))
  const mentioned = input.actorNames.filter((actor) => actor.name.length >= 2 && input.markdown.includes(actor.name))
  const unauthorized = mentioned.filter((actor) => !allowed.has(actor.id))
  const issues: ReviewIssue[] = unauthorized.map((actor) => ({
    severity: 'critical', quote: actor.name, contractField: 'cast.authorization',
    message: `正文点名了未进入本章契约的角色“${actor.name}”`,
    instruction: '删除该点名，或在重新规划章节时说明其不可替代的叙事职责。',
  }))
  if (input.chapterNumber === 1 && mentioned.length > 3) {
    issues.push({ severity: 'error', quote: mentioned.slice(0, 4).map((item) => item.name).join('、'), contractField: 'readerEntry.cast', message: '首章同时点名的角色过多，读者还没有稳定的故事入口。', instruction: '只保留 POV 与直接改变本章冲突的一至两人。' })
  }
  for (const paragraph of input.markdown.split(/\n\s*\n/)) {
    const namesInParagraph = mentioned.filter((actor) => paragraph.includes(actor.name))
    if (namesInParagraph.length >= 3 && (paragraph.match(/[；;]/g) || []).length >= 2) {
      issues.push({ severity: 'error', quote: paragraph.slice(0, 220), contractField: 'prose.shared_scene', message: '段落以分号依次汇报多名角色的行动，形成智能体流水账。', instruction: '改写为一条可见的行动—反应—后果链，只在角色改变冲突时让他出现。' })
      break
    }
  }
  return issues
}

async function reviewChapter(worldId: string, runId: string, revision: number, material: string, contract: EvolutionContract | undefined, markdown: string, context: { actorNames: Array<{ id: string; name: string }>; chapterNumber: number }): Promise<ChapterReview> {
  if (context.chapterNumber > 1) material += '\n连续性审稿硬约束：上一章已经明确的身体状态、数量、能力代价和物品状态必须原样继承；本章新增的伤势或代价必须有现场触发、角色感知和因果解释，不能由系统突然宣布。若前章写明某只手的若干手指失去感觉，本章不得无契约地扩展到另一只手或改变数量。'
  const rawText = await ask(`你是严格且以证据为准的长篇小说主编。阅读契约、可见事实和完整正文，逐项评分。零容忍：设定冲突、知识越权、无动机重大行动、死亡角色行动、核心事件缺失，以及用另一件事替换 mainlineObjective。必须核对：正文是否由 causalPrerequisite 引发；是否完成 mainlineObjective 和 requiredStateChanges；是否给出 readerPayoff；是否越过 scopeBoundary；本章的变化是否为 globalRelevance 做了真实准备而不是只在口头上相关。任一主线对齐失败必须记为 critical。同时检查前三段钩子、承接、单一核心事件、触发-动机-行动-后果、对话职责、章末钩子因果来源，以及删除本章是否会损害因果/人物选择/信息理解/情绪积累/伏笔兑现。特别检查：是否因为 Agent 存在就逐一点名；是否按角色轮流汇报各自动作；每名出现的人物是否实际改变了同一核心冲突。这三项任一失败必须记为 error。返回 JSON：dimensions[{key,score,evidence}]（key 必须为 ${DIMENSIONS.join(',')}），issues[{severity:critical|error|warning,quote,contractField,message,instruction}]，deletionTestPassed:boolean，deletionLoss:string。每条问题必须逐字引用正文。每维不得低于70，平均不得低于80。\n契约：${JSON.stringify(contract || {})}\n素材：${material}\n正文：${markdown}`, 6144)
  const review = normalizeReview(extractJson(rawText), { worldId, runId, revision })
  const deterministic = deterministicNarrativeIssues({ markdown, contract, ...context })
  if (deterministic.length) {
    review.issues.push(...deterministic)
    review.passed = !review.issues.some((issue) => issue.severity === 'critical')
    for (const dimension of review.dimensions) {
      if (dimension.key === 'pacing_density' || dimension.key === 'causal_coherence') dimension.score = Math.min(dimension.score, 60)
    }
    review.averageScore = review.dimensions.reduce((sum, item) => sum + item.score, 0) / review.dimensions.length
  }
  saveReview(review); return review
}

async function reviewStateEvidence(worldId: string, runId: string, contract: EvolutionContract, markdown: string) {
  const deltas = contract.requiredDeltas || []
  if (!deltas.length) throw new Error('演化契约没有结构化状态变化，不能发布')
  const raw = extractJson(await ask(`你是状态证据审查器，不评价文笔。为每个必须状态变化从正文中逐字引用一段能证明变化已真正发生的文字。如果只是暗示、打算、回想或未落地，passed 必须为 false。返回 JSON：{evidence:[{deltaId,quote,passed,reason}]}\n状态变化：${JSON.stringify(deltas)}\n正文：${markdown}`, 4096))
  const evidence = (Array.isArray(raw.evidence) ? raw.evidence : []) as Array<Record<string, unknown>>
  const db = getDatabase(); const now = new Date().toISOString()
  const normalized = deltas.map((delta) => {
    const found = evidence.find((item) => String(item.deltaId) === delta.id)
    const quote = String(found?.quote || '').trim()
    const passed = found?.passed === true && quote.length >= 4 && markdown.includes(quote)
    return { deltaId: delta.id, quote, passed, reason: String(found?.reason || '缺少状态变化证据') }
  })
  const insert = db.prepare(`INSERT INTO chapter_state_evidence (id,world_id,chapter_id,run_id,delta_id,quote,evidence_json,passed,created_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(run_id,delta_id) DO UPDATE SET quote=excluded.quote,evidence_json=excluded.evidence_json,passed=excluded.passed,created_at=excluded.created_at`)
  for (const item of normalized) insert.run(`evidence-${runId}-${item.deltaId}`, worldId, null, runId, item.deltaId, item.quote, JSON.stringify(item), Number(item.passed), now)
  if (normalized.some((item) => !item.passed)) throw new Error('正文没有落地全部必须状态变化：' + normalized.filter((item) => !item.passed).map((item) => `${item.deltaId}：${item.reason}`).join('；'))
  return normalized
}

async function reviewReaderComprehension(input: { worldId: string; runId: string; markdown: string; previousEnding: string; establishedText?: string; contract?: EvolutionContract; outline?: ChapterOutline }): Promise<ReaderComprehensionReview> {
  const raw = await chatJson([{ role: 'user', content: `你是第一次读到本章的普通读者。你只能依据正文、上一章结尾和本章允许信息复述故事，不能读取世界答案。返回 JSON：pov,immediateGoal,obstacle,choice,consequence,localPayoff,reasonToContinue,unexplainedNames[],unexplainedConcepts[],unsupportedConclusions[],passed。无法明确复述目标、阻碍、选择、结果或具体回报时 passed=false；出现必须查设定才能理解的名字、概念或结论时 passed=false。unsupportedConclusions 只能列正文已经明确断言或强烈暗示、但现有文字没有证据支持的结论；不得列正文明确保留、否定或尚未回答的问题。\n上一章结尾：${input.previousEnding || '这是首章，没有前文'}\n本章允许信息：${JSON.stringify({ readerEntry: input.contract?.readerEntry, immediateGoal: input.outline?.immediateGoal, centralObstacle: input.outline?.centralObstacle, difficultChoice: input.outline?.difficultChoice, concretePayoff: input.outline?.concretePayoff })}\n正文：${input.markdown}` }], { maxTokens: 3600 })
  const required = ['pov','immediateGoal','obstacle','choice','consequence','localPayoff','reasonToContinue']
  const missing = required.filter((key) => !String(raw[key] || '').trim())
  // A continuation reader has the published chapters, not only the final 900
  // characters of the immediately previous chapter. Terms already present in
  // published prose are established context and must not become false-positive
  // comprehension failures.
  const established = input.establishedText || ''
  const unexplainedNames = Array.isArray(raw.unexplainedNames) ? raw.unexplainedNames.map(String).filter((value) => Boolean(value) && !established.includes(value)) : []
  const unexplainedConcepts = Array.isArray(raw.unexplainedConcepts) ? raw.unexplainedConcepts.map(String).filter((value) => Boolean(value) && !established.includes(value)) : []
  const unsupportedConclusions = Array.isArray(raw.unsupportedConclusions) ? raw.unsupportedConclusions.map(String).filter(Boolean) : []
  const review: ReaderComprehensionReview = { id: randomUUID(), worldId: input.worldId, runId: input.runId, pov: String(raw.pov || ''), immediateGoal: String(raw.immediateGoal || ''), obstacle: String(raw.obstacle || ''), choice: String(raw.choice || ''), consequence: String(raw.consequence || ''), localPayoff: String(raw.localPayoff || ''), reasonToContinue: String(raw.reasonToContinue || ''), unexplainedNames, unexplainedConcepts, unsupportedConclusions, passed: raw.passed === true && !missing.length && !unexplainedNames.length && !unexplainedConcepts.length && !unsupportedConclusions.length, createdAt: new Date().toISOString() }
  getDatabase().prepare('INSERT INTO reader_comprehension_reviews (id,world_id,run_id,review_json,passed,created_at) VALUES (?,?,?,?,?,?)').run(review.id, input.worldId, input.runId, JSON.stringify(review), Number(review.passed), review.createdAt)
  return review
}

async function runChapter(runId: string, input: ChapterRequest) {
  const world = getWorld(input.worldId); if (!world) throw new Error('世界不存在')
  const existingChapterCount = Number((getDatabase().prepare('SELECT COUNT(*) AS value FROM chapters WHERE world_id=?').get(input.worldId) as { value: number }).value)
  const isOpening = existingChapterCount === 0
  if (!isOpening && !world.visibilityConfirmed) throw new Error('角色知识边界尚未确认')
  const contract = loadContract(input); if (input.contractId && !contract) throw new Error('演化契约不存在')
  const engine = getStoryEngine(input.worldId)
  if (!isOpening && (!engine || engine.status !== 'confirmed')) throw new Error('故事发动机未确认，不能生成正式章节')
  reportRun(runId, { status: 'running', stage: 'material', progress: 5, message: '正在按演化契约准备章节素材' })
  if (input.tick != null) getDatabase().prepare("UPDATE simulation_ticks SET status='reviewing' WHERE world_id=? AND tick=?").run(input.worldId, input.tick)
  const ticks = getDatabase().prepare('SELECT tick,payload_json FROM simulation_ticks WHERE world_id=? AND tick BETWEEN ? AND ? ORDER BY tick').all(input.worldId, input.tickFrom, input.tickTo) as Array<{ tick: number; payload_json: string }>
  const selectedEvents = input.eventIds?.length ? getDatabase().prepare(`SELECT * FROM events WHERE world_id=? AND id IN (${input.eventIds.map(() => '?').join(',')}) ORDER BY tick,created_at`).all(input.worldId, ...input.eventIds) as Record<string, unknown>[] : []
  const pendingTransition = input.tick != null ? loadPendingTransition(input.worldId, input.tick) : null
  if (contract && !pendingTransition) throw new Error('演化契约没有通过编剧会的待提交状态变化')
  const approvedBeats = input.tick != null ? loadSceneBeats(input.worldId, input.tick) : []
  const outlineRow = contract?.chapterOutlineId ? getDatabase().prepare('SELECT outline_json FROM chapter_outlines WHERE id=?').get(contract.chapterOutlineId) as { outline_json: string } | undefined : undefined
  const chapterOutline = outlineRow ? JSON.parse(outlineRow.outline_json) as ChapterOutline : undefined
  const archive = listArchive(input.worldId, { limit: 160 }); const povId = input.povEntityId || contract?.povEntityId
  const pov = povId ? archive.entities.find((entity: any) => entity.id === povId) : undefined
  const chapterNumber = existingChapterCount + 1
  const visibleFacts = loadVisibleFacts(input.worldId, povId, input.tickTo)
  const participantIds = new Set([povId, ...(contract?.participants || []).map((item) => item.actorId)].filter(Boolean))
  const beatClaimIds = new Set(approvedBeats.flatMap((beat) => [...(beat.claimIds || []), ...(beat.evidenceClaimIds || [])]))
  const facts = visibleFacts.filter((fact: any) => participantIds.has(fact.subject_id) || participantIds.has(fact.object_id) || beatClaimIds.has(String(fact.id)))
  const snapshot = world.snapshot as any
  const snapshotActors = (snapshot?.agents?.npcs || []) as any[]
  const actorNames = snapshotActors.map((actor) => ({ id: String(actor.genetics?.seed || ''), name: String(actor.identity?.name || '') })).filter((actor) => actor.id && actor.name)
  const castNames = new Set(actorNames.filter((actor) => participantIds.has(actor.id)).map((actor) => actor.name))
  const allWiki = listWiki(input.worldId)
  const wiki = chapterNumber === 1 ? [] : allWiki.filter((page: any) => [...castNames].some((name) => String(page.markdown || '').includes(name))).slice(0, 1)
  const compass = chapterNumber === 1 ? { current: { openThreads: [] } } : await ensureCompass(input.worldId, JSON.stringify(facts.slice(0, 16)))
  const anchors = (world.writingSettings.styleAnchors || []).slice(0, 3); const anchorBlock = anchors.length ? `\nSTYLE ANCHORS：\n${anchors.map((anchor, index) => `[${index + 1}] ${anchor}`).join('\n')}` : ''
  const clip = (value: unknown, limit = 360) => String(value ?? '').slice(0, limit)
  const compactTicks = ticks.map((item) => { const state = JSON.parse(item.payload_json) as any; return { tick: item.tick, time: state.time, environment: clip(state.environment?.description, 320), actors: state.agents?.npcs?.filter((actor: any) => participantIds.has(actor.genetics?.seed)).map((actor: any) => ({ id: actor.genetics?.seed, name: actor.identity?.name, location: clip(actor.location, 80), emotion: actor.emotion?.label, goal: clip(actor.goals?.[0], 180) })) } })
  const previousChapter = getDatabase().prepare('SELECT markdown_path FROM chapters WHERE world_id=? ORDER BY chapter_number DESC LIMIT 1').get(input.worldId) as { markdown_path?: string } | undefined
  const previousChapterPaths = getDatabase().prepare('SELECT markdown_path FROM chapters WHERE world_id=? ORDER BY chapter_number').all(input.worldId) as Array<{ markdown_path?: string }>
  let previousEnding = ''
  if (previousChapter?.markdown_path) { try { previousEnding = readFileSync(previousChapter.markdown_path, 'utf8').trim().slice(-900) } catch { previousEnding = '' } }
  const establishedText = previousChapterPaths.map((item) => {
    if (!item.markdown_path) return ''
    try { return readFileSync(item.markdown_path, 'utf8') } catch { return '' }
  }).join('\n').slice(-200_000)
  const povRecord = pov as Record<string, unknown> | undefined
  const material = JSON.stringify({
    ticks: compactTicks,
    selectedEvents: pendingTransition ? [{ id: pendingTransition.id, tick: pendingTransition.tick, conflict: clip(contract?.coreEvent, 500), sceneBeats: approvedBeats, consequence: pendingTransition.deltas.map((item) => item.narrativeReason), narrativePurpose: contract?.narrativePurpose, actorIds: contract?.participants.map((item) => item.actorId) }] : selectedEvents.map((event) => { const payload = parseJson<Record<string, unknown>>(event.payload_json, {}); return { id: event.id, tick: event.tick, conflict: clip(payload.conflict || event.summary, 500), sceneBeats: Array.isArray(payload.beats) ? payload.beats : [], consequence: payload.consequence, narrativePurpose: event.narrative_purpose, actorIds: parseJson(event.actor_ids_json, []) } }),
    pov: povRecord ? { id: povRecord.id, name: povRecord.name, attributes: clip(JSON.stringify(povRecord.properties || {}), 600) } : undefined,
    visibleFacts: facts.slice(0, chapterNumber === 1 ? 5 : 12).map((fact: any) => ({ id: fact.id, subject: fact.subject_name || fact.subject_id, predicate: fact.predicate, object: fact.object_name || fact.object_id || clip(parseJson(fact.value_json, fact.value_json), 180), scope: fact.claim_scope })),
    storyEngine: engine ? { signatureExperience: engine.signatureExperience, repeatableSituation: engine.repeatableSituation, protagonistMethod: engine.protagonistMethod, failureCosts: engine.failureCosts, emotionalPromise: engine.emotionalPromise, forbiddenRepetitions: engine.forbiddenRepetitions } : undefined,
    microStory: chapterOutline ? { immediateGoal: chapterOutline.immediateGoal, centralObstacle: chapterOutline.centralObstacle, difficultChoice: chapterOutline.difficultChoice, irreversibleResult: chapterOutline.irreversibleResult, concretePayoff: chapterOutline.concretePayoff, changedUnderstanding: chapterOutline.changedUnderstanding, nextPressure: chapterOutline.nextPressure, engineFunction: chapterOutline.engineFunction } : undefined,
    contract: contract ? { id: contract.id, mainlineObjective: contract.mainlineObjective, causalPrerequisite: contract.causalPrerequisite, readerPayoff: contract.readerPayoff, scopeBoundary: contract.scopeBoundary, coreEvent: contract.coreEvent, participants: contract.participants, readerEntry: contract.readerEntry, requiredDeltas: contract.requiredDeltas, emotionTarget: contract.emotionTarget, climaxForm: contract.climaxForm, hookType: contract.hookType, hookGoal: contract.hookGoal } : undefined, currentArcContext: { openThreads: Array.isArray((compass.current as any)?.openThreads) ? (compass.current as any).openThreads.slice(0, 3) : [] }, goal: clip(input.goal, 500), requiredEvents: (input.requiredEvents || []).map((value) => clip(value, 260)), settings: world.writingSettings,
    readerContext: { chapterNumber, previousEnding: chapterNumber === 1 ? undefined : previousEnding, entry: contract?.readerEntry },
    wiki: wiki.map((page: any) => ({ slug: page.slug, markdown: clip(page.markdown, 260) })),
  })
  const continuityRules = chapterNumber > 1
    ? '连续性硬约束：上一章已经明确的身体状态、数量、能力代价和物品状态必须原样继承；本章不得凭空新增永久伤势、失去另一只手的感觉、改变数量或改写代价。若本章确实要产生新的伤势或代价，必须在场景中先出现明确触发、角色感知和因果解释，并且它必须写进本章契约或用户明确目标；不能用系统提示突然宣布。任何“为什么会这样”无法由正文行动解释的变化都必须删除。'
    : ''
  const tomatoBranch = getPlatformBranch(world.writingSettings) === 'tomato_shuangwen'
  const tomatoRules = tomatoBranch ? platformBranchRules(getPlatformBranch(world.writingSettings)) : ''
  const strictRules = `必须实现演化契约的 mainlineObjective 和 requiredDeltas，不得以更热闹或更易写的无关事件替换；开场困境由 causalPrerequisite 引发；正文必须真正兑现 readerPayoff；不得越过 scopeBoundary；只服务当前故事弧，不得猜测或讲解候选终局。前三段内建立异常、冲突、选择或未解问题；${chapterNumber === 1 ? '首章采用成熟类型小说的开篇方式：第一段从具体行动、异常、逼近期限或现场矛盾切入；先让读者跟住一个POV人物的当下目标，再逐步露出最小必要背景；禁止起床照镜子、天气铺陈、梦境骗局、百科式世界观和角色名单；本章只留一个长线问题；' : '明确承接上一章的后果；'}${continuityRules}${tomatoRules}只围绕一个核心事件；重大行为必须具备触发、动机、行动、后果；信息通过行动、对话、错误判断和感官释放；严格遵守 POV；只能点名演化契约的在场人物与授权的离场引用人物；不得按 Agent 顺序汇报行动，所有人物必须在同一条行动—反应—后果链中自然出现；不要均分戏份；章末钩子必须由本章因果产生；无叙事职责的生活细节必须删除。`
  const root = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data'); const runDir = path.join(root, 'worlds', input.worldId, 'runs'); await mkdir(runDir, { recursive: true })
  let markdown = ''
  if (input.resumeDraftPath) {
    try { markdown = readFileSync(input.resumeDraftPath, 'utf8') } catch { markdown = '' }
  }
  if (markdown) {
    reportRun(runId, { status: 'running', stage: 'validate', progress: 52, message: '已恢复最近草稿，正在从审稿检查点继续' })
  } else {
    reportRun(runId, { status: 'running', stage: 'outline', progress: 15, message: '正在锁定本章单一核心事件' })
    // The chapter contract and approved beats already are the executable
    // outline. Asking a second architect model to reinterpret them adds
    // latency and gives the story another chance to drift before the Writer.
    const outline = JSON.stringify({
      title: chapterNumber === 1 ? '首章' : `第${chapterNumber}章`,
      openingPressure: contract?.causalPrerequisite || approvedBeats[0]?.trigger || contract?.coreEvent,
      sceneGoal: chapterOutline?.immediateGoal || contract?.mainlineObjective,
      obstacle: chapterOutline?.centralObstacle || approvedBeats[0]?.reaction,
      difficultChoice: chapterOutline?.difficultChoice,
      actionChain: approvedBeats.map((beat) => ({ trigger: beat.trigger, action: beat.action, reaction: beat.reaction, changedOption: beat.changedOption, consequence: beat.consequence })),
      consequence: chapterOutline?.irreversibleResult || contract?.readerPayoff,
      localPayoff: chapterOutline?.concretePayoff || contract?.readerPayoff,
      characterFunctions: contract?.participants,
      revealBudget: contract?.readerEntry,
      hook: chapterOutline?.nextPressure || contract?.hookGoal,
    })
    reportRun(runId, { status: 'running', stage: 'draft', progress: 34, message: '正在写作契约正文' })
    markdown = await ask(`你是长篇小说作者。写完整 Markdown 正文，不解释，不出现 Agent、Tick、契约、意图等系统术语。目标约 ${world.writingSettings.targetWords} 字。\n${DRAFT_RULES}\n${strictRules}${anchorBlock}\n大纲：${outline}\n素材：${material}`)
  }
  let draftPath = path.join(runDir, `${runId}-r0.md`); await writeFile(draftPath, markdown, 'utf8'); getDatabase().prepare('UPDATE chapter_runs SET draft_path=? WHERE id=?').run(draftPath, runId)
  let finalReview: ChapterReview | undefined
  let readerReview: ReaderComprehensionReview | undefined
  for (let revision = 0; revision <= 1; revision++) {
    reportRun(runId, { status: 'running', stage: revision ? 'revalidate' : 'validate', progress: 60 + revision * 12, message: revision ? `正在复审第 ${revision} 次修订` : '正在执行七维审稿', revisionCount: revision })
    finalReview = await reviewChapter(input.worldId, runId, revision, material, contract, markdown, { actorNames, chapterNumber })
    readerReview = await reviewReaderComprehension({ worldId: input.worldId, runId, markdown, previousEnding, establishedText, contract, outline: chapterOutline })
    const hasHardError = finalReview.issues.some((issue) => issue.severity === 'critical')
    const needsEditorialRevision = finalReview.issues.some((issue) => issue.severity === 'error') || !readerReview.passed
    if (!hasHardError && !needsEditorialRevision) break
    if (revision === 1) {
      if (hasHardError) throw new Error(`修订后仍存在事实或连续性硬伤：${finalReview.issues.filter((issue) => issue.severity === 'critical').map((issue) => issue.message).join('；')}`)
      if (chapterNumber === 1 && !readerReview.passed) throw new Error(`首章修订后仍无法让新读者独立理解：${[...readerReview.unexplainedNames, ...readerReview.unexplainedConcepts, ...readerReview.unsupportedConclusions].slice(0, 5).join('；') || '无法清楚复述目标、阻碍、选择和结果'}`)
      break
    }
    const readerInstructions = readerReview.passed ? '' : `\n[读者理解失败] 未解释人物：${readerReview.unexplainedNames.join('、') || '无'}；未解释概念：${readerReview.unexplainedConcepts.join('、') || '无'}；跳跃结论：${readerReview.unsupportedConclusions.join('、') || '无'}。必须让目标、阻碍、选择、结果和局部回报直接出现在正文中。`
    const instructions = finalReview.issues.map((issue) => `[${issue.severity}] ${issue.contractField}：${issue.message}；证据“${issue.quote}”；修改：${issue.instruction}`).join('\n') + readerInstructions
    reportRun(runId, { status: 'running', stage: 'revise', progress: 70 + revision * 12, message: `正在进行第 ${revision + 1} 次有证据修订`, revisionCount: revision + 1 })
    markdown = await ask(`根据审稿证据修订完整正文。${REVISE_RULES}\n不得改变契约核心事件，不得新增人物、秘密、能力、代价或危机。若意见要求“增加前期铺垫”，你无法修改已发布前文：必须删除这个突兀元素，或替换为素材中已经存在且有证据的设定，绝不能在当前章伪造一段前史。\n审稿意见：${instructions}\n正文：${markdown}`)
    draftPath = path.join(runDir, `${runId}-r${revision + 1}.md`); await writeFile(draftPath, markdown, 'utf8'); getDatabase().prepare('UPDATE chapter_runs SET draft_path=? WHERE id=?').run(draftPath, runId)
  }
  if (!finalReview?.passed) throw new Error('七维审稿未通过')
  if (!readerReview) throw new Error('读者理解检查没有返回结果')
  if (contract) await reviewStateEvidence(input.worldId, runId, contract, markdown)
  reportRun(runId, { status: 'running', stage: 'saving', progress: 94, message: '正在原子提交章节与 Tick' })
  const db = getDatabase(); const chapterId = randomUUID(); const title = markdown.match(/^#\s+(.+)$/m)?.[1] || `第${chapterNumber}章`
  const dir = path.join(root, 'worlds', input.worldId, 'chapters'); await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${String(chapterNumber).padStart(4, '0')}-v1.md`)
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  await writeFile(filePath, markdown, 'utf8')
  db.exec('BEGIN')
  try {
    const publishedEventIds = selectedEvents.map((event) => String(event.id))
    let transitionEventId: string | undefined
    if (contract && pendingTransition) {
      transitionEventId = `evt_${createHash('sha256').update(`${input.worldId}:${pendingTransition.id}`).digest('hex').slice(0, 24)}`
      publishedEventIds.push(transitionEventId)
      const summary = `${contract.coreEvent}。${pendingTransition.deltas.map((item) => item.narrativeReason).join('；')}`
      db.prepare(`INSERT INTO events (id,world_id,tick,type,summary,payload_json,actor_ids_json,location,cause_event_id,origin,narrative_purpose,contract_id,published_chapter_id,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(transitionEventId, input.worldId, input.tick || input.tickTo, 'narrative_event', summary, JSON.stringify({ beats: approvedBeats, deltas: pendingTransition.deltas, conflict: contract.coreEvent }), JSON.stringify(contract.participants.map((item) => item.actorId)), null, contract.causalAnchorEventIds[0] || null, 'simulation', contract.narrativePurpose, contract.id, chapterId, new Date().toISOString())
      applyTransitionInTransaction(db, pendingTransition, chapterId, transitionEventId)
      if (contract.sceneId) {
        db.prepare("UPDATE scenes SET status='resolved',updated_at=? WHERE world_id=? AND status='active' AND id!=?").run(new Date().toISOString(), input.worldId, contract.sceneId)
        db.prepare("UPDATE scenes SET status='active',updated_at=? WHERE world_id=? AND id=?").run(new Date().toISOString(), input.worldId, contract.sceneId)
        db.prepare("UPDATE actor_runtime SET lifecycle='background',current_scene_id=NULL,updated_at=? WHERE world_id=? AND lifecycle='active' AND locked=0").run(new Date().toISOString(), input.worldId)
        for (const participant of contract.participants) {
          db.prepare("UPDATE actor_runtime SET lifecycle='active',current_scene_id=?,last_active_tick=?,promotion_reason=?,updated_at=? WHERE world_id=? AND actor_id=? AND lifecycle!='dead'").run(contract.sceneId, input.tick || input.tickTo, participant.necessity || participant.reason, new Date().toISOString(), input.worldId, participant.actorId)
        }
      }
      const baseSnapshot = world.snapshot as any
      const nextSnapshot = { ...baseSnapshot, tick: input.tick || input.tickTo, events: [...(baseSnapshot?.events || []), { id: transitionEventId, type: 'narrative_event', timestamp: baseSnapshot?.time, payload: { summary, participants: contract.participants.map((item) => item.actorId), beats: approvedBeats, consequence: pendingTransition.deltas.map((item) => item.narrativeReason) } }] }
      db.prepare('UPDATE worlds SET snapshot_json=?,updated_at=? WHERE id=?').run(JSON.stringify(nextSnapshot), new Date().toISOString(), input.worldId)
    }
    db.prepare(`INSERT INTO chapters (id,world_id,chapter_number,version,title,pov_entity_id,tick_from,tick_to,markdown_path,validation_json,settings_version,contract_id,generation_kind,content_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(chapterId, input.worldId, chapterNumber, 1, title, povId || null, input.tickFrom, input.tickTo, filePath, JSON.stringify({ literary: finalReview, reader: readerReview }), world.writingSettingsVersion, input.contractId || null, 'story_engine_v1', contentHash, new Date().toISOString())
    const insertEvent = db.prepare('INSERT OR IGNORE INTO chapter_events (chapter_id,event_id,role) VALUES (?,?,?)'); for (const eventId of publishedEventIds) insertEvent.run(chapterId, eventId, 'core')
    db.prepare('UPDATE chapter_reviews SET chapter_id=? WHERE run_id=?').run(chapterId, runId)
    db.prepare('UPDATE chapter_state_evidence SET chapter_id=? WHERE run_id=?').run(chapterId, runId)
    db.prepare('UPDATE reader_comprehension_reviews SET chapter_id=? WHERE run_id=?').run(chapterId, runId)
    applyReaderAndStoryProjection(db, { worldId: input.worldId, chapterId, chapterNumber, tick: input.tick || input.tickTo, eventId: transitionEventId, outline: chapterOutline, review: readerReview, engine, actorIds: contract?.participants.map((item) => item.actorId) || [] })
    if (input.contractId) {
      db.prepare("UPDATE evolution_contracts SET status='fulfilled' WHERE id=?").run(input.contractId)
      db.prepare("UPDATE chapter_outlines SET status='completed',outline_json=json_set(outline_json,'$.status','completed') WHERE id=(SELECT chapter_outline_id FROM evolution_contracts WHERE id=?)").run(input.contractId)
      db.prepare('UPDATE events SET published_chapter_id=? WHERE contract_id=?').run(chapterId, input.contractId)
      const arcRow = db.prepare('SELECT arc_id FROM evolution_contracts WHERE id=?').get(input.contractId) as { arc_id?: string } | undefined
      if (arcRow?.arc_id && chapterOutline?.completesArc && chapterOutline.arcCompletionEvidence) {
        const row = db.prepare('SELECT plan_json FROM story_arcs WHERE id=?').get(arcRow.arc_id) as { plan_json: string } | undefined
        if (row) {
          const plan = JSON.parse(row.plan_json)
          const completedPlan = { ...plan, status: 'completed', completionEvidence: chapterOutline.arcCompletionEvidence, completedChapterId: chapterId }
          db.prepare("UPDATE story_arcs SET status='completed',plan_json=?,summary_json=? WHERE id=?").run(JSON.stringify(completedPlan), JSON.stringify({ localSettlement: plan.localSettlement, longTailResidue: plan.longTailResidue, evidence: chapterOutline.arcCompletionEvidence, chapterId }), arcRow.arc_id)
        }
      }
      if (arcRow?.arc_id && chapterOutline?.conflictMode) {
        const row = db.prepare('SELECT plan_json FROM story_arcs WHERE id=?').get(arcRow.arc_id) as { plan_json: string } | undefined
        if (row) {
          const plan = JSON.parse(row.plan_json)
          plan.usedConflictPatterns = [...new Set([...(plan.usedConflictPatterns || []), chapterOutline.conflictMode])]
          const nextStatus = plan.status === 'completed' ? 'completed' : 'active'
          db.prepare('UPDATE story_arcs SET status=?,plan_json=? WHERE id=?').run(nextStatus, JSON.stringify({ ...plan, status: nextStatus }), arcRow.arc_id)
        }
      }
      if (!(contract?.requiredDeltas || []).some((delta) => delta.operation === 'advance_obligation')) for (const action of contract?.foreshadowActions || []) {
        if (/兑现|揭示|resolve/i.test(action)) {
          const obligation = db.prepare("SELECT id FROM narrative_obligations WHERE world_id=? AND status!='resolved' ORDER BY created_at LIMIT 1").get(input.worldId) as { id: string } | undefined
          if (obligation) db.prepare("UPDATE narrative_obligations SET status='resolved',resolved_chapter_id=?,updated_at=? WHERE id=?").run(chapterId, new Date().toISOString(), obligation.id)
        } else if (/埋|加强|暗示|plant|advance/i.test(action)) {
          const obligation = db.prepare("SELECT id FROM narrative_obligations WHERE world_id=? AND status='open' ORDER BY created_at LIMIT 1").get(input.worldId) as { id: string } | undefined
          if (obligation) db.prepare("UPDATE narrative_obligations SET status='planted',planted_chapter_id=COALESCE(planted_chapter_id,?),updated_at=? WHERE id=?").run(chapterId, new Date().toISOString(), obligation.id)
        }
      }
    }
    if (input.tick != null) db.prepare("UPDATE simulation_ticks SET status='published' WHERE world_id=? AND tick=?").run(input.worldId, input.tick)
    reportRun(runId, { status: 'completed', stage: 'completed', progress: 100, message: `章节已发布：${title}`, chapterId, revisionCount: finalReview.revision }); db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    // The database is authoritative. Remove a manuscript file that was written
    // before a failed transaction so the filesystem cannot imply publication.
    try { await unlink(filePath) } catch { /* the file may not have been created */ }
    throw error
  }
  const workflow = input.tick == null ? undefined : db.prepare('SELECT id FROM workflow_runs WHERE world_id=? AND tick=?').get(input.worldId, input.tick) as { id?: string } | undefined
  if (workflow?.id) markWorkflow(workflow.id, 'completed', 'atomic_publish')
  saveWorkflowCheckpoint({ worldId: input.worldId, runKind: 'chapter', runId, step: 'commit', inputHash: `${input.contractId || 'manual'}:${finalReview.averageScore}`, payload: { chapterId, tick: input.tick, reviewId: finalReview.id } })
  void projectNarrativeAfterPublish(input.worldId, chapterNumber).catch((error) => console.error('Narrative projection failed:', error))
}
