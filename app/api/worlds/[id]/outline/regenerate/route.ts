import { NextResponse } from 'next/server'
import { regenerateUnpublishedOutline } from '@/server/narrative-planning-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ outline: await regenerateUnpublishedOutline(params.id) }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }) }
}
