import { NextResponse } from 'next/server'
import { listWiki, rebuildWiki } from '@/server/wiki-service'
export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) { return NextResponse.json(listWiki(params.id)) }
export async function POST(_: Request, { params }: { params: { id: string } }) { return NextResponse.json(await rebuildWiki(params.id), { status: 202 }) }
