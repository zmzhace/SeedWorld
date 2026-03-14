import React from 'react'
import type { WorldSlice } from '@/domain/world'
import type { PlotArc } from '@/domain/siming'

type SimingPanelProps = {
  worldId: string
  world: WorldSlice
  onWorldUpdate?: (world: WorldSlice) => void
}

export function SimingPanel({ worldId, world, onWorldUpdate }: SimingPanelProps) {
  const [generating, setGenerating] = React.useState(false)
  const [plotType, setPlotType] = React.useState<'main' | 'side'>('main')
  const [coordinationLog, setCoordinationLog] = React.useState<string[]>([])
  const [showLog, setShowLog] = React.useState(false)

  const handleGeneratePlot = async () => {
    if (generating) return

    setGenerating(true)
    setCoordinationLog([])
    setShowLog(true)
    
    try {
      const genesisEvent = world.events.find(e => e.type === 'world_created')
      const worldContext = {
        environment: world.environment.description,
        social_context: world.social_context,
        narrative_seed: genesisEvent?.payload?.narrative_seed || '',
      }

      // 使用协同系统
      const response = await fetch('/api/plots/coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldContext,
          existingAgents: world.agents.npcs,
          plotType,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate plot')
      }

      const data = await response.json()
      console.log('Plot coordinated:', data)
      
      setCoordinationLog(data.coordination_log || [])

      // 更新世界：添加剧情和新 agents
      const updatedWorld: WorldSlice = {
        ...world,
        plots: [...world.plots, data.plot],
        agents: {
          ...world.agents,
          npcs: [...world.agents.npcs, ...data.newAgents],
        },
        events: [
          ...world.events,
          {
            id: `siming-${world.tick}-${Date.now()}`,
            type: 'plot_created',
            timestamp: new Date().toISOString(),
            payload: {
              plot_id: data.plot.id,
              plot_title: data.plot.title,
              plot_type: data.plot.type,
              new_agents_count: data.newAgents.length,
            },
          },
        ],
      }

      localStorage.setItem(`world_${worldId}`, JSON.stringify(updatedWorld))

      if (onWorldUpdate) {
        onWorldUpdate(updatedWorld)
      }

      const message = data.newAgents.length > 0
        ? `司命编织了剧情：${data.plot.title}\n女娲补充了 ${data.newAgents.length} 个角色`
        : `司命编织了剧情：${data.plot.title}`
      
      alert(message)
    } catch (error) {
      console.error('Failed to generate plot:', error)
      alert('生成剧情失败: ' + (error as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">司命 - 命运编织</h2>
      <p className="text-sm text-slate-600">
        司命掌管命运与剧情，为世界中的 agents 编织命运线，创造引人入胜的故事。
      </p>

      {world.agents.npcs.length === 0 ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ 世界初始化时，女娲和司命会自动协同创造 agents 和剧情
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-900">
              当前世界: {world.agents.npcs.length} 个 Agents, {world.plots.length} 个剧情
            </p>
            {world.plots.length > 0 && world.plots[0].status === 'active' && (
              <p className="mt-1 text-blue-700">
                主线剧情进行中: {world.plots[0].title}
              </p>
            )}
          </div>
          
          {/* 协同日志 */}
          {showLog && coordinationLog.length > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-purple-900">司命-女娲协同日志</span>
                <button
                  onClick={() => setShowLog(false)}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  关闭
                </button>
              </div>
              <div className="space-y-1 text-xs text-purple-800">
                {coordinationLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">剧情类型</label>
            <select
              value={plotType}
              onChange={(e) => setPlotType(e.target.value as 'main' | 'side')}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
              disabled={generating}
            >
              <option value="main">主线剧情 (大司命)</option>
              <option value="side">支线剧情 (少司命)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {plotType === 'main' 
                ? '大司命主宰生杀大权，编织主线命运' 
                : '少司命主宰子嗣后代，编织支线故事'}
            </p>
          </div>

          <button
            onClick={handleGeneratePlot}
            className="w-full rounded bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-purple-700"
            disabled={generating}
          >
            {generating ? '司命与女娲协同中...' : '🎭 编织新剧情（司命-女娲协同）'}
          </button>
          
          <p className="text-xs text-slate-500">
            💡 司命会分析剧情需求，如果角色不够会让女娲自动补充
          </p>
        </div>
      )}

      {/* 显示现有剧情 */}
      {world.plots.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold">已编织的剧情</h3>
          {world.plots.map((plot) => (
            <PlotCard key={plot.id} plot={plot} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlotCard({ plot }: { plot: PlotArc }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">
            {plot.type === 'main' ? '📜' : '📖'} {plot.title}
          </h4>
          <p className="mt-1 text-sm text-slate-600">{plot.description}</p>
          <div className="mt-2 flex gap-2 text-xs">
            <span className={`rounded px-2 py-1 ${
              plot.status === 'active' ? 'bg-green-100 text-green-700' :
              plot.status === 'completed' ? 'bg-blue-100 text-blue-700' :
              plot.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {plot.status}
            </span>
            <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
              阶段 {plot.current_stage + 1}/{plot.stages.length}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-3 text-sm">
          <div>
            <span className="font-medium">主角:</span> {plot.protagonists.join(', ')}
          </div>
          {plot.antagonists.length > 0 && (
            <div>
              <span className="font-medium">对手:</span> {plot.antagonists.join(', ')}
            </div>
          )}
          <div>
            <span className="font-medium">剧情阶段:</span>
            <ul className="mt-1 space-y-1">
              {plot.stages.map((stage, i) => (
                <li key={stage.id} className={i === plot.current_stage ? 'font-medium' : 'text-slate-600'}>
                  {i + 1}. {stage.name} {stage.completed && '✓'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
