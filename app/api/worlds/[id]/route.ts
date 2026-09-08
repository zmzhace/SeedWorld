import { NextResponse } from 'next/server'
import { getWorld, updateWorld } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) { const world = getWorld(params.id); return world ? NextResponse.json(world) : NextResponse.json({ error: '世界不存在' }, { status: 404 }) }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { const body = await request.json(); const world = updateWorld(params.id, body); return world ? NextResponse.json(world) : NextResponse.json({ error: '世界不存在' }, { status: 404 }) }
