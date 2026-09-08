'use client'

import React from 'react'
import { CheckCircle2, Clipboard, FileCheck2, PenTool, TriangleAlert } from 'lucide-react'
import './mf-workbench.css'

type Props={world:any;tick:number;actionable:Array<{id:string;name:string}>;logs:Array<{time:string;msg:string}>;onLog:(msg:string)=>void}

export function StepReport({world,tick,actionable,logs,onLog}:Props){
  const [tickFrom,setTickFrom]=React.useState(0);const [pov,setPov]=React.useState('');const [goal,setGoal]=React.useState('')
  const [busy,setBusy]=React.useState(false);const [chapter,setChapter]=React.useState<any>(null);const [error,setError]=React.useState('');const logRef=React.useRef<HTMLDivElement>(null)
  React.useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight},[logs.length])
  const generate=async()=>{setBusy(true);setError('');try{onLog(`正在组织 Tick ${tickFrom}–${tick} 的章节素材`);const response=await fetch(`/api/worlds/${world.id}/chapters`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tickFrom,tickTo:tick,povEntityId:pov||undefined,goal:goal||undefined})});const value=await response.json();if(!response.ok)throw new Error(value.error||'生成失败');setChapter(value);onLog(`章节已落盘：${value.title}`)}catch(cause){const message=cause instanceof Error?cause.message:String(cause);setError(message);onLog(`成章失败：${message}`)}finally{setBusy(false)}}
  const issues:any[]=chapter?.validation?.issues||[]
  return <div className="mf-workbench workbench-panel"><div className="scroll-container">
    <div className="step-card active"><div className="card-header"><div className="step-info"><PenTool size={16}/><span className="step-title">章节编排</span></div><span className={`badge ${busy?'processing':'pending'}`}>{busy?'策划 · 写作 · 校验':'手动成章'}</span></div>
      <p className="api-note">SELECT TICKS → PLAN → DRAFT → VALIDATE → REVISE</p><p className="description">只把这一章需要的事件交给写作模型。默认使用单章有限视角，不在开篇倾倒全部设定。</p>
      <div className="chapter-form"><label><span>起始 Tick</span><input type="number" min={0} max={tick} value={tickFrom} onChange={(event)=>setTickFrom(Number(event.target.value))}/></label><label><span>限定视角</span><select value={pov} onChange={(event)=>setPov(event.target.value)}><option value="">由章节引擎选择</option>{actionable.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label className="goal-field"><span>本章目标 <small>可选</small></span><input value={goal} onChange={(event)=>setGoal(event.target.value)} placeholder="例如：让读者发现每次战斗后偶像都会陷入丑闻"/></label><button className="action-btn" disabled={busy||tick<tickFrom||!world?.visibilityConfirmed} onClick={generate}>{busy?'正在经过五步写作流程……':`生成 Tick ${tickFrom}–${tick} 章节`}</button></div>
      {error&&<div className="chapter-alert error" role="alert"><TriangleAlert size={15}/><span><strong>没有生成章节</strong>{error}</span></div>}
    </div>
    <div className="step-card"><div className="card-header"><div className="step-info"><FileCheck2 size={16}/><span className="step-title">逻辑校验</span></div>{chapter&&<span className={`badge ${chapter.validation?.passed?'success':'processing'}`}>{chapter.validation?.passed?'通过':'已修订'}</span>}</div>
      {!chapter?<p className="description">章节生成后，这里会列出越权知识、时空冲突、死亡角色行动与能力代价缺失等检查结果。</p>:issues.length===0?<div className="chapter-alert success"><CheckCircle2 size={16}/><span><strong>未发现硬性逻辑冲突</strong>正文与当前可见事实、时间线和世界规则相容。</span></div>:<div className="validation-list">{issues.map((issue,index)=><div key={index}><TriangleAlert size={14}/><span><strong>{issue.severity==='error'?'错误':'提醒'}</strong>{issue.message}</span></div>)}</div>}
    </div>
    <div className="step-card chapter-output"><div className="card-header"><div className="step-info"><span className="step-num">MD</span><span className="step-title">{chapter?.title||'正文预览'}</span></div>{chapter&&<><button className="copy-chapter" onClick={()=>void navigator.clipboard.writeText(chapter.markdown)}><Clipboard size={13}/>复制 Markdown</button><button className="copy-chapter" onClick={()=>{const blob=new Blob([chapter.markdown],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${chapter.title}.txt`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}}>导出 TXT</button></>}</div>{chapter?<article>{chapter.markdown}</article>:<div className="chapter-placeholder">章节文件将按作品独立保存，可以后续重新生成和恢复版本。</div>}</div>
  </div><div className="system-logs"><div className="log-header"><span>WRITING PIPELINE</span><span>{world?.id?.slice(0,8)||'NO_WORLD'}</span></div><div className="log-content" ref={logRef}>{logs.map((log,index)=><div className="log-line" key={index}><span className="log-time">{log.time}</span><span className="log-msg">{log.msg}</span></div>)}</div></div></div>
}
