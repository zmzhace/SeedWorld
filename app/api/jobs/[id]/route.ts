import { NextResponse } from 'next/server'
import { getJob } from '@/server/novel-repository'
export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) { const job = getJob(params.id); return job ? NextResponse.json(job) : NextResponse.json({ error: '任务不存在' }, { status: 404 }) }
