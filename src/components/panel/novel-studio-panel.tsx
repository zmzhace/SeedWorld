'use client'

import React from 'react'
import { Activity, AlertTriangle, ArrowRight, BookCheck, CheckCircle2, Eye, GitBranch, LockKeyhole, RefreshCw, Route, ShieldCheck, Users } from 'lucide-react'
import './mirofish-console.css'

type Entity = { id:string; name:string; type:string; actionable:number }
type Fact = { id:string; origin:string; predicate:string; subject_id:string; object_id?:string; value?:unknown; created_at?:string }

export function NovelStudioPanel({ worldId, tick, onWorldUpdate }: { worldId:string; tick:number; onWorldUpdate?:(world:any)=>void }) {
  const [world, setWorld] = React.useState<any>(null)
  const [graph, setGraph] = React.useState<{entities:Entity[];facts:Fact[]}>({ entities:[], facts:[] })
  const [ticking, setTicking] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null)
  const [scenes, setScenes] = React.useState<any[]>([])
  const [threads, setThreads] = React.useState<any[]>([])
  const [archiveEvents, setArchiveEvents] = React.useState<any[]>([])
  const [foundation, setFoundation] = React.useState<any>(null)
  const [storyEngine, setStoryEngine] = React.useState<any>(null)
  const [readerState, setReaderState] = React.useState<any>(null)
  const [outline, setOutline] = React.useState<any>(null)
  const [contract, setContract] = React.useState<any>(null)
  const [chapterRun, setChapterRun] = React.useState<any>(null)
  const [latestChapter, setLatestChapter] = React.useState<any>(null)
  const [tickRun, setTickRun] = React.useState<any>(null)
  const [horizon, setHorizon] = React.useState<any>(null)
  const [trajectories, setTrajectories] = React.useState<any[]>([])
  const [health, setHealth] = React.useState<any>(null)
  const [closure, setClosure] = React.useState<any>(null)
  const [transition, setTransition] = React.useState<any>(null)
  const [actorRuntime, setActorRuntime] = React.useState<any[]>([])
  const [confirmingFoundation, setConfirmingFoundation] = React.useState(false)
  const [generatingEngine, setGeneratingEngine] = React.useState(false)
  const [confirmingEngine, setConfirmingEngine] = React.useState(false)
  const [savingEngine, setSavingEngine] = React.useState(false)
  const [engineDraft, setEngineDraft] = React.useState<any>(null)

  const load = React.useCallback(async () => {
    const [worldResponse, graphResponse, sceneResponse, threadResponse, eventResponse, foundationResponse, contractResponse, chapterResponse, tickResponse, actorResponse, engineResponse, readerResponse] = await Promise.all([fetch(`/api/worlds/${worldId}`), fetch(`/api/worlds/${worldId}/archive?limit=200`), fetch(`/api/worlds/${worldId}/scenes`), fetch(`/api/worlds/${worldId}/story-threads?status=active`), fetch(`/api/worlds/${worldId}/events?tickFrom=0`), fetch(`/api/worlds/${worldId}/foundation`), fetch(`/api/worlds/${worldId}/evolution-contract`), fetch(`/api/worlds/${worldId}/chapters`), fetch(`/api/worlds/${worldId}/tick`), fetch(`/api/worlds/${worldId}/actors/runtime`), fetch(`/api/worlds/${worldId}/story-engine`), fetch(`/api/worlds/${worldId}/reader-state`)] )
    if (worldResponse.ok) setWorld(await worldResponse.json())
    if (graphResponse.ok) { const archive = await graphResponse.json(); setGraph({ entities: archive.entities || [], facts: archive.claims || [] }) }
    if (sceneResponse.ok) setScenes((await sceneResponse.json()).scenes || [])
    if (threadResponse.ok) setThreads((await threadResponse.json()).threads || [])
    if (eventResponse.ok) setArchiveEvents((await eventResponse.json()).events || [])
    if (foundationResponse.ok) {
      const value = await foundationResponse.json(); setFoundation(value.foundation)
      if (value.foundation?.status === 'confirmed') {
        const outlineResponse = await fetch(`/api/worlds/${worldId}/outline`)
        if (outlineResponse.ok) setOutline((await outlineResponse.json()).outline)
        const [horizonResponse, trajectoriesResponse, healthResponse, closureResponse] = await Promise.all([
          fetch(`/api/worlds/${worldId}/horizon`), fetch(`/api/worlds/${worldId}/trajectories`),
          fetch(`/api/worlds/${worldId}/mainline-health`), fetch(`/api/worlds/${worldId}/closure-readiness`),
        ])
        if (horizonResponse.ok) setHorizon((await horizonResponse.json()).horizon)
        if (trajectoriesResponse.ok) setTrajectories((await trajectoriesResponse.json()).trajectories || [])
        if (healthResponse.ok) setHealth((await healthResponse.json()).health)
        if (closureResponse.ok) setClosure(await closureResponse.json())
      }
    }
    if (contractResponse.ok) setContract((await contractResponse.json()).contract)
    if (chapterResponse.ok) { const value = await chapterResponse.json(); setChapterRun(value.run); setLatestChapter(value.chapter || null) }
    if (tickResponse.ok) {
      const latest = (await tickResponse.json()).run; setTickRun(latest)
      if (latest?.pendingTransitionId) {
        const response = await fetch(`/api/worlds/${worldId}/tick/${latest.tick}/pending-transition`)
        if (response.ok) setTransition((await response.json()).transition)
      }
    }
    if (actorResponse.ok) setActorRuntime((await actorResponse.json()).actors || [])
    if (engineResponse.ok) setStoryEngine((await engineResponse.json()).engine)
    if (readerResponse.ok) setReaderState(await readerResponse.json())
  }, [worldId])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => { if (storyEngine?.status === 'draft') setEngineDraft(storyEngine) }, [storyEngine])
  React.useEffect(() => {
    if (!chapterRun || !['queued','running'].includes(chapterRun.status)) return
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/worlds/${worldId}/chapters`)
      if (!response.ok) return
      const value = await response.json(); setChapterRun(value.run)
      if (value.run?.status === 'completed') { window.clearInterval(timer); await load() }
      if (value.run?.status === 'failed') { window.clearInterval(timer); setError(value.run.error || '章节未通过审稿') }
    }, 2500)
    return () => window.clearInterval(timer)
  }, [chapterRun?.id, chapterRun?.status, load, worldId])

  React.useEffect(() => {
    if (!tickRun || !['planning','simulating','awaiting_chapter','reviewing'].includes(tickRun.status)) return
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/worlds/${worldId}/tick/${tickRun.tick}`)
      if (!response.ok) return
      const value = await response.json(); setTickRun(value.run)
      if (value.run?.pendingTransitionId) {
        const transitionResponse = await fetch(`/api/worlds/${worldId}/tick/${tickRun.tick}/pending-transition`)
        if (transitionResponse.ok) setTransition((await transitionResponse.json()).transition)
      }
      const chapterResponse = await fetch(`/api/worlds/${worldId}/chapters`)
      if (chapterResponse.ok) setChapterRun((await chapterResponse.json()).run)
      if (value.run?.status === 'published') { window.clearInterval(timer); await load() }
      if (value.run?.status === 'blocked') { window.clearInterval(timer); setError(value.run.blockReason || '本轮未通过约束') }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [tickRun?.tick, tickRun?.status, load, worldId])

  async function oneTick() {
    if (ticking) return
    setTicking(true); setError('')
    try {
      const response = await fetch(`/api/worlds/${worldId}/tick`, { method:'POST', headers:{'Content-Type':'application/json'} })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '推演失败')
      setTickRun(value.run)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setTicking(false) }
  }

  const snapshot = world?.snapshot
  const events:any[] = archiveEvents.length
    ? archiveEvents.filter((event) => event.type === 'narrative_event').map((event) => ({ ...event, timestamp: event.created_at || event.timestamp }))
    : (snapshot?.events || []).filter((event:any) => event.type === 'narrative_event')
  const agents:any[] = snapshot?.agents?.npcs || []
  const activeActorIds = new Set(actorRuntime.filter((actor) => actor.lifecycle === 'active').map((actor) => actor.actorId))
  const activeAgents = agents.filter((agent) => activeActorIds.has(agent.genetics?.seed))
  const evolutionFacts = graph.facts.filter((fact) => fact.origin === 'simulation')
  const tickBusy = ['planning','simulating','awaiting_chapter','reviewing'].includes(tickRun?.status)
  const pipelineBusy = tickBusy || ['queued','running'].includes(chapterRun?.status)
  const locked = !world?.visibilityConfirmed || foundation?.status !== 'confirmed' || storyEngine?.status !== 'confirmed' || pipelineBusy
  const scene = scenes.find((item) => item.status === 'active')
  const proposedScenes = scenes.filter((item) => item.status === 'proposed' && !item.workflowOwned).slice(0, 3)
  async function activateScene(sceneId:string) {
    const response = await fetch(`/api/worlds/${worldId}/scenes/${sceneId}/activate`, { method:'POST' })
    if (response.ok) await load()
  }
  async function confirmBookFoundation() {
    setConfirmingFoundation(true); setError('')
    try {
      const response = await fetch(`/api/worlds/${worldId}/foundation/confirm`, { method:'POST' }); const value = await response.json()
      if (!response.ok) throw new Error(value.error || '确认失败')
      setFoundation(value.foundation); setOutline(value.outline)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setConfirmingFoundation(false) }
  }
  async function confirmStoryEngine() {
    setError(''); setConfirmingEngine(true)
    try { const response = await fetch(`/api/worlds/${worldId}/story-engine/confirm`, { method:'POST' }); const value = await response.json(); if (!response.ok) throw new Error(value.error || '确认故事发动机失败'); setStoryEngine(value.engine) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setConfirmingEngine(false) }
  }
  async function generateStoryEngine() {
    setError(''); setGeneratingEngine(true)
    try { const response = await fetch(`/api/worlds/${worldId}/story-engine/regenerate`, { method:'POST' }); const value = await response.json(); if (!response.ok) throw new Error(value.error || '生成故事发动机失败'); setStoryEngine(value.engine) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setGeneratingEngine(false) }
  }
  async function saveStoryEngineDraft() {
    if (!engineDraft) return
    setError(''); setSavingEngine(true)
    try {
      const response = await fetch(`/api/worlds/${worldId}/story-engine`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(engineDraft) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '保存故事发动机失败')
      setStoryEngine(value.engine)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSavingEngine(false) }
  }
  const nextChapter = outline?.chapters?.find((item:any)=>item.status==='planned')
  const currentArc = outline?.arcs?.find((item:any)=>item.status==='active')
  const currentVolume = outline?.volumes?.find((item:any)=>item.status==='active')
  const chapterResponsibility = nextChapter?.relevance?.mode || contract?.relevance?.mode || 'advance'
  const phaseLabels:Record<string,string> = { exploration:'探索', development:'发展', convergence:'收敛', finale:'最终卷' }

  async function handleBlocked(action:'replan'|'discard') {
    if (!tickRun?.tick) return
    setError(''); setTicking(true)
    try {
      const response = await fetch(`/api/worlds/${worldId}/tick/${tickRun.tick}/${action}`, { method:'POST' })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '操作失败')
      setTransition(null)
      if (action === 'replan') setTickRun(value.run)
      else { setTickRun(null); await load() }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setTicking(false) }
  }

  return <div className="simulation-studio">
    <div className="sim-toolbar">
      <div><h2>滚动主线</h2><p>每轮解决当前故事弧的一步；远期方向随已发布正文评估，不预设唯一结局。</p></div>
      <button className="run-tick" disabled={ticking || locked || !snapshot} onClick={oneTick}>{ticking || pipelineBusy ? <RefreshCw className="spin" size={16}/> : <Activity size={16}/>}<span>{ticking ? '正在启动……' : tickBusy ? workflowLabel(tickRun.stage) : ['queued','running'].includes(chapterRun?.status) ? 'Writer 正在成章……' : '推演并写下一章'}</span><ArrowRight size={16}/></button>
    </div>

    {!world?.visibilityConfirmed && <div className="sim-lock"><LockKeyhole size={17}/><div><strong>推演尚未解锁</strong><span>请先在上一步确认角色知识边界。</span></div></div>}
    {foundation && foundation.status !== 'confirmed' && <div className="foundation-gate"><BookCheck size={18}/><div><strong>确认作品根基后开始正式演化</strong><span>这里只锁定作品承诺、核心矛盾、长期问题与世界规则；不会提前锁死终局。滚动大纲会在首次推演任务中后台生成。</span></div><button disabled={confirmingFoundation} onClick={confirmBookFoundation}>{confirmingFoundation?'正在确认……':'确认作品根基'}</button></div>}
    {foundation?.status === 'confirmed' && (!storyEngine || storyEngine.status !== 'confirmed') && <div className="foundation-gate"><Route size={18}/><div><strong>{storyEngine ? '确认本作品的故事发动机' : '先生成本作品的故事发动机'}</strong><span>{storyEngine ? `${storyEngine.signatureExperience} 当前循环：${storyEngine.repeatableSituation}` : '系统会根据作品根基和资料生成可编辑的持续冲突循环。'}</span></div>{storyEngine ? <button disabled={confirmingEngine} onClick={()=>void confirmStoryEngine()}>{confirmingEngine ? '正在确认……' : '确认故事发动机'}</button> : <button disabled={generatingEngine} onClick={()=>void generateStoryEngine()}>{generatingEngine ? '模型正在生成……' : '生成故事发动机'}</button>}</div>}
    {storyEngine?.status === 'draft' && engineDraft && <details className="engine-editor"><summary>编辑故事发动机后再确认</summary><div className="engine-fields"><label><span>核心体验</span><textarea value={engineDraft.signatureExperience || ''} onChange={(event)=>setEngineDraft({...engineDraft,signatureExperience:event.target.value})}/></label><label><span>戏剧问题</span><textarea value={engineDraft.dramaticQuestion || ''} onChange={(event)=>setEngineDraft({...engineDraft,dramaticQuestion:event.target.value})}/></label><label><span>可重复且可变形的处境</span><textarea value={engineDraft.repeatableSituation || ''} onChange={(event)=>setEngineDraft({...engineDraft,repeatableSituation:event.target.value})}/></label><label><span>主要解题方式</span><textarea value={engineDraft.protagonistMethod || ''} onChange={(event)=>setEngineDraft({...engineDraft,protagonistMethod:event.target.value})}/></label><label><span>情绪承诺</span><textarea value={engineDraft.emotionalPromise || ''} onChange={(event)=>setEngineDraft({...engineDraft,emotionalPromise:event.target.value})}/></label></div><button disabled={savingEngine} onClick={()=>void saveStoryEngineDraft()}>{savingEngine ? '正在保存……' : '保存草案'}</button></details>}
    {pipelineBusy && <div className="chapter-pipeline" role="status"><span>{tickBusy ? workflowLabel(tickRun.stage) : chapterRun?.message}</span><strong>{tickBusy ? `TICK ${tickRun.tick}` : `${chapterRun?.progress || 0}%`}</strong><i style={{transform:`scaleX(${tickBusy ? workflowProgress(tickRun.stage) : Math.max(0,Math.min(100,chapterRun?.progress || 0))/100})`}}/></div>}
    {error && <div className="sim-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
    {tickRun?.status === 'blocked' && <div className="blocked-actions"><div><strong>本轮已停止，正式世界未改变</strong><span>{tickRun.blockReason}</span></div><button onClick={()=>void handleBlocked('replan')}>按证据重规划</button><button className="quiet" onClick={()=>void handleBlocked('discard')}>废弃本轮</button></div>}

    <div className="sim-metrics">
      <div><span>CURRENT TICK</span><strong>{tick}</strong><small>已提交轮次</small></div>
      <div><span>ACTIVE AGENTS</span><strong>{activeAgents.length}</strong><small>当前主场景在场</small></div>
      <div><span>NEW CLAIMS</span><strong>{evolutionFacts.length}</strong><small>世界档案新增命题</small></div>
      <div><span>EVENTS</span><strong>{events.length}</strong><small>已发生事件</small></div>
    </div>

    <div className="narrative-ledger four">
      <section><span>BOOK FOUNDATION</span><strong>{foundation?.corePromise || '正在生成通用长篇契约'}</strong><small>{foundation?.status === 'confirmed' ? `V${foundation.version} · 已确认` : '待作者确认'}</small></section>
      <section><span>CURRENT VOLUME</span><strong>{currentVolume?.title || '当前卷待规划'}</strong><small>{currentVolume?.stageGoal || currentVolume?.goal || '只约束阶段方向'}</small></section>
      <section><span>CURRENT ARC</span><strong>{currentArc?.title || '第一故事弧待展开'}</strong><small>{currentArc?.goal || foundation?.centralConflict || '等待作品资料'}</small></section>
      <section><span>NEXT CHAPTER · {chapterResponsibility.toUpperCase()}</span><strong>{nextChapter?.goal || contract?.coreEvent || '确认根基后生成'}</strong><small>{nextChapter ? `${nextChapter.readerPayoff || nextChapter.requiredChange} · ${nextChapter.hookType}` : '每轮恰好对应一章'}</small></section>
    </div>
    {contract && <section className="contract-strip"><div><span>EVOLUTION CONTRACT · TICK {contract.tick}</span><strong>{contract.coreEvent}</strong></div><dl><div><dt>必须变化</dt><dd>{contract.requiredDeltas?.map((item:any)=>item.narrativeReason).join('；') || contract.requiredStateChanges?.join('；') || '—'}</dd></div><div><dt>本章职责</dt><dd>{chapterResponsibility} · {contract.readerPayoff}</dd></div><div><dt>章末钩子</dt><dd>{contract.hookType} · {contract.hookGoal}</dd></div></dl></section>}

    {horizon && <section className="horizon-strip"><div><Route size={15}/><span>NARRATIVE HORIZON</span><strong>{phaseLabels[horizon.phase] || horizon.phase}</strong><small>已评估至第 {horizon.lastEvaluatedChapter || 0} 章</small></div><div><span>当前弧健康</span><strong>{health ? health.healthy ? '可继续推进' : '需要处理阻塞' : '等待首轮报告'}</strong><small>{health?.overdueObligationIds?.length ? `${health.overdueObligationIds.length} 个义务逾期` : '长期承诺仍在账本中'}</small></div><div><span>最终卷准备度</span><strong>{closure?.ready ? '条件已成熟' : '尚未收敛'}</strong><small>不显示虚假百分比</small></div><details><summary>作者侧远期方向 · {trajectories.length}</summary>{trajectories.map((item)=><p key={item.id}><b>{item.title}</b><span>{item.viability} · {item.premise}</span></p>)}</details></section>}
    {storyEngine?.status === 'confirmed' && <section className="contract-strip"><div><span>STORY ENGINE · V{storyEngine.version}</span><strong>{storyEngine.dramaticQuestion}</strong></div><dl><div><dt>循环</dt><dd>{storyEngine.repeatableSituation}</dd></div><div><dt>推进方式</dt><dd>{storyEngine.protagonistMethod}</dd></div><div><dt>读者承诺</dt><dd>{storyEngine.emotionalPromise}</dd></div></dl></section>}
    {nextChapter && <section className="micro-story-ledger" aria-label="下一章微型故事合同"><header><span>MICRO STORY CONTRACT</span><strong>下一章不是演示 Agent，而是完成一个小故事</strong></header><dl><div><dt>目标</dt><dd>{nextChapter.immediateGoal}</dd></div><div><dt>阻碍</dt><dd>{nextChapter.centralObstacle}</dd></div><div><dt>选择</dt><dd>{nextChapter.difficultChoice}</dd></div><div><dt>回报</dt><dd>{nextChapter.concretePayoff}</dd></div><div><dt>不可逆结果</dt><dd>{nextChapter.irreversibleResult}</dd></div><div><dt>下一压力</dt><dd>{nextChapter.nextPressure}</dd></div></dl></section>}
    {readerState?.questions?.length > 0 && <section className="horizon-strip"><div><span>READER QUESTIONS</span><strong>{readerState.questions.filter((q:any)=>q.status !== 'paid_off' && q.status !== 'answered').length} 个未结问题</strong><small>每章必须推进并提供局部回报</small></div><div>{readerState.questions.slice(0,3).map((q:any)=><p key={q.id}><b>{q.question}</b><span>{q.status} · {q.importance}</span></p>)}</div></section>}

    {latestChapter?.validation && <section className="quality-ledger" aria-label="最新章节质量审查"><header><ShieldCheck size={16}/><div><span>LAST PUBLISHED · CHAPTER {latestChapter.chapterNumber}</span><strong>{latestChapter.title}</strong></div></header><div className={latestChapter.validation.literary?.passed ? 'passed' : 'failed'}><CheckCircle2 size={15}/><span>文学审稿</span><b>{latestChapter.validation.literary?.passed ? `通过 · ${Math.round(latestChapter.validation.literary.averageScore || 0)}` : '未通过'}</b></div><div className={latestChapter.validation.reader?.passed ? 'passed' : 'failed'}><Eye size={15}/><span>读者复述</span><b>{latestChapter.validation.reader?.passed ? '能说清本章' : '未通过'}</b></div><div className="passed"><GitBranch size={15}/><span>状态证据</span><b>已随原子发布校验</b></div></section>}

    {transition && <section className="transition-ledger"><div><span>待发布状态差</span><strong>正文与双层审稿通过前不会写入正式世界</strong></div>{transition.deltas?.map((delta:any)=><div key={delta.id}><span>{delta.operation}</span><b>{delta.narrativeReason}</b><small>{delta.subjectId} → {String(delta.after?.description || delta.after?.value || delta.after?.status || '')}</small></div>)}</section>}

    <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.2fr) minmax(240px,.8fr)', gap:10, marginBottom:12 }}>
      <section style={{ border:'1px solid #E6E2DA', padding:'12px 14px', background:'#FFF' }}>
        <div className="section-bar" style={{ padding:0, border:0 }}><div><GitBranch size={15}/><strong>当前主场景</strong></div><span>{scene ? `Tick ${scene.tick}` : '待生成'}</span></div>
        {scene ? <><strong style={{ display:'block', marginTop:10 }}>{scene.objective}</strong><p className="description" style={{ margin:'5px 0 0' }}>{scene.conflict}</p><small style={{ color:'#777' }}>{scene.timeLabel || '时间未标注'} · {scene.status}</small></> : <p className="description" style={{ margin:'10px 0 0' }}>推进第一轮后，系统会根据世界状态建立主场景。</p>}
      </section>
      <section style={{ border:'1px solid #E6E2DA', padding:'12px 14px', background:'#FFF' }}>
        <div className="section-bar" style={{ padding:0, border:0 }}><div><Activity size={15}/><strong>活跃故事线</strong></div><span>{threads.length} 条</span></div>
        {threads.length ? threads.slice(0,3).map((thread) => <div key={thread.id} style={{ display:'flex', justifyContent:'space-between', gap:8, paddingTop:9, fontSize:12 }}><span>{thread.title}</span><b>{Math.round(thread.pressure * 100)}%</b></div>) : <p className="description" style={{ margin:'10px 0 0' }}>事件形成后，未解决目标会自动进入故事线。</p>}
      </section>
    </div>
    {proposedScenes.length > 0 && <section style={{ border:'1px solid #E6E2DA', padding:'12px 14px', background:'#FFF', marginBottom:12 }}><div className="section-bar" style={{ padding:0, border:0 }}><div><GitBranch size={15}/><strong>下一场景候选</strong></div><span>由当前事件因果生成</span></div><div style={{ display:'grid', gap:6, marginTop:9 }}>{proposedScenes.map((candidate)=><button key={candidate.id} onClick={()=>void activateScene(candidate.id)} style={{ display:'flex', justifyContent:'space-between', textAlign:'left', gap:12, padding:'9px 10px', background:'#FAFAF7', border:'1px solid #E6E2DA', cursor:'pointer' }}><span><b>{candidate.objective}</b><small style={{ display:'block', color:'#777', marginTop:3 }}>{candidate.conflict}</small></span><ArrowRight size={14}/></button>)}</div></section>}

    <div className="sim-body">
      <section className="event-ledger">
        <div className="section-bar"><div><GitBranch size={15}/><strong>事件账本</strong></div><span>新事件追加到世界档案</span></div>
        <div className="event-list">
          {events.length === 0 ? <div className="sim-empty"><Activity size={25} strokeWidth={1.4}/><strong>世界还未开始运转</strong><span>推进第一轮后，角色决策与规则裁决会出现在这里。</span></div> : [...events].reverse().map((event,index) => {
            const summary = String(event.payload?.summary || event.payload?.description || event.type || '未命名事件')
            return <button key={event.id || index} className={`event-row${selectedEvent === event ? ' selected' : ''}`} onClick={() => setSelectedEvent(event)}><span className="event-seq">{String(events.length-index).padStart(3,'0')}</span><div><strong>{summary}</strong><span>{event.type || 'event'} · {formatTime(event.timestamp)}</span></div><ArrowRight size={14}/></button>
          })}
        </div>
      </section>

      <aside className="sim-inspector">
        <div className="section-bar"><div><Users size={15}/><strong>{selectedEvent ? '事件细节' : '行动者'}</strong></div></div>
        {selectedEvent ? <div className="event-detail"><span className="detail-type">{selectedEvent.type || 'EVENT'}</span><h3>{String(selectedEvent.payload?.summary || selectedEvent.type)}</h3><dl><div><dt>发生时间</dt><dd>{formatTime(selectedEvent.timestamp)}</dd></div><div><dt>影响角色</dt><dd>{selectedEvent.payload?.affected_agents?.length || 0}</dd></div><div><dt>强度</dt><dd>{selectedEvent.payload?.intensity ?? '—'}</dd></div></dl><button onClick={() => setSelectedEvent(null)}>返回角色列表</button></div> : <div className="agent-list">{activeAgents.length ? activeAgents.map((agent) => <div key={agent.genetics?.seed || agent.identity?.name}><span>{(agent.identity?.name || '?').slice(0,1)}</span><div><strong>{agent.identity?.name || '未命名角色'}</strong><small>{agent.occupation || agent.social_role || '待定义身份'}</small></div><i>{agent.life_status === 'alive' ? '行动中' : agent.life_status}</i></div>) : <p className="side-empty">档案中尚无可行动角色。</p>}</div>}
      </aside>
    </div>
  </div>
}

function formatTime(value?:string) { if (!value) return '未记录时间'; const date=new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) }

function workflowLabel(stage?:string) {
  const labels:Record<string,string> = {
    load_context:'读取正式世界', plan_narrative_horizon:'生成滚动主线与当前弧', check_mainline_health:'检查当前弧健康', create_evolution_contract:'锁定本章状态变化',
    generate_character_intents:'角色提交意图', script_resolution:'多 Agent 编剧会审议', build_pending_transition:'验证待发布状态差',
    draft_chapter:'Writer 正在成章', reviewing:'Editor 正在审稿', atomic_publish:'原子发布', blocked:'等待作者处理',
  }
  return labels[stage || ''] || '工作流处理中'
}

function workflowProgress(stage?:string) {
  const stages = ['load_context','plan_narrative_horizon','check_mainline_health','create_evolution_contract','generate_character_intents','script_resolution','build_pending_transition','draft_chapter','reviewing','atomic_publish']
  const index = stages.indexOf(stage || '')
  return index < 0 ? .08 : Math.max(.08, (index + 1) / stages.length)
}
