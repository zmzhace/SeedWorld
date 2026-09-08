import { NextResponse } from 'next/server'
import { getLatestOntology } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) { const value = getLatestOntology(params.id); return value ? NextResponse.json(value) : NextResponse.json({ error: '尚未生成本体' }, { status: 404 }) }
