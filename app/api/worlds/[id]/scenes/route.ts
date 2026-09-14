import { NextResponse } from 'next/server'
import { listScenes, saveScene } from '@/server/novel-repository'
import { getDatabase } from '@/server/database'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url)
  const scenes = listScenes(params.id, { status: (url.searchParams.get('status') as any) || undefined })
  const workflowSceneIds = new Set((getDatabase().prepare("SELECT scene_id FROM evolution_contracts WHERE world_id=? AND scene_id IS NOT NULL AND status!='fulfilled'").all(params.id) as Array<{ scene_id: string }>).map((row) => row.scene_id))
  return NextResponse.json({ scenes: scenes.map((scene) => ({ ...scene, workflowOwned: workflowSceneIds.has(scene.id) })) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    if (!body.objective || !body.conflict) return NextResponse.json({ error: 'objective and conflict are required' }, { status: 400 })
    const scene = saveScene({ id: body.id, worldId: params.id, tick: Number(body.tick || 0), status: body.status || 'proposed', timeLabel: String(body.timeLabel || ''), locationEntityId: body.locationEntityId || undefined, objective: String(body.objective), conflict: String(body.conflict), entryCause: body.entryCause || undefined, exitCondition: body.exitCondition || undefined, anchorEventIds: Array.isArray(body.anchorEventIds) ? body.anchorEventIds.map(String) : [] })
    return NextResponse.json({ scene })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
