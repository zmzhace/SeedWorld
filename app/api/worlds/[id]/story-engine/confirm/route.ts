import { NextRequest, NextResponse } from 'next/server'
import { confirmStoryEngine, ensureStoryEngineDraft } from '@/server/story-engine-service'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try { await ensureStoryEngineDraft(params.id); return NextResponse.json({ engine: confirmStoryEngine(params.id) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
