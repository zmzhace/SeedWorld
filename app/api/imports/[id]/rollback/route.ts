import { NextResponse } from 'next/server'
import { rollbackImport } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function POST(_: Request, { params }: { params: { id: string } }) { return rollbackImport(params.id) ? NextResponse.json({ success: true }) : NextResponse.json({ error: '导入批次不存在' }, { status: 404 }) }
