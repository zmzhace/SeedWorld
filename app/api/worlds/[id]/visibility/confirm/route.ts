import { NextResponse } from 'next/server'
import { updateWorld } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function POST(_: Request, { params }: { params: { id: string } }) { const world = updateWorld(params.id, { visibilityConfirmed: true }); return world ? NextResponse.json(world) : NextResponse.json({ error: '世界不存在' }, { status: 404 }) }
