import { NextResponse } from 'next/server'
import { getNarrativeHorizon } from '@/server/narrative-control-service'

export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ horizon: getNarrativeHorizon(params.id) }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }) }
}
