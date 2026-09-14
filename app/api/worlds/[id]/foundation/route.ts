import { NextResponse } from 'next/server'
import { ensureFoundationDraft, saveFoundation } from '@/server/narrative-planning-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ foundation: await ensureFoundationDraft(params.id) }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }) }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    return NextResponse.json({ foundation: saveFoundation(params.id, body) })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
