'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatShell } from '@/components/chat/chat-shell'
import { PanelShell } from '@/components/panel/panel-shell'
import { AgentGeneratorPanel } from '@/components/panel/agent-generator-panel'
import { EventsPanel } from '@/components/panel/events-panel'
import { NarrativePanel } from '@/components/panel/narrative-panel'
import { SocialNetworkPanel } from '@/components/panel/social-network-panel'
import { NarrativeTimelinePanel } from '@/components/panel/narrative-timeline-panel'
import { HoutuPanel } from '@/components/panel/houtu-panel'
import { AgentObserverPanel } from '@/components/panel/agent-observer-panel'
import { SystemStatsPanel } from '@/components/panel/system-stats-panel'
import { createInitialWorldSlice } from '@/domain/world'
import { getWorld } from '@/store/worlds'
import { runWorldTick } from '@/engine/orchestrator'

export default function WorldDetailPage() {
  const params = useParams()
  const router = useRouter()
  const worldId = params.id as string
  
  const worldRecord = getWorld(worldId)
  const [world, setWorld] = React.useState<ReturnType<typeof createInitialWorldSlice> | null>(null)
  const [activeTab, setActiveTab] = React.useState<'world' | 'agents' | 'narratives' | 'social' | 'timeline' | 'houtu' | 'observer' | 'events' | 'stats'>('world')
  const [advancing, setAdvancing] = React.useState(false)
  const [autoAdvancing, setAutoAdvancing] = React.useState(false)
  const [autoAdvanceTicks, setAutoAdvanceTicks] = React.useState<number>(10) // 推进多少个 tick

  React.useEffect(() => {
    if (worldRecord) {
      // Try to load world from localStorage
      const savedWorld = localStorage.getItem(`world_${worldId}`)
      if (savedWorld) {
        try {
          const world = JSON.parse(savedWorld)
          setWorld(world)
          console.log('Loaded world from localStorage:', world)
        } catch (error) {
          console.error('Failed to parse saved world:', error)
          // Fallback to initial world
          const initialWorld = createInitialWorldSlice()
          initialWorld.world_id = worldId
          setWorld(initialWorld)
        }
      } else {
        // Fallback to initial world if not found
        const initialWorld = createInitialWorldSlice()
        initialWorld.world_id = worldId
        setWorld(initialWorld)
      }
    }
  }, [worldId, worldRecord])

  const handleAdvanceTime = async () => {
    if (!world || advancing) return
    
    setAdvancing(true)
    try {
      console.log('Advancing time...')
      // 创建一个简单的 panguRegistry 来执行 NPC agents
      const panguRegistry = {
        runAll: async () => [] // 返回空数组，让 NPC agents 自己执行
      }
      
      const nextWorld = await runWorldTick(world, { panguRegistry })
      
      // Save to localStorage
      localStorage.setItem(`world_${worldId}`, JSON.stringify(nextWorld))
      
      // Update state
      setWorld(nextWorld)
      console.log('Time advanced to tick', nextWorld.tick)
    } catch (error) {
      console.error('Failed to advance time:', error)
      alert('推进时间失败: ' + (error as Error).message)
      setAutoAdvancing(false) // 出错时停止自动推进
    } finally {
      setAdvancing(false)
    }
  }

  // 自动推进效果 - 按 tick 数推进
  React.useEffect(() => {
    if (!autoAdvancing || !world || world.agents.npcs.length === 0) return

    let ticksAdvanced = 0
    const advanceNextTick = async () => {
      if (ticksAdvanced >= autoAdvanceTicks) {
        setAutoAdvancing(false)
        return
      }
      
      await handleAdvanceTime()
      ticksAdvanced++
      
      // 继续推进下一个 tick（延迟 500ms 让 UI 更新）
      if (ticksAdvanced < autoAdvanceTicks && autoAdvancing) {
        setTimeout(advanceNextTick, 500)
      }
    }

    advanceNextTick()

    // 清理函数
    return () => {
      ticksAdvanced = autoAdvanceTicks // 停止推进
    }
  }, [autoAdvancing])

  const toggleAutoAdvance = () => {
    setAutoAdvancing(!autoAdvancing)
  }

  if (!worldRecord) {
    return (
      <main className="min-h-screen p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">World not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The world you're looking for doesn't exist.
          </p>
        </div>
      </main>
    )
  }

  if (!world) {
    return (
      <main className="min-h-screen p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Loading world...</h1>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部控制栏 */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-lg shadow-sm">
        <div className="mx-auto max-w-7xl px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/worlds')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <span>←</span>
                <span className="hidden sm:inline">返回</span>
              </button>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">World Slice</h1>
                <p className="text-xs text-slate-600 line-clamp-1">{worldRecord.worldPrompt}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Tick 显示 */}
              <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <span className="text-xs font-medium text-slate-600">Tick</span>
                <span className="text-sm font-bold text-slate-900">{world?.tick || 0}</span>
              </div>
              
              {/* 自动推进控制 */}
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={autoAdvanceTicks}
                  onChange={(e) => setAutoAdvanceTicks(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-12 rounded border-slate-200 px-2 py-1 text-xs text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
                  disabled={autoAdvancing}
                />
                <span className="text-xs text-slate-600 hidden sm:inline">Ticks</span>
              </div>
              
              <button
                onClick={toggleAutoAdvance}
                disabled={!world || world.agents.npcs.length === 0 || advancing}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  autoAdvancing 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }`}
                title={world?.agents.npcs.length === 0 ? '需要先初始化世界' : ''}
              >
                <span>{autoAdvancing ? '⏸️' : '▶️'}</span>
                <span className="hidden sm:inline">{autoAdvancing ? '停止' : '自动'}</span>
              </button>
              
              <button
                onClick={handleAdvanceTime}
                disabled={advancing || !world || world.agents.npcs.length === 0 || autoAdvancing}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                title={world?.agents.npcs.length === 0 ? '需要先初始化世界' : ''}
              >
                <span>⏩</span>
                <span className="hidden sm:inline">{advancing ? '推进中...' : '+1 Tick'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="mx-auto max-w-7xl p-8">
        <div className="grid gap-6 lg:grid-cols-2">
        <ChatShell onWorldUpdate={setWorld} />
        <div>
          {/* Tab Navigation */}
          <div className="mb-4 flex gap-2 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'world'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('world')}
            >
              世界信息
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'observer'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('observer')}
            >
              🔍 Agent 观察
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'agents'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('agents')}
            >
              女娲造人
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'narratives'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('narratives')}
            >
              📖 涌现叙事
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'social'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('social')}
            >
              🕸️ 社交网络
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'timeline'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('timeline')}
            >
              ⏱️ 叙事时间线
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'houtu'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('houtu')}
            >
              后土轮回
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'events'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('events')}
            >
              事件日志
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'stats'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('stats')}
            >
              📊 系统统计
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'world' && <PanelShell world={world} />}
          {activeTab === 'observer' && <AgentObserverPanel world={world} />}
          {activeTab === 'agents' && (
            <AgentGeneratorPanel 
              worldId={worldId} 
              world={world}
              onWorldUpdate={setWorld}
            />
          )}
          {activeTab === 'narratives' && (
            <NarrativePanel world={world} />
          )}
          {activeTab === 'social' && (
            <SocialNetworkPanel world={world} />
          )}
          {activeTab === 'timeline' && (
            <NarrativeTimelinePanel world={world} />
          )}
          {activeTab === 'houtu' && <HoutuPanel world={world} />}
          {activeTab === 'events' && <EventsPanel world={world} />}
          {activeTab === 'stats' && <SystemStatsPanel world={world} />}
        </div>
      </div>
      </div>
    </main>
  )
}
