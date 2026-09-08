import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDatabase } from './database'

export const sha256 = (content: string | Uint8Array) => createHash('sha256').update(content).digest('hex')

export function splitText(text: string, size = 4000, overlap = 250): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + size)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n', end), normalized.lastIndexOf('。', end))
      if (boundary > start + size * 0.6) end = boundary + 1
    }
    chunks.push(normalized.slice(start, end))
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks
}

export async function extractFileText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: bytes })
    try { return (await parser.getText()).text } finally { await parser.destroy() }
  }
  if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith('text/')) throw new Error(`不支持的文件类型: ${file.name}`)
  return new TextDecoder().decode(bytes)
}

export async function saveSource(input: { worldId: string; name: string; mimeType: string; text: string; original?: Uint8Array; kind: 'file' | 'text' }) {
  const db = getDatabase(); const digest = sha256(input.text)
  const existing = db.prepare('SELECT id FROM sources WHERE world_id=? AND sha256=?').get(input.worldId, digest) as { id: string } | undefined
  if (existing) return { id: existing.id, duplicate: true, chunks: 0 }
  const id = randomUUID(); const now = new Date().toISOString(); let originalPath: string | null = null
  if (input.original) {
    const root = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
    const dir = path.join(root, 'worlds', input.worldId, 'sources', id); await mkdir(dir, { recursive: true })
    const safeName = input.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120) || 'source'
    originalPath = path.join(dir, safeName); await writeFile(originalPath, input.original)
  }
  const chunks = splitText(input.text)
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO sources (id,world_id,kind,name,mime_type,sha256,original_path,extracted_text,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, input.worldId, input.kind, input.name, input.mimeType, digest, originalPath, input.text, now)
    const statement = db.prepare(`INSERT INTO source_chunks (id,source_id,ordinal,content,sha256) VALUES (?,?,?,?,?)`)
    chunks.forEach((chunk, ordinal) => statement.run(randomUUID(), id, ordinal, chunk, sha256(chunk)))
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return { id, duplicate: false, chunks: chunks.length }
}

export function getSourceMaterial(worldId: string) {
  const db = getDatabase()
  const sources = db.prepare('SELECT id,name,sha256,extracted_text FROM sources WHERE world_id=? ORDER BY created_at').all(worldId) as Array<{ id: string; name: string; sha256: string; extracted_text: string }>
  const chunks = db.prepare(`SELECT c.id,c.source_id,c.ordinal,c.content,c.sha256,c.episode_id FROM source_chunks c JOIN sources s ON s.id=c.source_id WHERE s.world_id=? ORDER BY s.created_at,c.ordinal`).all(worldId) as Array<{ id: string; source_id: string; ordinal: number; content: string; sha256: string; episode_id?: string }>
  return { sources, chunks }
}
