import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { getLatestOpeningDraftRun } from '@/server/opening-workshop-service'
import { getWorld } from '@/server/novel-repository'

export const runtime = 'nodejs'

/** Accept the isolated opening draft as chapter one before the normal chapter worker starts. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDatabase()
    const world = getWorld(params.id)
    if (!world) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
    const existing = db.prepare('SELECT id FROM chapters WHERE world_id=? LIMIT 1').get(params.id)
    if (existing) return NextResponse.json({ error: '首章已经发布' }, { status: 409 })
    const run = getLatestOpeningDraftRun(params.id)
    if (!run || run.status !== 'completed' || !run.markdown) return NextResponse.json({ error: '没有可接受的首章草稿' }, { status: 400 })
    const review = run.review || {}
    const povName = String(review.pov || '')
    const actor = (world.snapshot as any)?.agents?.npcs?.find((item: any) => item.identity?.name === povName)
    const now = new Date().toISOString()
    const chapterId = randomUUID()
    const root = process.env.SEEDWORLD_DATA_DIR || `${process.cwd()}/data`
    const markdownPath = `${root}/worlds/${params.id}/opening-workshop/${run.id}.md`
    const hash = createHash('sha256').update(run.markdown).digest('hex')
    db.prepare(`INSERT INTO chapters (id,world_id,chapter_number,version,title,pov_entity_id,tick_from,tick_to,markdown_path,validation_json,settings_version,generation_kind,content_hash,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      chapterId, params.id, 1, 1, '第一章', actor?.genetics?.seed || null, 0, 0, markdownPath,
      JSON.stringify({ openingWorkshop: review }), world.writingSettingsVersion, 'opening_workshop', hash, now,
    )
    return NextResponse.json({ chapter: { id: chapterId, chapterNumber: 1, title: '第一章', markdown: run.markdown }, acceptedRunId: run.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
