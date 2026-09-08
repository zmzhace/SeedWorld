import { NextResponse } from 'next/server'
import { generateChapter } from '@/server/chapter-service'
export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: { id: string } }) { try { const body = await request.json(); return NextResponse.json(await generateChapter({ worldId: params.id, tickFrom: Number(body.tickFrom ?? 0), tickTo: Number(body.tickTo ?? body.tickFrom ?? 0), povEntityId: body.povEntityId, goal: body.goal, requiredEvents: body.requiredEvents })) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) } }
