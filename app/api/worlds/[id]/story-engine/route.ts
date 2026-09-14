import { NextRequest, NextResponse } from 'next/server'
import { getStoryEngine, saveStoryEngine } from '@/server/story-engine-service'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ engine: getStoryEngine(params.id) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ engine: saveStoryEngine(params.id, await request.json()) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
