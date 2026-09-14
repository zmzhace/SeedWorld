import { NextResponse } from 'next/server'
import { listScenes, saveScene } from '@/server/novel-repository'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const scene = listScenes(params.id, { limit: 100 }).find((item) => item.id === params.sceneId)
  if (!scene) return NextResponse.json({ error: '场景不存在' }, { status: 404 })
  const db = getDatabase()
  if (db.prepare("SELECT 1 FROM evolution_contracts WHERE world_id=? AND scene_id=? AND status!='fulfilled' LIMIT 1").get(params.id, params.sceneId)) {
    return NextResponse.json({ error: '该场景属于未发布章节，只能在正文和状态差原子发布时激活' }, { status: 409 })
  }
  if (db.prepare("SELECT 1 FROM simulation_ticks WHERE world_id=? AND status IN ('planning','simulating','awaiting_chapter','reviewing') LIMIT 1").get(params.id)) {
    return NextResponse.json({ error: '当前章节正在运行，不能在发布前改变正式主场景' }, { status: 409 })
  }
  const active = listScenes(params.id, { status: 'active', limit: 100 })
  for (const current of active) saveScene({ ...current, status: 'resolved' })
  return NextResponse.json({ scene: saveScene({ ...scene, status: 'active' }) })
}
