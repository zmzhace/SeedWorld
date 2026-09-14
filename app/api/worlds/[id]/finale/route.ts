import { NextResponse } from 'next/server'
import { ensureFinaleContract, getFinaleContract } from '@/server/narrative-control-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ finale: getFinaleContract(params.id) })
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json({ finale: await ensureFinaleContract(params.id) }, { status: 201 }) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }) }
}
