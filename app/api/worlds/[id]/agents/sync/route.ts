import { NextResponse } from 'next/server'
import { getWorld } from '@/server/novel-repository'
import { syncActionableAgents } from '@/server/extraction-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const world = getWorld(params.id)
    if (!world) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
    if (!world.snapshot) return NextResponse.json({ error: '世界快照不存在' }, { status: 409 })
    if (world.archiveStatus !== 'ready') {
      return NextResponse.json({ error: '资料尚未编译完成，暂时无法建立行动者' }, { status: 409 })
    }
    return NextResponse.json(syncActionableAgents(params.id))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
