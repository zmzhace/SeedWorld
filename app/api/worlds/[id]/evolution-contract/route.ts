import { NextResponse } from 'next/server'
import { getLatestEvolutionContract } from '@/server/narrative-planning-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ contract: getLatestEvolutionContract(params.id) })
}
