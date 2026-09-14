import { NextRequest, NextResponse } from 'next/server'
import { regenerateStoryEngineDraft } from '@/server/story-engine-service'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ engine: await regenerateStoryEngineDraft(params.id) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
