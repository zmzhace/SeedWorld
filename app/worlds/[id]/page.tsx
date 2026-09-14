'use client'

import React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Library, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react'
import '@/components/mf/mf-process.css'
import { GraphView } from '@/components/mf/graph-view'
import { StepGraphBuild } from '@/components/mf/step-graph-build'
import { StepEnvSetup } from '@/components/mf/step-env-setup'
import { ChapterLibraryPanel } from '@/components/mf/chapter-library-panel'
import { NovelStudioPanel } from '@/components/panel/novel-studio-panel'

type WorkspaceView = 'write' | 'settings' | 'chapters'
const WORKSPACES:Array<{id:WorkspaceView;name:string;short:string;icon:typeof BookOpen}> = [
  { id:'write', name:'创作台', short:'创作', icon:BookOpen },
  { id:'settings', name:'设定库', short:'设定', icon:Settings2 },
  { id:'chapters', name:'章节库', short:'章节', icon:Library },
]

export default function WorldWorkspacePage() {
  const params=useParams(); const router=useRouter(); const searchParams=useSearchParams(); const worldId=String(params.id||'')
  const [view,setView]=React.useState<WorkspaceView>(()=>{
    const explicit=searchParams.get('view') as WorkspaceView|null
    if (explicit&&WORKSPACES.some((item)=>item.id===explicit)) return explicit
    const legacy=Number(searchParams.get('step')||3)
    return legacy===1||legacy===2?'settings':legacy===4?'chapters':'write'
  })
  const [settingsSection,setSettingsSection]=React.useState<'material'|'knowledge'>(()=>Number(searchParams.get('step'))===2?'knowledge':'material')
  const [graphOpen,setGraphOpen]=React.useState(false)
  const [record,setRecord]=React.useState<any>(null); const [ontology,setOntology]=React.useState<any>(null)
  const [graphStats,setGraphStats]=React.useState({nodes:0,edges:0,types:0}); const [job,setJob]=React.useState<any>(null)
  const [starting,setStarting]=React.useState(false); const [confirming,setConfirming]=React.useState(false)
  const [logs,setLogs]=React.useState<Array<{time:string;msg:string}>>([]); const [graphRefreshKey,setGraphRefreshKey]=React.useState(0)

  const addLog=React.useCallback((msg:string)=>setLogs((lines)=>[...lines.slice(-99),{time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),msg}]),[])
  const loadRecord=React.useCallback(async()=>{const response=await fetch(`/api/worlds/${worldId}`);if(response.ok){const data=await response.json();setRecord(data);return data}return null},[worldId])
  const loadOntology=React.useCallback(async()=>{const response=await fetch(`/api/worlds/${worldId}/ontology`);setOntology(response.ok?await response.json():null)},[worldId])
  const loadGraphStats=React.useCallback(async()=>{try{const response=await fetch(`/api/worlds/${worldId}/archive?limit=200`);const data=await response.json();setGraphStats({nodes:(data.entities||[]).length,edges:(data.claims||[]).length,types:ontology?.entityTypes?.length||0})}catch{}},[worldId,ontology?.entityTypes?.length])

  React.useEffect(()=>{addLog('作品工作台已载入');void loadRecord().then(()=>{void loadOntology();void loadGraphStats()})},[worldId]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(()=>{const id=searchParams.get('job');if(id)void fetch(`/api/jobs/${id}`).then((r)=>(r.ok?r.json():null)).then((value)=>value&&setJob(value))},[]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(()=>{
    if(!job||['completed','failed','rolled_back'].includes(job.status)){if(job?.status==='completed'){addLog(job.message||'世界档案编译完成');void loadRecord();void loadOntology();void loadGraphStats();setGraphRefreshKey((key)=>key+1)}else if(job?.status==='failed')addLog(`资料编译失败：${job.error||job.message}`);return}
    const timer=window.setInterval(async()=>{const response=await fetch(`/api/jobs/${job.id}`);if(response.ok){const next=await response.json();if(next.message!==job.message)addLog(next.message);setJob(next)}},2500);return()=>window.clearInterval(timer)
  },[job?.id,job?.status,job?.message]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startExtraction(){setStarting(true);try{addLog('开始生成动态本体');const response=await fetch(`/api/worlds/${worldId}/extractions`,{method:'POST'});const value=await response.json();if(!response.ok)throw new Error(value.error||'启动失败');setJob(value)}catch(cause){addLog(`启动失败：${cause instanceof Error?cause.message:String(cause)}`)}finally{setStarting(false)}}
  async function confirmVisibility(){setConfirming(true);try{const response=await fetch(`/api/worlds/${worldId}/visibility/confirm`,{method:'POST'});const value=await response.json();if(!response.ok)throw new Error(value.error||'确认失败');setRecord(value);addLog('知识可见性已确认，推演已解锁')}catch(cause){addLog(`确认失败：${cause instanceof Error?cause.message:String(cause)}`)}finally{setConfirming(false)}}
  const goView=(next:WorkspaceView)=>{setView(next);if(next!=='settings')setGraphOpen(false);const query=new URLSearchParams(searchParams.toString());query.delete('step');query.set('view',next);router.replace(`/worlds/${worldId}?${query.toString()}`,{scroll:false})}

  const status=record?.archiveStatus==='error'?'error':record?.archiveStatus==='ready'?'ready':record?.archiveStatus==='extracting'?'working':'idle'
  const tick=record?.snapshot?.tick||0; const agents=record?.snapshot?.agents?.npcs||[]
  return <main className="mf-process">
    <header className="workspace-header">
      <button className="workspace-brand" onClick={()=>router.push('/')}><span aria-hidden="true"/>SEEDWORLD</button>
      <div className="workspace-title"><strong>{record?.title||'未命名作品'}</strong><span>{worldId.slice(0,8).toUpperCase()} · TICK {tick}</span></div>
      <div className="workspace-actions">{view==='settings'&&<button aria-label={graphOpen?'隐藏关系视图':'显示关系视图'} onClick={()=>setGraphOpen((value)=>!value)}>{graphOpen?<PanelLeftClose size={15}/>:<PanelLeftOpen size={15}/>}<span>{graphOpen?'隐藏关系视图':'显示关系视图'}</span></button>}<div className={`sync-badge ${status}`}><i/>{status==='ready'?'资料已整理':status==='working'?'正在整理':status==='error'?'整理失败':'资料待整理'}</div></div>
    </header>

    <nav className="stage-nav" aria-label="作品工作区">
      {WORKSPACES.map(({id,name,short,icon:Icon})=><button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>goView(id)}><Icon size={16} strokeWidth={1.7}/><span className="stage-name">{name}</span><span className="stage-short">{short}</span></button>)}
    </nav>

    <section className={`workspace-body${graphOpen&&view==='settings'?' with-graph':''}`}>
      {graphOpen&&view==='settings'&&<div className="graph-column"><GraphView worldId={worldId} refreshKey={graphRefreshKey} building={record?.archiveStatus==='extracting'} onRefresh={()=>{setGraphRefreshKey((key)=>key+1);void loadGraphStats()}} onToggleMaximize={()=>setGraphOpen(false)}/></div>}
      <div className="task-column">
        {view==='write'&&<NovelStudioPanel worldId={worldId} tick={tick} onWorldUpdate={(next)=>{setRecord((current:any)=>current?{...current,snapshot:next}:current);setGraphRefreshKey((key)=>key+1)}}/>}
        {view==='settings'&&<><nav className="workspace-subnav" aria-label="设定库分类"><button className={settingsSection==='material'?'active':''} onClick={()=>setSettingsSection('material')}>资料与规则</button><button className={settingsSection==='knowledge'?'active':''} onClick={()=>setSettingsSection('knowledge')}>秘密与认知</button></nav><div className="workspace-panel-slot">{settingsSection==='material'?<StepGraphBuild world={record} ontology={ontology} job={job} graphStats={{...graphStats,types:ontology?.entityTypes?.length||0}} logs={logs} starting={starting} onStartExtraction={startExtraction} onNextStep={()=>setSettingsSection('knowledge')}/>:<StepEnvSetup world={record} agents={agents} logs={logs} confirming={confirming} onConfirmVisibility={confirmVisibility} onNextStep={()=>goView('write')} onGoBack={()=>setSettingsSection('material')} onAgentsChanged={()=>{void loadRecord()}}/>}</div></>}
        {view==='chapters'&&<ChapterLibraryPanel worldId={worldId}/>}
      </div>
    </section>
  </main>
}
