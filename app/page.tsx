'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpenText, FileText, Github, Network, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import '@/components/mf/mf-home.css'
import { HistoryList } from '@/components/mf/history-list'

const PIPELINE = [
  { icon: FileText, title: '资料建档', desc: '保存原文与来源，设定可回溯' },
  { icon: Network, title: '动态图谱', desc: '根据本作品自动生成本体' },
  { icon: ShieldCheck, title: '知识隔离', desc: '区分真相、谣言与角色认知' },
  { icon: Sparkles, title: '事件推演', desc: '意图、规则与代价共同裁决' },
  { icon: BookOpenText, title: '限定视角成章', desc: '选取事件，校验逻辑后写成正文' },
]

export default function HomePage() {
  const router = useRouter()
  const [title, setTitle] = React.useState('')
  const [prompt, setPrompt] = React.useState('')
  const [files, setFiles] = React.useState<File[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [dragOver, setDragOver] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => ['pdf', 'md', 'markdown', 'txt'].includes(file.name.split('.').pop()?.toLowerCase() || ''))
    setFiles((current) => [...current, ...valid.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
  }

  const start = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const createdResponse = await fetch('/api/worlds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || undefined, worldPrompt: prompt }) })
      const created = await createdResponse.json()
      if (!createdResponse.ok) throw new Error(created.error || '创建作品失败')
      const data = new FormData()
      data.set('text', prompt)
      files.forEach((file) => data.append('files', file))
      const sourceResponse = await fetch(`/api/worlds/${created.id}/sources`, { method: 'POST', body: data })
      const source = await sourceResponse.json()
      if (!sourceResponse.ok) throw new Error(source.error || '资料保存失败')
      router.push(`/worlds/${created.id}?step=1`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setLoading(false)
    }
  }

  return (
    <main className="mf-home">
      <nav className="home-nav" aria-label="主导航">
        <button className="wordmark" onClick={() => router.push('/')} aria-label="SeedWorld 首页"><span className="seed-mark" aria-hidden="true" />SEEDWORLD</button>
        <div className="nav-actions">
          <button onClick={() => router.push('/worlds')}>作品库</button>
          <a href="https://github.com/zmzhace/SeedWorld" target="_blank" rel="noreferrer"><Github size={16} aria-hidden="true" /> GitHub</a>
        </div>
      </nav>

      <section className="hero-workspace">
        <div className="hero-copy">
          <span className="release-note">SEEDWORLD / FICTION SIMULATION</span>
          <h1>让世界先发生，<br />再把它写下来。</h1>
          <p>不替你随机编故事。SeedWorld 先理解你的设定，让角色在知识边界和世界规则内做出选择，再将经得起回看的事件写成章节。</p>
          <div className="principle-strip"><span>SOURCE 不被覆盖</span><span>EVOLUTION 持续演化</span><span>POV 不越界</span></div>
        </div>

        <article className="seed-manuscript" aria-label="快速创建作品">
          <header className="manuscript-head">
            <div><span className="folio">01</span><div><strong>世界底稿</strong><small>WORLD SEED · 初稿</small></div></div>
            <span className="draft-mark">从一条规则开始</span>
          </header>
          <div className="manuscript-body">
            <label className="manuscript-title"><span>作品暂名 <small>可稍后修改</small></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="未命名作品" disabled={loading} /></label>
            <label className="manuscript-seed"><span>写下这个世界最先成立的事 <small>必填</small></span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="一条不能违背的规则、一个已经发生的事件，或一群人不得不面对的冲突……" disabled={loading} /></label>
          </div>
          <div className={`material-shelf${dragOver ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); addFiles(Array.from(event.dataTransfer.files)) }}>
            <input ref={fileInput} type="file" multiple accept=".pdf,.md,.markdown,.txt" onChange={(event) => addFiles(Array.from(event.target.files || []))} hidden />
            <div><strong>已有设定资料？</strong><span>它们会成为可追溯的只读底稿</span></div>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={loading}><Upload size={15} aria-hidden="true" /> 夹入资料 <span>PDF / MD / TXT</span></button>
            {files.length > 0 && <div className="source-files">{files.map((file, index) => <span key={`${file.name}-${file.size}`}><FileText size={13} />{file.name}<button aria-label={`移除 ${file.name}`} onClick={() => setFiles((items) => items.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="manuscript-footer">
            <p>创建后先整理本体与知识边界，暂不生成正文。</p>
            <button className="create-world" onClick={start} disabled={!prompt.trim() || loading}><span>{loading ? '正在整理这份底稿……' : '种下这个世界'}</span><ArrowRight size={18} aria-hidden="true" /></button>
          </footer>
        </article>
      </section>

      <section className="pipeline" aria-label="SeedWorld 创作流程">
        {PIPELINE.map(({ icon: Icon, title: itemTitle, desc }, index) => <div className="pipeline-item" key={itemTitle}><div className="pipeline-index">{String(index + 1).padStart(2, '0')}</div><Icon size={18} strokeWidth={1.7} aria-hidden="true" /><div><strong>{itemTitle}</strong><span>{desc}</span></div></div>)}
      </section>
      <HistoryList />
    </main>
  )
}
