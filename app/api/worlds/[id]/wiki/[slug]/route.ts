import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string; slug: string[] } }) {
  const slug = params.slug.join('/')
  const page = getDatabase().prepare('SELECT * FROM wiki_pages WHERE world_id=? AND slug=?').get(params.id, slug)
  return page ? NextResponse.json(page) : NextResponse.json({ error: 'Wiki 页面不存在' }, { status: 404 })
}
