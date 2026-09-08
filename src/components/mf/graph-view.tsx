'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Layers3, Maximize2, RefreshCw, X } from 'lucide-react'
import './mf-graph.css'

const ForceGraph2D=dynamic(()=>import('react-force-graph-2d'),{ssr:false})
const COLORS=['#ed5a29','#236f8f','#7a4c93','#36815e','#b8413b','#af6a28','#4d67a7','#8b566e','#587550','#725d40']
type Props={worldId:string;refreshKey:number;building:boolean;onRefresh:()=>void;onToggleMaximize:()=>void}

export function GraphView({worldId,refreshKey,building,onRefresh,onToggleMaximize}:Props){
  const [nodes,setNodes]=React.useState<any[]>([]);const [links,setLinks]=React.useState<any[]>([]);const [types,setTypes]=React.useState<Array<{name:string;color:string;count:number}>>([])
  const [loading,setLoading]=React.useState(false);const [selected,setSelected]=React.useState<any>(null);const [layer,setLayer]=React.useState<'all'|'source'|'evolution'>('all')
  const [size,setSize]=React.useState({width:640,height:500});const viewRef=React.useRef<HTMLDivElement>(null)
  const colorOf=React.useCallback((type:string)=>{let hash=0;for(let i=0;i<type.length;i++)hash=(hash*31+type.charCodeAt(i))>>>0;return COLORS[hash%COLORS.length]},[])
  const load=React.useCallback(async()=>{setLoading(true);try{const suffix=layer==='all'?'':`&layer=${layer}`;const response=await fetch(`/api/worlds/${worldId}/graph?limit=200${suffix}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'图谱读取失败');const entities:any[]=data.entities||[];const facts:any[]=data.facts||[];const counts:Record<string,number>={};entities.forEach((entity)=>{counts[entity.type]=(counts[entity.type]||0)+1});setTypes(Object.entries(counts).map(([name,count])=>({name,color:colorOf(name),count})));const ids=new Set(entities.map((entity)=>entity.id));setNodes(entities.map((entity)=>({id:entity.id,name:entity.name,type:entity.type,color:colorOf(entity.type),raw:entity})));setLinks(facts.filter((fact)=>ids.has(fact.subject_id)&&fact.object_id&&ids.has(fact.object_id)).map((fact)=>({source:fact.subject_id,target:fact.object_id,label:fact.predicate,raw:fact})))}catch{}finally{setLoading(false)}},[worldId,layer,colorOf])
  React.useEffect(()=>{void load()},[load,refreshKey])
  React.useEffect(()=>{const element=viewRef.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.max(320,Math.floor(entry.contentRect.width)),height:Math.max(300,Math.floor(entry.contentRect.height))}));observer.observe(element);return()=>observer.disconnect()},[])

  return <div className="mf-graph">
    <div className="graph-toolbar"><div><Layers3 size={15}/><strong>世界图谱</strong><span>{nodes.length} 节点 · {links.length} 关系</span></div><div className="graph-tools"><div className="layer-switch" aria-label="图谱层"><button className={layer==='all'?'active':''} onClick={()=>setLayer('all')}>全部</button><button className={layer==='source'?'active':''} onClick={()=>setLayer('source')}>Source</button><button className={layer==='evolution'?'active':''} onClick={()=>setLayer('evolution')}>Evolution</button></div><button aria-label="刷新图谱" onClick={()=>{onRefresh();void load()}} disabled={loading}><RefreshCw size={14} className={loading?'spin':''}/></button><button aria-label="隐藏图谱" onClick={onToggleMaximize}><Maximize2 size={14}/></button></div></div>
    <div className="graph-canvas" ref={viewRef}><ForceGraph2D width={size.width} height={size.height} graphData={{nodes,links}} nodeLabel={(node:any)=>`${node.name} · ${node.type}`} nodeColor={(node:any)=>node.color} nodeRelSize={5} linkColor={()=>layer==='evolution'?'#e6a28a':'#ccc9c1'} linkDirectionalArrowLength={3.5} linkDirectionalArrowRelPos={1} backgroundColor="#f8f7f3" onNodeClick={(node:any)=>setSelected({kind:'node',data:node.raw,color:node.color})} onLinkClick={(link:any)=>setSelected({kind:'fact',data:link.raw})} onBackgroundClick={()=>setSelected(null)}/>
      {building&&<div className="graph-building"><RefreshCw size={16} className="spin"/>正在接收 Zep 抽取结果……</div>}
      {!building&&!loading&&nodes.length===0&&<div className="graph-empty"><Layers3 size={30} strokeWidth={1.3}/><strong>图谱还是空的</strong><span>在右侧启动资料抽取后，节点与关系会逐步出现。</span></div>}
      {selected&&<aside className="graph-detail"><div className="graph-detail-head"><div><span>{selected.kind==='node'?'实体':'事实'}</span><strong>{selected.kind==='node'?selected.data.name:selected.data.predicate}</strong></div><button aria-label="关闭详情" onClick={()=>setSelected(null)}><X size={14}/></button></div>{selected.kind==='node'?<><dl><div><dt>类型</dt><dd>{selected.data.type}</dd></div><div><dt>图层</dt><dd>{selected.data.graph_layer}</dd></div><div><dt>状态</dt><dd>{selected.data.status}</dd></div></dl><p>{String(selected.data.properties?.summary||selected.data.properties?.description||'暂无摘要')}</p></>:<dl><div><dt>关系</dt><dd>{selected.data.predicate}</dd></div><div><dt>认知层</dt><dd>{selected.data.claim_scope}</dd></div><div><dt>图层</dt><dd>{selected.data.graph_layer}</dd></div></dl>}</aside>}
    </div>
    {types.length>0&&<div className="graph-legend">{types.slice(0,8).map((type)=><span key={type.name}><i style={{background:type.color}}/>{type.name}<b>{type.count}</b></span>)}</div>}
  </div>
}
