import { NextResponse } from 'next/server'
import { reopenFinale } from '@/server/narrative-control-service'

export const runtime = 'nodejs'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json(reopenFinale(params.id)) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }) }
}
