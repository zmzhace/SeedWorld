import { NextResponse } from 'next/server'
import { importMiroFishGraph } from '@/server/extraction-service'
export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: { id: string } }) { try { const body = await request.json(); return NextResponse.json(await importMiroFishGraph(params.id, String(body.graphId || 'mirofish_a8b174a175434d75')), { status: 202 }) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }) } }
