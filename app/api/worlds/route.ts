import { NextResponse } from 'next/server'
import { createWorld, listWorlds } from '@/server/novel-repository'
import { updateWorld } from '@/server/novel-repository'
import { createInitialWorldSlice } from '@/domain/world'

export const runtime = 'nodejs'

export async function GET() { return NextResponse.json({ worlds: listWorlds() }) }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const world = createWorld({ id: body.id, prompt: String(body.worldPrompt || body.prompt || ''), title: body.title, writingSettings: body.writingSettings })
    const snapshot = createInitialWorldSlice(); snapshot.world_id = world.id; snapshot.title = body.title || undefined; snapshot.summary = String(body.worldPrompt || body.prompt || '').slice(0, 160); snapshot.environment.description = String(body.worldPrompt || body.prompt || '')
    return NextResponse.json(updateWorld(world.id, { snapshot, title: snapshot.title, summary: snapshot.summary }), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message.includes('UNIQUE') ? 409 : 400 })
  }
}
