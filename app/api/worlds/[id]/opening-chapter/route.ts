import { NextResponse } from 'next/server'
import { getDatabase } from '@/server/database'
import { getLatestOpeningDraftRun, startOpeningDraftRun } from '@/server/opening-workshop-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const chapterCount = Number((getDatabase().prepare('SELECT COUNT(*) AS value FROM chapters WHERE world_id=?').get(params.id) as { value: number } | undefined)?.value || 0)
  return NextResponse.json({ chapterCount, mode: chapterCount ? 'rewrite' : 'initial', run: getLatestOpeningDraftRun(params.id) })
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const chapterCount = Number((getDatabase().prepare('SELECT COUNT(*) AS value FROM chapters WHERE world_id=?').get(params.id) as { value: number } | undefined)?.value || 0)
    // The opening is a reader-entry draft, not tick zero of the simulation.
    // Keep it isolated until the author accepts the chapter; only subsequent
    // chapters enter the normal one-tick/one-chapter workflow.
    if (!chapterCount) return NextResponse.json({ mode: 'initial', run: startOpeningDraftRun(params.id) }, { status: 202 })
    return NextResponse.json({ mode: 'rewrite', run: startOpeningDraftRun(params.id) }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
