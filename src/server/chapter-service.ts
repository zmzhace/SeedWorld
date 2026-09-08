import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDatabase } from './database'
import { getWorld, listGraph, updateWorld } from './novel-repository'
import { ensureCompass } from './compass-service'
import { chatText } from './llm/openai-compat'
import { DRAFT_RULES, OUTLINE_RULES, REVISE_RULES, VALIDATE_RULES } from './llm/rules'

type ChapterRequest = { worldId: string; tickFrom: number; tickTo: number; povEntityId?: string; goal?: string; requiredEvents?: string[] }

async function ask(prompt: string, maxTokens = 8192) {
  return chatText([{ role: 'user', content: prompt }], { maxTokens })
}

export async function generateChapter(input: ChapterRequest) {
  const world = getWorld(input.worldId); if (!world) throw new Error('世界不存在')
  if (world.graphSyncStatus !== 'ready' || !world.visibilityConfirmed) throw new Error('图谱未就绪或信息可见性尚未确认')
  const ticks = getDatabase().prepare('SELECT tick,payload_json FROM simulation_ticks WHERE world_id=? AND tick BETWEEN ? AND ? ORDER BY tick').all(input.worldId, input.tickFrom, input.tickTo) as Array<{ tick: number; payload_json: string }>
  const graph = listGraph(input.worldId, { limit: 200 })
  const pov = input.povEntityId ? graph.entities.find((entity: any) => entity.id === input.povEntityId) : undefined
  const facts = graph.facts.filter((fact: any) => fact.claim_scope === 'objective' || fact.claim_scope === 'public_narrative' || fact.believer_id === input.povEntityId)

  // Compass: chapters read `current` only; `long` stays a one-line horizon.
  const compass = await ensureCompass(input.worldId, JSON.stringify(facts.slice(0, 40)))

  // Style anchors are NEVER trimmed (ainovel-cli #91 anchors idea).
  const anchors = (world.writingSettings.styleAnchors || []).slice(0, 3)
  const anchorBlock = anchors.length
    ? `\nSTYLE ANCHORS (protect this voice; never drop or contradict):\n${anchors.map((a, i) => `[anchor ${i + 1}] ${a}`).join('\n')}`
    : ''

  const material = JSON.stringify({
    ticks: ticks.map(item => ({ tick: item.tick, state: JSON.parse(item.payload_json) })),
    pov,
    visibleFacts: facts.slice(0, 120),
    compassCurrent: compass.current,
    compassHorizon: compass.long.direction,
    goal: input.goal,
    requiredEvents: input.requiredEvents || [],
    settings: world.writingSettings,
  })
  const settingsLine = `目标字数约 ${world.writingSettings.targetWords}，语言 ${world.writingSettings.language}，叙事 ${world.writingSettings.narration}，节奏 ${world.writingSettings.pacing}。`

  const outline = await ask(
    `你是小说章节策划师。根据给定素材制定一章的场景大纲。\n${OUTLINE_RULES}\n返回简洁 JSON，包含 title、scenes、revealBudget。${anchorBlock}\n${material}`,
    4096,
  )
  const draft = await ask(
    `你是长篇小说作者。依据章节大纲和可用素材写完整正文。${settingsLine}\n${DRAFT_RULES}${anchorBlock}\n大纲:\n${outline}\n素材:\n${material}`,
  )
  const validationText = await ask(
    `你是小说连续性与平台合规校对。\n${VALIDATE_RULES}\n事实:\n${material}\n正文:\n${draft}`,
    4096,
  )
  const match = validationText.match(/\{[\s\S]*\}/)
  const validation = match
    ? JSON.parse(match[0])
    : { passed: false, issues: [{ severity: 'warning', message: '校验结果无法解析' }], revisionInstructions: validationText }
  const markdown = validation.passed
    ? draft
    : await ask(`根据校对意见修订正文。\n${REVISE_RULES}\n意见:\n${validation.revisionInstructions}\n正文:\n${draft}`)

  const db = getDatabase()
  const count = db.prepare('SELECT COALESCE(MAX(chapter_number),0) AS value FROM chapters WHERE world_id=?').get(input.worldId) as { value: number }
  const chapterNumber = count.value + 1
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] || `第${chapterNumber}章`
  const id = randomUUID()
  const root = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
  const dir = path.join(root, 'worlds', input.worldId, 'chapters')
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${String(chapterNumber).padStart(4, '0')}-v1.md`)
  await writeFile(filePath, markdown, 'utf8')
  db.prepare(`INSERT INTO chapters (id,world_id,chapter_number,version,title,pov_entity_id,tick_from,tick_to,markdown_path,validation_json,settings_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.worldId, chapterNumber, 1, title, input.povEntityId || null, input.tickFrom, input.tickTo, filePath, JSON.stringify(validation), world.writingSettingsVersion, new Date().toISOString())

  // First chapter sets the voice: persist its opening as a style anchor (max 3).
  if (chapterNumber === 1) {
    const opening = markdown.replace(/^#\s+.+$/m, '').trim().slice(0, 600)
    if (opening) {
      const next = [...anchors, opening].slice(-3)
      updateWorld(input.worldId, { writingSettings: { styleAnchors: next } })
    }
  }

  return { id, chapterNumber, version: 1, title, markdown, validation }
}
