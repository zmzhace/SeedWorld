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
import { SnapshotTimelinePanel } from '@/components/snapshot-timeline-panel'
import { createInitialWorldSlice } from '@/domain/world'
import { getWorld } from '@/store/worlds'
import { runWorldTick } from '@/engine/orchestrator'
import { SnapshotManager } from '@/engine/snapshot-manager'
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  Clock,
  Globe,
  Users,
  UserPlus,
  BookOpen,
  Share2,
  Calendar,
  RefreshCw,
  Scroll,
  BarChart3,
  Pencil,
  Camera,
} from 'lucide-react'

const TABS = [
  { key: 'world', label: 'World', icon: Globe },
  { key: 'observer', label: 'Agents', icon: Users },
  { key: 'agents', label: 'Create', icon: UserPlus },
  { key: 'narratives', label: 'Narrative', icon: BookOpen },
  { key: 'social', label: 'Network', icon: Share2 },
  { key: 'timeline', label: 'Timeline', icon: Calendar },
  { key: 'houtu', label: 'Life Cycle', icon: RefreshCw },
  { key: 'events', label: 'Events', icon: Scroll },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'snapshots', label: 'Snapshots', icon: Camera },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function WorldDetailPage() {
  const params = useParams()
  const router = useRouter()
  const worldId = params.id as string

  const [worldRecord, setWorldRecord] = React.useState<ReturnType<typeof getWorld> | undefined>(undefined)
  const [world, setWorld] = React.useState<ReturnType<typeof createInitialWorldSlice> | null>(null)
  const [activeTab, setActiveTab] = React.useState<TabKey>('world')
  const [advancing, setAdvancing] = React.useState(false)
  const [autoAdvancing, setAutoAdvancing] = React.useState(false)
  const [autoAdvanceTicks, setAutoAdvanceTicks] = React.useState<number>(10)

  // Snapshot manager
  const [snapshotManager] = React.useState(() => new SnapshotManager(worldId))

  // Inline editing state for title and summary
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [editingSummary, setEditingSummary] = React.useState(false)
  const [titleValue, setTitleValue] = React.useState('')
  const [summaryValue, setSummaryValue] = React.useState('')

  // Sync editing values when world loads or changes
  React.useEffect(() => {
    if (world) {
      setTitleValue(world.title || '')
      setSummaryValue(world.summary || '')
    }
  }, [world?.title, world?.summary])

  const saveWorldField = (field: 'title' | 'summary', value: string) => {
    if (!world) return
    const updated = { ...world, [field]: value }
    setWorld(updated)
    localStorage.setItem(`world_${worldId}`, JSON.stringify(updated))
  }

  React.useEffect(() => {
    setWorldRecord(getWorld(worldId))
  }, [worldId])

  React.useEffect(() => {
    if (worldRecord) {
      const savedWorld = localStorage.getItem(`world_${worldId}`)
      if (savedWorld) {
        try {
          const world = JSON.parse(savedWorld)
          setWorld(world)
          console.log('Loaded world from localStorage:', world)
        } catch (error) {
          console.error('Failed to parse saved world:', error)
          const initialWorld = createInitialWorldSlice()
          initialWorld.world_id = worldId
          setWorld(initialWorld)
        }
      } else {
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
      const directorRegistry = {
        runAll: async () => []
      }

      const nextWorld = await runWorldTick(world, { directorRegistry })

      localStorage.setItem(`world_${worldId}`, JSON.stringify(nextWorld))

      setWorld(nextWorld)
      console.log('Time advanced to tick', nextWorld.tick)
    } catch (error) {
      console.error('Failed to advance time:', error)
      alert('Failed to advance time: ' + (error as Error).message)
      setAutoAdvancing(false)
    } finally {
      setAdvancing(false)
    }
  }

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

      if (ticksAdvanced < autoAdvanceTicks && autoAdvancing) {
        setTimeout(advanceNextTick, 500)
      }
    }

    advanceNextTick()

    return () => {
      ticksAdvanced = autoAdvanceTicks
    }
  }, [autoAdvancing])

  const toggleAutoAdvance = () => {
    setAutoAdvancing(!autoAdvancing)
  }

  const handleManualSnapshot = () => {
    if (!world) return

    const label = window.prompt('Enter a label for this snapshot (optional):', '')
    if (label === null) return // User cancelled

    try {
      snapshotManager.createSnapshot(world, 'manual', label || undefined)
      console.log('Manual snapshot created')
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      alert('Failed to create snapshot: ' + (error as Error).message)
    }
  }

  const handleRestoreSnapshot = (snapshotId: string) => {
    try {
      const restoredWorld = snapshotManager.restoreSnapshot(snapshotId)
      if (!restoredWorld) {
        alert('Failed to restore snapshot')
        return
      }

      // Update React state
      setWorld(restoredWorld)

      // Update localStorage
      localStorage.setItem(`world_${worldId}`, JSON.stringify(restoredWorld))

      console.log('Snapshot restored to tick', restoredWorld.tick)
    } catch (error) {
      console.error('Failed to restore snapshot:', error)
      alert('Failed to restore snapshot: ' + (error as Error).message)
    }
  }

  // --- Loading / Not Found states ---

  if (!worldRecord) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-800">
            {worldRecord === undefined ? 'Loading world...' : 'World not found'}
          </h1>
          {worldRecord === null && (
            <p className="mt-2 text-sm text-slate-500">
              The world you are looking for does not exist.
            </p>
          )}
        </div>
      </main>
    )
  }

  if (!world) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Loading world...</h1>
        </div>
      </main>
    )
  }

  // --- Main render ---

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-slate-800">
      {/* ===== Header / Top Bar ===== */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: back + title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/worlds')}
                className="flex items-center justify-center rounded-xl p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="h-6 w-px bg-slate-200" />

              <div className="min-w-0">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false)
                      saveWorldField('title', titleValue)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingTitle(false)
                        saveWorldField('title', titleValue)
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false)
                        setTitleValue(world?.title || '')
                      }
                    }}
                    className="w-full truncate text-lg font-bold text-slate-800 bg-transparent border-b border-blue-400 outline-none px-0 py-0"
                  />
                ) : (
                  <h1
                    className="group/title flex items-center gap-1.5 truncate text-lg font-bold text-slate-800 cursor-pointer"
                    onClick={() => setEditingTitle(true)}
                  >
                    <span className="truncate">{world?.title || 'World Slice'}</span>
                    <Pencil className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                  </h1>
                )}
                {editingSummary ? (
                  <input
                    autoFocus
                    value={summaryValue}
                    onChange={(e) => setSummaryValue(e.target.value)}
                    onBlur={() => {
                      setEditingSummary(false)
                      saveWorldField('summary', summaryValue)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingSummary(false)
                        saveWorldField('summary', summaryValue)
                      } else if (e.key === 'Escape') {
                        setEditingSummary(false)
                        setSummaryValue(world?.summary || '')
                      }
                    }}
                    className="w-full truncate text-xs text-slate-500 bg-transparent border-b border-blue-400 outline-none px-0 py-0 mt-0.5 max-w-[260px]"
                  />
                ) : (
                  <p
                    className="group/summary flex items-center gap-1 truncate text-xs text-slate-500 max-w-[260px] cursor-pointer mt-0.5"
                    onClick={() => setEditingSummary(true)}
                  >
                    <span className="truncate">{world?.summary || worldRecord.worldPrompt}</span>
                    <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover/summary:opacity-100 transition-opacity shrink-0" />
                  </p>
                )}
              </div>
            </div>

            {/* Right: tick controls */}
            <div className="flex items-center gap-2">
              {/* Manual Snapshot Button */}
              <button
                onClick={handleManualSnapshot}
                disabled={!world}
                data-testid="manual-snapshot-button"
                className="flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3.5 py-1.5 text-sm font-medium text-purple-600 transition-all duration-200 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Create manual snapshot"
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snapshot</span>
              </button>

              {/* Tick badge */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">Tick</span>
                <span className="min-w-[1.5rem] text-center text-sm font-bold text-slate-800">
                  {world?.tick || 0}
                </span>
              </div>

              {/* Auto-advance tick count */}
              <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={autoAdvanceTicks}
                  onChange={(e) => setAutoAdvanceTicks(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-10 rounded bg-transparent px-1 py-0.5 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  disabled={autoAdvancing}
                />
                <span className="text-xs text-slate-400 hidden sm:inline">ticks</span>
              </div>

              {/* Auto-advance toggle */}
              <button
                onClick={toggleAutoAdvance}
                disabled={!world || world.agents.npcs.length === 0 || advancing}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  autoAdvancing
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {autoAdvancing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{autoAdvancing ? 'Stop' : 'Auto'}</span>
              </button>

              {/* Single tick advance */}
              <button
                onClick={handleAdvanceTime}
                disabled={advancing || !world || world.agents.npcs.length === 0 || autoAdvancing}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-sm font-medium text-blue-600 transition-all duration-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{advancing ? 'Running...' : '+1 Tick'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tick Summary / Chronicle ===== */}
      {world.tick_summary && (
        <div className="mx-auto max-w-7xl px-6 pt-5">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm border-l-4 border-l-blue-500">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-base font-semibold text-slate-800">
                Tick {world.tick}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="text-base leading-relaxed text-slate-600 whitespace-pre-line">
              {world.tick_summary}
            </div>
          </div>
        </div>
      )}

      {/* ===== Main Content ===== */}
      <div className="mx-auto max-w-7xl p-6">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Chat column */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <ChatShell
                world={world}
                onWorldUpdate={(updatedWorld) => {
                  setWorld(updatedWorld)
                  localStorage.setItem(`world_${worldId}`, JSON.stringify(updatedWorld))
                }}
              />
            </div>
          </div>

          {/* Tabs column */}
          <div className="lg:col-span-7">
            {/* Tab Navigation */}
            <div className="mb-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    activeTab === key
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {activeTab === 'world' && <PanelShell world={world} />}
              {activeTab === 'observer' && <AgentObserverPanel world={world} />}
              {activeTab === 'agents' && (
                <AgentGeneratorPanel
                  worldId={worldId}
                  world={world}
                  onWorldUpdate={setWorld}
                />
              )}
              {activeTab === 'narratives' && <NarrativePanel world={world} />}
              {activeTab === 'social' && <SocialNetworkPanel world={world} />}
              {activeTab === 'timeline' && <NarrativeTimelinePanel world={world} />}
              {activeTab === 'houtu' && <HoutuPanel world={world} />}
              {activeTab === 'events' && <EventsPanel world={world} />}
              {activeTab === 'stats' && <SystemStatsPanel world={world} />}
              {activeTab === 'snapshots' && (
                <div className="p-6">
                  <SnapshotTimelinePanel
                    worldId={worldId}
                    onRestore={handleRestoreSnapshot}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
