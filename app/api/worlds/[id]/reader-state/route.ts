import { NextResponse } from 'next/server'
import { getReaderState } from '@/server/reader-story-service'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json(getReaderState(params.id)) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) }
}
