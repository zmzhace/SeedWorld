import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDatabase } from './database'
import { listArchive } from './novel-repository'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

/** Build a deterministic, author-readable projection without changing facts. */
export async function rebuildWiki(worldId: string, watermark = 0) {
  const archive = listArchive(worldId, { limit: 200 })
  const root = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
  const dir = path.join(root, 'worlds', worldId, 'wiki')
  await mkdir(dir, { recursive: true })
  const pages = [
    { slug: 'index', pageType: 'index', subjectId: undefined, markdown: `# 世界档案\n\n实体 ${archive.entities.length} 个，命题 ${archive.claims.length} 条。\n\n> 本页是事实账本的可读投影，不是新的真相来源。` },
    ...archive.entities.map((entity: any) => ({ slug: `entities/${slugify(entity.name)}`, pageType: 'entity', subjectId: entity.id, markdown: `# ${entity.name}\n\n类型：${entity.type}\n\n${entity.properties?.summary || '暂无摘要'}\n\n## 来源\n\n${entity.provenance?.excerpt || '由作品资料抽取。'}` })),
  ]
  const db = getDatabase()
  for (const page of pages) {
    const contentHash = hash(page.markdown)
    const existing = db.prepare('SELECT version,content_hash FROM wiki_pages WHERE world_id=? AND slug=?').get(worldId, page.slug) as { version?: number; content_hash?: string } | undefined
    if (existing?.content_hash === contentHash) continue
    const version = Number(existing?.version || 0) + (existing ? 1 : 0)
    db.prepare(`INSERT INTO wiki_pages (id,world_id,slug,page_type,subject_id,markdown,source_watermark,content_hash,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(world_id,slug) DO UPDATE SET markdown=excluded.markdown,source_watermark=excluded.source_watermark,content_hash=excluded.content_hash,version=excluded.version,updated_at=excluded.updated_at`).run(randomUUID(), worldId, page.slug, page.pageType, page.subjectId || null, page.markdown, watermark, contentHash, version || 1, new Date().toISOString(), new Date().toISOString())
    await mkdir(path.dirname(path.join(dir, `${page.slug}.md`)), { recursive: true })
    await writeFile(path.join(dir, `${page.slug}.md`), page.markdown, 'utf8')
  }
  return listWiki(worldId)
}

export function listWiki(worldId: string) {
  return (getDatabase().prepare('SELECT id,slug,page_type,subject_id,markdown,source_watermark,version,updated_at FROM wiki_pages WHERE world_id=? ORDER BY slug').all(worldId) as Record<string, unknown>[])
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'untitled'
}
