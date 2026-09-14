'use client'

import React from 'react'
import { BookOpen, CheckCircle2, Clipboard, Download, RefreshCw } from 'lucide-react'
import './chapter-library-panel.css'

type Chapter = {
  id:string
  chapterNumber:number
  version:number
  title:string
  tickFrom:number
  tickTo:number
  generationKind:string
  createdAt:string
  markdown:string
  validation?:any
}

export function ChapterLibraryPanel({ worldId }: { worldId:string }) {
  const [chapters, setChapters] = React.useState<Chapter[]>([])
  const [selectedId, setSelectedId] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/worlds/${worldId}/chapters`)
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '章节读取失败')
      const next = value.chapters || []
      setChapters(next)
      setSelectedId((current) => current && next.some((item:Chapter) => item.id === current) ? current : next[0]?.id || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setLoading(false) }
  }, [worldId])

  React.useEffect(() => { void load() }, [load])
  const selected = chapters.find((chapter) => chapter.id === selectedId)

  function download(chapter:Chapter) {
    const blob = new Blob([chapter.markdown], { type:'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${String(chapter.chapterNumber).padStart(3, '0')}-${chapter.title}.md`
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
  }

  return <div className="chapter-library">
    <header className="chapter-library-header">
      <div><span>MANUSCRIPT</span><h2>章节库</h2><p>推演通过审稿后，正文自动归档在这里。这里阅读和导出，不再重复发起另一套成章流程。</p></div>
      <button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15}/>{loading ? '正在读取' : '刷新'}</button>
    </header>
    {error && <div className="chapter-library-error" role="alert">{error}</div>}
    {!loading && chapters.length === 0 ? <div className="chapter-library-empty"><BookOpen size={30}/><strong>正文尚未开始</strong><span>回到创作台生成下一章；通过审稿的章节会自动出现在这里。</span></div> :
      <div className="chapter-library-body">
        <nav className="chapter-index" aria-label="章节列表">
          {chapters.map((chapter) => <button key={chapter.id} className={selectedId === chapter.id ? 'active' : ''} onClick={() => setSelectedId(chapter.id)}>
            <span>{String(chapter.chapterNumber).padStart(2, '0')}</span><div><strong>{chapter.title}</strong><small>版本 {chapter.version} · Tick {chapter.tickFrom}–{chapter.tickTo}</small></div>
          </button>)}
        </nav>
        <section className="chapter-reader">
          {selected && <><header><div><span>CHAPTER {String(selected.chapterNumber).padStart(2, '0')} · VERSION {selected.version}</span><h1>{selected.title}</h1><small>{new Date(selected.createdAt).toLocaleString('zh-CN')} · {selected.generationKind === 'legacy_generation' ? '旧流程章节' : '严格流水线'}</small></div><div><button onClick={() => void navigator.clipboard.writeText(selected.markdown)}><Clipboard size={14}/>复制</button><button onClick={() => download(selected)}><Download size={14}/>导出</button></div></header>
          {selected.validation?.reader?.passed && <div className="chapter-quality"><CheckCircle2 size={14}/>文学、读者理解与状态证据已通过</div>}
          <article>{selected.markdown || '正文文件暂时无法读取。'}</article></>}
        </section>
      </div>}
  </div>
}
