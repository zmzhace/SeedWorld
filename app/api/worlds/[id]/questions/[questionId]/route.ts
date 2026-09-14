import { NextResponse } from 'next/server'
import { getReaderQuestion } from '@/server/reader-story-service'
export async function GET(_: Request, { params }: { params: { id: string; questionId: string } }) {
  const question = getReaderQuestion(params.id, params.questionId)
  return question ? NextResponse.json({ question }) : NextResponse.json({ error: '问题不存在' }, { status: 404 })
}
