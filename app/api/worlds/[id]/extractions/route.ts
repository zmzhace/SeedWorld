import { NextResponse } from 'next/server'
import { startExtraction } from '@/server/extraction-service'
export const runtime = 'nodejs'
export async function POST(_: Request, { params }: { params: { id: string } }) { try { return NextResponse.json(startExtraction(params.id), { status: 202 }) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }) } }
