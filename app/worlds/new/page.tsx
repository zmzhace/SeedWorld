'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpenText, Check, FileText, Loader2, Settings2, Upload } from 'lucide-react'
import { createWorld as createLegacyMirror } from '@/store/worlds'
import './new-world.css'

type FormState={title:string;prompt:string;material:string;genre:string;audience:string;targetWords:number;pacing:'slow'|'balanced'|'fast'}
const initial:FormState={title:'',prompt:'',material:'',genre:'',audience:'',targetWords:2500,pacing:'balanced'}

export default function NewWorldPage(){
  const router=useRouter();const [form,setForm]=React.useState(initial);const [files,setFiles]=React.useState<File[]>([]);const [creating,setCreating]=React.useState(false);const [error,setError]=React.useState('');const [stage,setStage]=React.useState('')
  const set=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm((current)=>({...current,[key]:value}))
  async function submit(event:React.FormEvent){event.preventDefault();if(!form.prompt.trim()||creating)return;setCreating(true);setError('');try{setStage('创建作品空间');const createdResponse=await fetch('/api/worlds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:form.title||undefined,worldPrompt:form.prompt,writingSettings:{genre:form.genre,audience:form.audience,language:'zh',narration:'third_limited',targetWords:form.targetWords,pacing:form.pacing,chapterMode:'manual'}})});const created=await createdResponse.json();if(!createdResponse.ok)throw new Error(created.error||'创建失败');createLegacyMirror({id:created.id,worldPrompt:form.prompt});if(created.snapshot)localStorage.setItem(`world_${created.id}`,JSON.stringify(created.snapshot));setStage('保存并解析原始资料');const data=new FormData();data.set('text',[form.prompt,form.material].filter(Boolean).join('\n\n'));files.forEach((file)=>data.append('files',file));const sourceResponse=await fetch(`/api/worlds/${created.id}/sources`,{method:'POST',body:data});const source=await sourceResponse.json();if(!sourceResponse.ok)throw new Error(source.error||'资料处理失败');setStage('启动动态本体与图谱抽取');const extractResponse=await fetch(`/api/worlds/${created.id}/extractions`,{method:'POST'});const job=await extractResponse.json();if(!extractResponse.ok)throw new Error(job.error||'抽取启动失败');router.push(`/worlds/${created.id}?job=${job.id}&step=1`)}catch(cause){setError(cause instanceof Error?cause.message:String(cause));setCreating(false)}}
  return <main className="new-world"><header className="new-world-head"><button onClick={()=>router.push('/')}><ArrowLeft size={15}/>返回首页</button><strong>SEEDWORLD</strong></header><div className="new-world-shell">
    <section className="new-world-intro"><h1>建立一部<br/>可推演的作品。</h1><p>这里保存的不是一次性提示词，而是作品的长期底稿。系统会据此生成独立本体，而不把任何题材规则写死在平台里。</p></section>
    <form className="new-world-form" onSubmit={submit}><section className="world-materials"><h2 className="form-section-title"><BookOpenText size={17}/>作品底稿</h2>
      <Field label="作品名称" optional><input value={form.title} onChange={(event)=>set('title',event.target.value)} placeholder="可以稍后再定"/></Field>
      <Field label="核心世界与冲突"><textarea required rows={7} value={form.prompt} onChange={(event)=>set('prompt',event.target.value)} placeholder="说清世界如何运转、各方为何冲突，以及你想观察什么。"/></Field>
      <Field label="补充设定" optional><textarea rows={9} value={form.material} onChange={(event)=>set('material',event.target.value)} placeholder="人物、势力、历史、规则、谣言、未公开秘密……"/></Field>
      <label className="file-picker"><Upload size={17}/>{files.length?`已选择 ${files.length} 份资料`:'选择资料文件'}<span>PDF / MD / TXT</span><input type="file" multiple accept=".pdf,.md,.markdown,.txt,text/plain,application/pdf" hidden onChange={(event)=>setFiles(Array.from(event.target.files||[]))}/></label>
    </section><aside className="world-settings"><h2 className="form-section-title"><Settings2 size={17}/>写作默认值</h2><p className="setting-note">这些参数只影响本作品的成章方式，之后仍可修改和版本化。</p>
      <Field label="题材" optional><input value={form.genre} onChange={(event)=>set('genre',event.target.value)} placeholder="留空则自动识别"/></Field><Field label="目标读者" optional><input value={form.audience} onChange={(event)=>set('audience',event.target.value)} placeholder="例如：快节奏网文读者"/></Field><Field label="单章目标字数"><input type="number" min={800} max={10000} value={form.targetWords} onChange={(event)=>set('targetWords',Number(event.target.value))}/></Field><Field label="默认节奏"><select value={form.pacing} onChange={(event)=>set('pacing',event.target.value as FormState['pacing'])}><option value="slow">舒缓</option><option value="balanced">均衡</option><option value="fast">快速</option></select></Field>
      {error&&<div className="creation-error" role="alert"><FileText size={15}/>{error}</div>}{creating&&<div className="creation-progress"><Loader2 className="nw-spin" size={15}/><span>{stage}<br/>进入作品后会继续显示真实阶段。</span></div>}
      <button className="submit-world" disabled={creating||!form.prompt.trim()}><span>{creating?'正在创建……':'创建并抽取图谱'}</span><ArrowRight size={16}/></button>
      <div className="create-principles"><div><Check size={13}/>原文与来源保留</div><div><Check size={13}/>同内容不重复提交</div><div><Check size={13}/>导入批次可撤销</div></div>
    </aside></form>
  </div></main>
}
function Field({label,optional,children}:{label:string;optional?:boolean;children:React.ReactNode}){return <label className="nw-field"><span>{label}{optional&&<small>可选</small>}</span>{children}</label>}
