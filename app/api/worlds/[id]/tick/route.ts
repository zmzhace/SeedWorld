import { NextResponse } from 'next/server'
import { runWorldTick } from '@/engine/orchestrator'
import { getDirectorRegistry } from '@/server/director-registry'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { world } = body

    if (!world) {
      return NextResponse.json(
        { error: 'world is required' },
        { status: 400 }
      )
    }

    const nextWorld = await runWorldTick(world, {
      directorRegistry: getDirectorRegistry(),
    })

    return NextResponse.json({ world: nextWorld })
  } catch (error) {
    console.error('Failed to run world tick:', error)
    return NextResponse.json(
      { error: 'Failed to run world tick: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
