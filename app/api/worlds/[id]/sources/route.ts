import { NextResponse } from 'next/server'
import { extractFileText, saveSource } from '@/server/source-ingestion'
import { getDatabase } from '@/server/database'
import { getWorld } from '@/server/novel-repository'

export const runtime = 'nodejs'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!getWorld(params.id)) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
  const rows = getDatabase().prepare('SELECT id,name,mime_type,created_at FROM sources WHERE world_id=? ORDER BY created_at').all(params.id)
  return NextResponse.json({ sources: rows })
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!getWorld(params.id)) return NextResponse.json({ error: '世界不存在' }, { status: 404 })
    const type = request.headers.get('content-type') || ''
    if (type.includes('multipart/form-data')) {
      const form = await request.formData(); const files = form.getAll('files').filter((item): item is File => item instanceof File)
      const text = String(form.get('text') || '').trim(); const results = []
      for (const file of files) { const bytes = new Uint8Array(await file.arrayBuffer()); const content = await extractFileText(new File([bytes], file.name, { type: file.type })); results.push(await saveSource({ worldId: params.id, name: file.name, mimeType: file.type || 'application/octet-stream', text: content, original: bytes, kind: 'file' })) }
      if (text) results.push(await saveSource({ worldId: params.id, name: '粘贴的设定', mimeType: 'text/plain', text, kind: 'text' }))
      if (!results.length) return NextResponse.json({ error: '请提供文件或文本' }, { status: 400 })
      return NextResponse.json({ sources: results }, { status: 201 })
    }
    const body = await request.json(); const text = String(body.text || '').trim()
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    return NextResponse.json(await saveSource({ worldId: params.id, name: String(body.name || '粘贴的设定'), mimeType: 'text/plain', text, kind: 'text' }), { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }) }
}
