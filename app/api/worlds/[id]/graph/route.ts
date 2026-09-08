import { NextResponse } from 'next/server'
import { listGraph } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: { id: string } }) { const url = new URL(request.url); return NextResponse.json(listGraph(params.id, { layer: url.searchParams.get('layer') || undefined, type: url.searchParams.get('type') || undefined, limit: Number(url.searchParams.get('limit') || 100), offset: Number(url.searchParams.get('offset') || 0) })) }
