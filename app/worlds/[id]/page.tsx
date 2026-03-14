'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChatShell } from '@/components/chat/chat-shell'
import { PanelShell } from '@/components/panel/panel-shell'
import { AgentGeneratorPanel } from '@/components/panel/agent-generator-panel'
import { EventsPanel } from '@/components/panel/events-panel'
import { SimingPanel } from '@/components/panel/siming-panel'
import { HoutuPanel } from '@/components/panel/houtu-panel'
import { AgentObserverPanel } from '@/components/panel/agent-observer-panel'
import { createInitialWorldSlice } from '@/domain/world'
import { getWorld } from '@/store/worlds'
import { runWorldTick } from '@/engine/orchestrator'

export default function WorldDetailPage() {
  const params = useParams()
  const worldId = params.id as string
  
  const worldRecord = getWorld(worldId)
  const [world, setWorld] = React.useState<ReturnType<typeof createInitialWorldSlice> | null>(null)
  const [activeTab, setActiveTab] = React.useState<'world' | 'agents' | 'plots' | 'houtu' | 'observer' | 'events'>('world')
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
      const nextWorld = await runWorldTick(world)
      
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
    <main className="min-h-screen p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">World Slice</h1>
          <p className="mt-1 text-sm text-slate-600">{worldRecord.worldPrompt}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 自动推进控制 */}
          <div className="flex items-center gap-2 rounded border bg-white px-3 py-2">
            <label className="text-xs text-slate-600">推进:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={autoAdvanceTicks}
              onChange={(e) => setAutoAdvanceTicks(Math.max(1, parseInt(e.target.value) || 10))}
              className="w-16 rounded border px-2 py-1 text-xs"
              disabled={autoAdvancing}
            />
            <span className="text-xs text-slate-600">Ticks</span>
          </div>
          <button
            onClick={toggleAutoAdvance}
            disabled={!world || world.agents.npcs.length === 0 || advancing}
            className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              autoAdvancing 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
            title={world?.agents.npcs.length === 0 ? '需要先初始化世界' : ''}
          >
            {autoAdvancing ? '⏸️ 停止' : '▶️ 自动推进'}
          </button>
          <button
            onClick={handleAdvanceTime}
            disabled={advancing || !world || world.agents.npcs.length === 0 || autoAdvancing}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
            title={world?.agents.npcs.length === 0 ? '需要先初始化世界' : ''}
          >
            {advancing ? '推进中...' : `⏩ +1 Tick (当前 ${world?.tick || 0})`}
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
                activeTab === 'plots'
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab('plots')}
            >
              司命编织
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
          {activeTab === 'plots' && (
            <SimingPanel
              worldId={worldId}
              world={world}
              onWorldUpdate={setWorld}
            />
          )}
          {activeTab === 'houtu' && <HoutuPanel world={world} />}
          {activeTab === 'events' && <EventsPanel world={world} />}
        </div>
      </div>
    </main>
  )
}
