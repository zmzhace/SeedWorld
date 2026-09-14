import { NextResponse } from 'next/server'
import { listArchive } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url)
  return NextResponse.json(listArchive(params.id, { type: url.searchParams.get('type') || undefined, origin: url.searchParams.get('origin') || undefined, limit: Number(url.searchParams.get('limit') || 100), offset: Number(url.searchParams.get('offset') || 0) }))
}
