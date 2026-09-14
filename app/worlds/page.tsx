'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { HistoryList } from '@/components/mf/history-list'
import '@/components/mf/mf-home.css'

export default function WorldsPage(){const router=useRouter();return <main className="mf-home library-page"><nav className="home-nav"><button className="wordmark" onClick={()=>router.push('/')}><span className="seed-mark"/>SEEDWORLD</button><div className="nav-actions"><button onClick={()=>router.push('/')}><ArrowLeft size={15}/>返回首页</button><button className="nav-create" onClick={()=>router.push('/worlds/new')}><Plus size={15}/>创建作品</button></div></nav><header className="library-hero"><h1>你的世界，<br/>都在继续发生。</h1><p>事实账本保存已发生的事，滚动主线决定下一章为何必须存在。</p></header><HistoryList/></main>}
