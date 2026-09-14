import { NextResponse } from 'next/server'
import { readOutline } from '@/server/narrative-planning-service'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ outline: readOutline(params.id) }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }) }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { chapterId?: string; patch?: Record<string, unknown> }
    if (!body.chapterId || !body.patch) return NextResponse.json({ error: '缺少 chapterId 或 patch' }, { status: 400 })
    const db = getDatabase()
    const row = db.prepare('SELECT outline_json FROM chapter_outlines WHERE world_id=? AND id=?').get(params.id, body.chapterId) as { outline_json: string } | undefined
    if (!row) return NextResponse.json({ error: '章节目标不存在' }, { status: 404 })
    const next = { ...JSON.parse(row.outline_json), ...body.patch, id: body.chapterId, worldId: params.id }
    db.prepare('UPDATE chapter_outlines SET outline_json=? WHERE id=?').run(JSON.stringify(next), body.chapterId)
    return NextResponse.json({ outline: readOutline(params.id) })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
