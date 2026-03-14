'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChatShell } from '@/components/chat/chat-shell'
import { PanelShell } from '@/components/panel/panel-shell'
import { AgentGeneratorPanel } from '@/components/panel/agent-generator-panel'
import { EventsPanel } from '@/components/panel/events-panel'
import { SimingPanel } from '@/components/panel/siming-panel'
import { HoutuPanel } from '@/components/panel/houtu-panel'
import { createInitialWorldSlice } from '@/domain/world'
import { getWorld } from '@/store/worlds'
import { runWorldTick } from '@/engine/orchestrator'

export default function WorldDetailPage() {
  const params = useParams()
  const worldId = params.id as string
  
  const worldRecord = getWorld(worldId)
  const [world, setWorld] = React.useState<ReturnType<typeof createInitialWorldSlice> | null>(null)
  const [activeTab, setActiveTab] = React.useState<'world' | 'agents' | 'plots' | 'houtu' | 'events'>('world')
  const [advancing, setAdvancing] = React.useState(false)

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
    } finally {
      setAdvancing(false)
    }
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
        <button
          onClick={handleAdvanceTime}
          disabled={advancing || !world || world.agents.npcs.length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
          title={world?.agents.npcs.length === 0 ? '需要先初始化世界（女娲造人 + 司命编织）' : ''}
        >
          {advancing ? '推进中...' : `⏩ 推进时间 (Tick ${world?.tick || 0})`}
        </button>
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
