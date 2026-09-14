import { NextResponse } from 'next/server'
import { getClosureReadiness } from '@/server/narrative-control-service'

export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ readiness: getClosureReadiness(params.id) })
}
