import { NextResponse } from 'next/server'
import { getChapterReviews } from '@/server/chapter-service'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string; chapterId: string } }) {
  return NextResponse.json({ reviews: getChapterReviews(params.id, params.chapterId) })
}
