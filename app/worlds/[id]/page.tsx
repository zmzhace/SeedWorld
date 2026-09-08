'use client'

import React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CircleDot, GitBranch, Network, PanelLeftClose, PanelLeftOpen, PenTool, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import '@/components/mf/mf-process.css'
import { GraphView } from '@/components/mf/graph-view'
import { StepGraphBuild } from '@/components/mf/step-graph-build'
import { StepEnvSetup } from '@/components/mf/step-env-setup'
import { StepReport } from '@/components/mf/step-report'
import { StepInteraction } from '@/components/mf/step-interaction'
import { NovelStudioPanel } from '@/components/panel/novel-studio-panel'

const STEPS = [
  { name:'世界图谱', short:'建图', icon:Network },
  { name:'知识边界', short:'知识', icon:ShieldCheck },
  { name:'事件推演', short:'推演', icon:GitBranch },
  { name:'章节工坊', short:'成章', icon:PenTool },
  { name:'导演干预', short:'干预', icon:SlidersHorizontal },
]

export default function WorldWorkspacePage() {
  const params=useParams(); const router=useRouter(); const searchParams=useSearchParams(); const worldId=String(params.id||'')
  const [step,setStep]=React.useState(()=>Math.min(5,Math.max(1,Number(searchParams.get('step')||1))))
  const [graphOpen,setGraphOpen]=React.useState(true)
  const [record,setRecord]=React.useState<any>(null); const [ontology,setOntology]=React.useState<any>(null)
  const [graphStats,setGraphStats]=React.useState({nodes:0,edges:0,types:0}); const [job,setJob]=React.useState<any>(null)
  const [starting,setStarting]=React.useState(false); const [confirming,setConfirming]=React.useState(false)
  const [logs,setLogs]=React.useState<Array<{time:string;msg:string}>>([]); const [graphRefreshKey,setGraphRefreshKey]=React.useState(0)

  const addLog=React.useCallback((msg:string)=>setLogs((lines)=>[...lines.slice(-99),{time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),msg}]),[])
  const loadRecord=React.useCallback(async()=>{const response=await fetch(`/api/worlds/${worldId}`);if(response.ok){const data=await response.json();setRecord(data);return data}return null},[worldId])
  const loadOntology=React.useCallback(async()=>{const response=await fetch(`/api/worlds/${worldId}/ontology`);setOntology(response.ok?await response.json():null)},[worldId])
  const loadGraphStats=React.useCallback(async()=>{try{const response=await fetch(`/api/worlds/${worldId}/graph?limit=200`);const data=await response.json();setGraphStats({nodes:(data.entities||[]).length,edges:(data.facts||[]).length,types:ontology?.entityTypes?.length||0})}catch{}},[worldId,ontology?.entityTypes?.length])

  React.useEffect(()=>{addLog('作品工作台已载入');void loadRecord().then(()=>{void loadOntology();void loadGraphStats()})},[worldId]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(()=>{if(window.matchMedia('(max-width: 900px)').matches)setGraphOpen(false)},[])
  React.useEffect(()=>{const id=searchParams.get('job');if(id)void fetch(`/api/jobs/${id}`).then((r)=>(r.ok?r.json():null)).then((value)=>value&&setJob(value))},[]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(()=>{
    if(!job||['completed','failed','rolled_back'].includes(job.status)){if(job?.status==='completed'){addLog(job.message||'图谱抽取完成');void loadRecord();void loadOntology();void loadGraphStats();setGraphRefreshKey((key)=>key+1)}else if(job?.status==='failed')addLog(`抽取失败：${job.error||job.message}`);return}
    const timer=window.setInterval(async()=>{const response=await fetch(`/api/jobs/${job.id}`);if(response.ok){const next=await response.json();if(next.message!==job.message)addLog(next.message);setJob(next)}},2500);return()=>window.clearInterval(timer)
  },[job?.id,job?.status,job?.message]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startExtraction(){setStarting(true);try{addLog('开始生成动态本体');const response=await fetch(`/api/worlds/${worldId}/extractions`,{method:'POST'});const value=await response.json();if(!response.ok)throw new Error(value.error||'启动失败');setJob(value)}catch(cause){addLog(`启动失败：${cause instanceof Error?cause.message:String(cause)}`)}finally{setStarting(false)}}
  async function confirmVisibility(){setConfirming(true);try{const response=await fetch(`/api/worlds/${worldId}/visibility/confirm`,{method:'POST'});const value=await response.json();if(!response.ok)throw new Error(value.error||'确认失败');setRecord(value);addLog('知识可见性已确认，推演已解锁')}catch(cause){addLog(`确认失败：${cause instanceof Error?cause.message:String(cause)}`)}finally{setConfirming(false)}}
  const goStep=(next:number)=>{const value=Math.min(5,Math.max(1,next));setStep(value);router.replace(`/worlds/${worldId}?step=${value}`,{scroll:false})}

  const status=record?.graphSyncStatus==='failed'?'error':record?.graphSyncStatus==='ready'?'ready':record?.graphSyncStatus==='processing'?'working':'idle'
  const tick=record?.snapshot?.tick||0; const agents=record?.snapshot?.agents?.npcs||[]
  const actionable=(ontology?.entityTypes||[]).filter((type:any)=>type.actionable).map((type:any)=>({id:type.name,name:type.displayName||type.name}))

  return <main className="mf-process">
    <header className="workspace-header">
      <button className="workspace-brand" onClick={()=>router.push('/')}><span aria-hidden="true"/>SEEDWORLD</button>
      <div className="workspace-title"><strong>{record?.title||'未命名作品'}</strong><span>{worldId.slice(0,8).toUpperCase()} · TICK {tick}</span></div>
      <div className="workspace-actions"><button onClick={()=>setGraphOpen((value)=>!value)}>{graphOpen?<PanelLeftClose size={15}/>:<PanelLeftOpen size={15}/>}<span>{graphOpen?'隐藏图谱':'显示图谱'}</span></button><div className={`sync-badge ${status}`}><i/>{status==='ready'?'图谱已同步':status==='working'?'正在抽取':status==='error'?'同步失败':'待建图'}</div></div>
    </header>

    <nav className="stage-nav" aria-label="作品流程">
      {STEPS.map(({name,short,icon:Icon},index)=>{const number=index+1;const active=step===number;const done=number<step;return <button key={name} className={`${active?'active ':''}${done?'done':''}`} onClick={()=>goStep(number)}><span className="stage-number">{done?'✓':String(number).padStart(2,'0')}</span><Icon size={15} strokeWidth={1.7}/><span className="stage-name">{name}</span><span className="stage-short">{short}</span></button>})}
    </nav>

    <section className={`workspace-body${graphOpen?' with-graph':''}`}>
      {graphOpen&&<div className="graph-column"><GraphView worldId={worldId} refreshKey={graphRefreshKey} building={record?.graphSyncStatus==='processing'} onRefresh={()=>{setGraphRefreshKey((key)=>key+1);void loadGraphStats()}} onToggleMaximize={()=>setGraphOpen(false)}/></div>}
      <div className="task-column">
        {step===1&&<StepGraphBuild world={record} ontology={ontology} job={job} graphStats={{...graphStats,types:ontology?.entityTypes?.length||0}} logs={logs} starting={starting} onStartExtraction={startExtraction} onNextStep={()=>goStep(2)}/>}
        {step===2&&<StepEnvSetup world={record} agents={agents} logs={logs} confirming={confirming} onConfirmVisibility={confirmVisibility} onNextStep={()=>goStep(3)} onGoBack={()=>goStep(1)}/>}
        {step===3&&<NovelStudioPanel worldId={worldId} tick={tick} onWorldUpdate={(next)=>{setRecord((current:any)=>current?{...current,snapshot:next}:current);setGraphRefreshKey((key)=>key+1)}}/>}
        {step===4&&<StepReport world={record} tick={tick} actionable={actionable} logs={logs} onLog={addLog}/>}
        {step===5&&<StepInteraction world={record} snapshot={record?.snapshot} logs={logs} onLog={addLog} onWorldUpdate={(next)=>{setRecord((current:any)=>current?{...current,snapshot:next}:current);setGraphRefreshKey((key)=>key+1)}}/>}
      </div>
    </section>

    <footer className="workspace-footer"><button onClick={()=>goStep(step-1)} disabled={step===1}><ChevronLeft size={15}/>上一步</button><div><CircleDot size={13}/><span>{STEPS[step-1].name}</span><i>{step}/5</i></div><button className="next" onClick={()=>goStep(step+1)} disabled={step===5}>下一步<ChevronRight size={15}/></button></footer>
  </main>
}
