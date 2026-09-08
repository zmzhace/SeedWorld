'use client'

import React from 'react'
import { Activity, AlertTriangle, ArrowRight, GitBranch, LockKeyhole, RefreshCw, Users } from 'lucide-react'
import './mirofish-console.css'

type Entity = { id:string; name:string; type:string; actionable:number }
type Fact = { id:string; graph_layer:string; predicate:string; subject_id:string; object_id?:string; value?:unknown; created_at?:string }

export function NovelStudioPanel({ worldId, tick, onWorldUpdate }: { worldId:string; tick:number; onWorldUpdate?:(world:any)=>void }) {
  const [world, setWorld] = React.useState<any>(null)
  const [graph, setGraph] = React.useState<{entities:Entity[];facts:Fact[]}>({ entities:[], facts:[] })
  const [ticking, setTicking] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null)

  const load = React.useCallback(async () => {
    const [worldResponse, graphResponse] = await Promise.all([fetch(`/api/worlds/${worldId}`), fetch(`/api/worlds/${worldId}/graph?limit=200`)])
    if (worldResponse.ok) setWorld(await worldResponse.json())
    if (graphResponse.ok) setGraph(await graphResponse.json())
  }, [worldId])

  React.useEffect(() => { void load() }, [load])

  async function oneTick() {
    if (ticking) return
    setTicking(true); setError('')
    try {
      const response = await fetch(`/api/worlds/${worldId}/tick`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ world:world?.snapshot }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '推演失败')
      setWorld((current:any) => ({ ...current, snapshot:value.world }))
      localStorage.setItem(`world_${worldId}`, JSON.stringify(value.world))
      onWorldUpdate?.(value.world)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setTicking(false) }
  }

  const snapshot = world?.snapshot
  const events:any[] = snapshot?.events || []
  const agents:any[] = snapshot?.agents?.npcs || []
  const activeAgents = agents.filter((agent) => agent.life_status === 'alive')
  const evolutionFacts = graph.facts.filter((fact) => fact.graph_layer === 'evolution')
  const locked = world?.graphSyncStatus !== 'ready' || !world?.visibilityConfirmed

  return <div className="simulation-studio">
    <div className="sim-toolbar">
      <div><h2>事件推演</h2><p>每一轮先产生角色意图，再由世界规则裁决结果。</p></div>
      <button className="run-tick" disabled={ticking || locked || !snapshot} onClick={oneTick}>{ticking ? <RefreshCw className="spin" size={16}/> : <Activity size={16}/>}<span>{ticking ? '正在推演……' : '推进一轮'}</span><ArrowRight size={16}/></button>
    </div>

    {locked && <div className="sim-lock"><LockKeyhole size={17}/><div><strong>推演尚未解锁</strong><span>需先完成图谱同步，并在上一步确认知识可见性。</span></div></div>}
    {error && <div className="sim-error" role="alert"><AlertTriangle size={16}/>{error}</div>}

    <div className="sim-metrics">
      <div><span>CURRENT TICK</span><strong>{tick}</strong><small>已提交轮次</small></div>
      <div><span>ACTIVE AGENTS</span><strong>{activeAgents.length}</strong><small>可行动角色</small></div>
      <div><span>EVOLUTION FACTS</span><strong>{evolutionFacts.length}</strong><small>演化图谱增量</small></div>
      <div><span>EVENTS</span><strong>{events.length}</strong><small>已发生事件</small></div>
    </div>

    <div className="sim-body">
      <section className="event-ledger">
        <div className="section-bar"><div><GitBranch size={15}/><strong>事件账本</strong></div><span>新事实只写入 EVOLUTION GRAPH</span></div>
        <div className="event-list">
          {events.length === 0 ? <div className="sim-empty"><Activity size={25} strokeWidth={1.4}/><strong>世界还未开始运转</strong><span>推进第一轮后，角色决策与规则裁决会出现在这里。</span></div> : [...events].reverse().map((event,index) => {
            const summary = String(event.payload?.summary || event.payload?.description || event.type || '未命名事件')
            return <button key={event.id || index} className={`event-row${selectedEvent === event ? ' selected' : ''}`} onClick={() => setSelectedEvent(event)}><span className="event-seq">{String(events.length-index).padStart(3,'0')}</span><div><strong>{summary}</strong><span>{event.type || 'event'} · {formatTime(event.timestamp)}</span></div><ArrowRight size={14}/></button>
          })}
        </div>
      </section>

      <aside className="sim-inspector">
        <div className="section-bar"><div><Users size={15}/><strong>{selectedEvent ? '事件细节' : '行动者'}</strong></div></div>
        {selectedEvent ? <div className="event-detail"><span className="detail-type">{selectedEvent.type || 'EVENT'}</span><h3>{String(selectedEvent.payload?.summary || selectedEvent.type)}</h3><dl><div><dt>发生时间</dt><dd>{formatTime(selectedEvent.timestamp)}</dd></div><div><dt>影响角色</dt><dd>{selectedEvent.payload?.affected_agents?.length || 0}</dd></div><div><dt>强度</dt><dd>{selectedEvent.payload?.intensity ?? '—'}</dd></div></dl><button onClick={() => setSelectedEvent(null)}>返回角色列表</button></div> : <div className="agent-list">{activeAgents.length ? activeAgents.map((agent) => <div key={agent.genetics?.seed || agent.identity?.name}><span>{(agent.identity?.name || '?').slice(0,1)}</span><div><strong>{agent.identity?.name || '未命名角色'}</strong><small>{agent.occupation || agent.social_role || '待定义身份'}</small></div><i>{agent.life_status === 'alive' ? '行动中' : agent.life_status}</i></div>) : <p className="side-empty">图谱中尚无可行动角色。</p>}</div>}
      </aside>
    </div>
  </div>
}

function formatTime(value?:string) { if (!value) return '未记录时间'; const date=new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) }
