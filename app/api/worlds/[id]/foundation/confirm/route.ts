import { NextResponse } from 'next/server'
import { confirmFoundation, readOutline } from '@/server/narrative-planning-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const foundation = confirmFoundation(params.id)
    const outline = readOutline(params.id)
    return NextResponse.json({ foundation, outline })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
