import { NextResponse } from 'next/server'
import { handleChatTurn } from '@/server/chat'

export async function POST(request: Request) {
  const body = await request.json()
  const result = await handleChatTurn({ message: String(body?.message ?? '') })
  return NextResponse.json(result)
}
