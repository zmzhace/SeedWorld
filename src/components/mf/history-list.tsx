'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpenText, Clock3, FileText, Network, Plus } from 'lucide-react'
import './mf-history.css'

type World = { id:string; title?:string; summary?:string; prompt:string; snapshot?:any; graphSyncStatus:string; visibilityConfirmed:boolean; createdAt:string; updatedAt:string }
type SourceFile = { id:string; name:string }

export function HistoryList() {
  const router = useRouter()
  const [worlds, setWorlds] = React.useState<World[]>([])
  const [filesByWorld, setFilesByWorld] = React.useState<Record<string, SourceFile[]>>({})
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/worlds')
        const data = await response.json()
        const list: World[] = data.worlds || []
        setWorlds(list)
        const entries = await Promise.all(list.map(async (world) => {
          try { const r = await fetch(`/api/worlds/${world.id}/sources`); const d = await r.json(); return [world.id, d.sources || []] as const }
          catch { return [world.id, []] as const }
        }))
        setFilesByWorld(Object.fromEntries(entries))
      } finally { setLoading(false) }
    }
    void load()
  }, [])

  return (
    <section className="world-library" aria-labelledby="world-library-title">
      <div className="library-heading">
        <div><h2 id="world-library-title">作品库</h2><p>继续上一次的图谱、推演或章节。</p></div>
        <button onClick={() => router.push('/worlds/new')}><Plus size={16} />完整创建</button>
      </div>

      {loading ? (
        <div className="library-grid" aria-label="正在加载作品">{[0,1,2].map((item) => <div className="world-skeleton" key={item} />)}</div>
      ) : worlds.length === 0 ? (
        <div className="library-empty"><BookOpenText size={26} strokeWidth={1.5} /><div><strong>还没有作品</strong><p>在上方种下一个世界，或使用完整创建补充写作参数。</p></div></div>
      ) : (
        <div className="library-grid">
          {worlds.map((world) => {
            const files = filesByWorld[world.id] || []
            const tick = world.snapshot?.tick || 0
            const ready = world.graphSyncStatus === 'ready'
            return <button className="world-row" key={world.id} onClick={() => router.push(`/worlds/${world.id}`)}>
              <div className="world-row-main">
                <span className={`world-state ${ready ? 'ready' : world.graphSyncStatus === 'processing' ? 'working' : ''}`}><span />{ready ? '图谱就绪' : world.graphSyncStatus === 'processing' ? '正在抽取' : '待建图'}</span>
                <h3>{world.title || world.prompt || '未命名作品'}</h3>
                <p>{world.summary || world.prompt}</p>
              </div>
              <div className="world-row-meta">
                <span><Network size={14} />{world.visibilityConfirmed ? '知识已确认' : '知识待确认'}</span>
                <span><FileText size={14} />{files.length} 份资料</span>
                <span><Clock3 size={14} />Tick {tick}</span>
              </div>
              <ArrowRight className="world-row-arrow" size={18} aria-hidden="true" />
            </button>
          })}
        </div>
      )}
    </section>
  )
}
