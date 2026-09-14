import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getWorld, updateWorld } from '@/server/novel-repository'
import { createPersonalAgent } from '@/domain/agents'
import { syncActionableAgents } from '@/server/extraction-service'

export const runtime = 'nodejs'

/**
 * Explicit author-created character cards remain supported. The old default
 * branch generated an arbitrary cast of ten and could detach the story from
 * its source material; it now performs the same idempotent archive sync used
 * by the automatic setup stage.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const world = getWorld(params.id)
    if (!world) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
    if (!world.snapshot) return NextResponse.json({ error: '世界快照不存在' }, { status: 400 })
    const body = await request.json().catch(() => ({}))

    // Manual character card: built by the author for plot needs.
    if (body.manual && typeof body.manual === 'object') {
      const manual = body.manual as Record<string, unknown>
      const name = String(manual.name || '').trim()
      if (!name) return NextResponse.json({ error: '角色名不能为空' }, { status: 400 })
      const snapshot: any = world.snapshot
      const seeds = new Set((snapshot.agents?.npcs || []).map((a: any) => a.genetics?.seed))
      let seed = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'agent'
      if (seeds.has(seed)) seed = `${seed}-${randomUUID().slice(0, 6)}`
      const agent = createPersonalAgent(seed)
      agent.identity.name = name
      if (typeof manual.occupation === 'string' && manual.occupation.trim()) agent.occupation = manual.occupation.trim()
      if (typeof manual.core_belief === 'string' && manual.core_belief.trim()) agent.core_belief = manual.core_belief.trim()
      if (typeof manual.location === 'string' && manual.location.trim()) agent.location = manual.location.trim()
      if (typeof manual.goals === 'string') {
        agent.goals = manual.goals.split(/\n+/).map((g: string) => g.trim()).filter(Boolean).slice(0, 5)
      }
      snapshot.agents.npcs.push(agent)
      updateWorld(params.id, { snapshot })
      return NextResponse.json({ agents: [agent], total: snapshot.agents.npcs.length }, { status: 201 })
    }

    return NextResponse.json(syncActionableAgents(params.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const world = getWorld(params.id)
    if (!world) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
    if (!world.snapshot) return NextResponse.json({ error: '世界快照不存在' }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const seed = String(body.seed || '').trim()
    if (!seed) return NextResponse.json({ error: 'seed 不能为空' }, { status: 400 })
    const snapshot: any = world.snapshot
    const before = (snapshot.agents?.npcs || []).length
    snapshot.agents.npcs = (snapshot.agents?.npcs || []).filter((a: any) => a.genetics?.seed !== seed)
    if (snapshot.agents.npcs.length === before) return NextResponse.json({ error: '角色不存在' }, { status: 404 })
    updateWorld(params.id, { snapshot })
    return NextResponse.json({ removed: seed, total: snapshot.agents.npcs.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
