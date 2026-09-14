import { NextResponse } from 'next/server'
import { listFutureTrajectories } from '@/server/narrative-control-service'

export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ trajectories: listFutureTrajectories(params.id) })
}
