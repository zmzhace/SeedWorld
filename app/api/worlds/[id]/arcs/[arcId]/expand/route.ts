import { NextResponse } from 'next/server'
import { expandArc } from '@/server/narrative-planning-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string; arcId: string } }) {
  try { return NextResponse.json({ outline: await expandArc(params.id, params.arcId) }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
