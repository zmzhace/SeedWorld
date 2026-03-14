'use client'

import React from 'react'
import type { WorldSlice } from '@/domain/world'
import type { NarrativePattern, StoryArc } from '@/domain/narrative'

type NarrativeTimelinePanelProps = {
  world: WorldSlice
}

type TimelineEvent = {
  tick: number
  type: 'narrative_start' | 'narrative_update' | 'narrative_end' | 'arc_milestone'
  narrative?: NarrativePattern
  arc?: StoryArc
  description: string
  sentiment: number
}

export function NarrativeTimelinePanel({ world }: NarrativeTimelinePanelProps) {
  const [selectedNarrative, setSelectedNarrative] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<'all' | 'patterns' | 'arcs'>('all')
  
  // 构建时间线事件
  const timelineEvents = React.useMemo(() => {
    return buildTimelineEvents(world, viewMode)
  }, [world, viewMode])
  
  // 获取选中的叙事
  const selectedPattern = selectedNarrative
    ? world.narratives.patterns.find(p => p.id === selectedNarrative)
    : null
  
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">叙事时间线</h3>
        
        {/* 视图切换 */}
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            onClick={() => setViewMode('all')}
          >
            全部
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'patterns' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            onClick={() => setViewMode('patterns')}
          >
            叙事模式
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'arcs' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            onClick={() => setViewMode('arcs')}
          >
            故事弧
          </button>
        </div>
      </div>
      
      {/* 情感曲线图 */}
      <EmotionalCurveChart events={timelineEvents} />
      
      {/* 时间线 */}
      <div className="relative">
        {/* 时间轴 */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />
        
        {/* 事件列表 */}
        <div className="space-y-4">
          {timelineEvents.map((event, idx) => (
            <TimelineEventCard
              key={idx}
              event={event}
              isSelected={event.narrative?.id === selectedNarrative}
              onClick={() => {
                if (event.narrative) {
                  setSelectedNarrative(
                    event.narrative.id === selectedNarrative ? null : event.narrative.id
                  )
                }
              }}
            />
          ))}
        </div>
      </div>
      
      {/* 详情面板 */}
      {selectedPattern && (
        <NarrativeDetailPanel
          pattern={selectedPattern}
          world={world}
          onClose={() => setSelectedNarrative(null)}
        />
      )}
    </div>
  )
}

// 构建时间线事件
function buildTimelineEvents(
  world: WorldSlice,
  viewMode: 'all' | 'patterns' | 'arcs'
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  
  // 添加叙事模式事件
  if (viewMode === 'all' || viewMode === 'patterns') {
    for (const pattern of world.narratives.patterns) {
      // 开始事件
      events.push({
        tick: pattern.started_at,
        type: 'narrative_start',
        narrative: pattern,
        description: `${getNarrativeTypeName(pattern.type)}开始`,
        sentiment: pattern.sentiment
      })
      
      // 更新事件（转折点）
      for (const turningPoint of pattern.turning_points) {
        const event = world.events.find(e => e.id === turningPoint)
        if (event) {
          events.push({
            tick: pattern.updated_at,
            type: 'narrative_update',
            narrative: pattern,
            description: `${getNarrativeTypeName(pattern.type)}出现转折`,
            sentiment: pattern.sentiment
          })
        }
      }
      
      // 结束事件
      if (pattern.status === 'concluded' && pattern.resolution) {
        events.push({
          tick: pattern.updated_at,
          type: 'narrative_end',
          narrative: pattern,
          description: `${getNarrativeTypeName(pattern.type)}结束`,
          sentiment: pattern.sentiment
        })
      }
    }
  }
  
  // 添加故事弧事件
  if (viewMode === 'all' || viewMode === 'arcs') {
    for (const arc of world.narratives.arcs) {
      // 故事弧里程碑
      const stages = ['setup', 'rising', 'climax', 'falling', 'resolution'] as const
      for (const stage of stages) {
        if (arc.structure[stage].length > 0) {
          const firstPattern = arc.structure[stage][0]
          events.push({
            tick: firstPattern.started_at,
            type: 'arc_milestone',
            arc,
            description: `${arc.title} - ${getStageName(stage)}`,
            sentiment: arc.emotional_curve[0] || 0
          })
        }
      }
    }
  }
  
  // 按时间排序
  return events.sort((a, b) => a.tick - b.tick)
}

// 时间线事件卡片
function TimelineEventCard({
  event,
  isSelected,
  onClick
}: {
  event: TimelineEvent
  isSelected: boolean
  onClick: () => void
}) {
  const typeIcons = {
    narrative_start: '🌱',
    narrative_update: '🔄',
    narrative_end: '✅',
    arc_milestone: '📍'
  }
  
  const typeColors = {
    narrative_start: 'bg-green-100 border-green-300',
    narrative_update: 'bg-blue-100 border-blue-300',
    narrative_end: 'bg-gray-100 border-gray-300',
    arc_milestone: 'bg-purple-100 border-purple-300'
  }
  
  return (
    <div
      className={`relative pl-16 cursor-pointer transition-all ${
        isSelected ? 'scale-105' : ''
      }`}
      onClick={onClick}
    >
      {/* 时间点 */}
      <div className="absolute left-5 top-3 w-6 h-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center text-xs">
        {typeIcons[event.type]}
      </div>
      
      {/* 事件卡片 */}
      <div
        className={`border-2 rounded-lg p-3 ${typeColors[event.type]} ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{event.description}</div>
            <div className="text-sm text-gray-600 mt-1">Tick {event.tick}</div>
            {event.narrative && (
              <div className="text-sm text-gray-600 mt-1">
                参与者: {event.narrative.participants.slice(0, 3).join(', ')}
                {event.narrative.participants.length > 3 && ` +${event.narrative.participants.length - 3}`}
              </div>
            )}
          </div>
          
          {/* 情感指示器 */}
          <div className="flex items-center gap-2">
            <SentimentIndicator sentiment={event.sentiment} />
          </div>
        </div>
      </div>
    </div>
  )
}

// 情感曲线图
function EmotionalCurveChart({ events }: { events: TimelineEvent[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  
  React.useEffect(() => {
    if (!canvasRef.current || events.length === 0) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = canvas.offsetWidth
    canvas.height = 150
    
    // 绘制情感曲线
    drawEmotionalCurve(ctx, events, canvas.width, canvas.height)
  }, [events])
  
  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="text-sm font-semibold mb-2">情感曲线</div>
      <canvas ref={canvasRef} className="w-full" style={{ height: '150px' }} />
    </div>
  )
}

// 绘制情感曲线
function drawEmotionalCurve(
  ctx: CanvasRenderingContext2D,
  events: TimelineEvent[],
  width: number,
  height: number
) {
  if (events.length === 0) return
  
  ctx.clearRect(0, 0, width, height)
  
  // 绘制坐标轴
  const padding = 20
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  
  // Y 轴（情感值 -1 到 1）
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.stroke()
  
  // X 轴
  ctx.beginPath()
  ctx.moveTo(padding, height / 2)
  ctx.lineTo(width - padding, height / 2)
  ctx.stroke()
  
  // 绘制曲线
  if (events.length < 2) return
  
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  const minTick = events[0].tick
  const maxTick = events[events.length - 1].tick
  const tickRange = maxTick - minTick || 1
  
  events.forEach((event, i) => {
    const x = padding + ((event.tick - minTick) / tickRange) * chartWidth
    const y = height / 2 - (event.sentiment * chartHeight / 2)
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // 绘制数据点
  events.forEach(event => {
    const x = padding + ((event.tick - minTick) / tickRange) * chartWidth
    const y = height / 2 - (event.sentiment * chartHeight / 2)
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fillStyle = event.sentiment > 0 ? '#10b981' : event.sentiment < 0 ? '#ef4444' : '#6b7280'
    ctx.fill()
  })
}

// 情感指示器
function SentimentIndicator({ sentiment }: { sentiment: number }) {
  const getColor = () => {
    if (sentiment > 0.5) return 'bg-green-500'
    if (sentiment > 0) return 'bg-green-300'
    if (sentiment > -0.5) return 'bg-red-300'
    return 'bg-red-500'
  }
  
  const getEmoji = () => {
    if (sentiment > 0.5) return '😊'
    if (sentiment > 0) return '🙂'
    if (sentiment > -0.5) return '😐'
    return '😢'
  }
  
  return (
    <div className="flex items-center gap-1">
      <span className="text-lg">{getEmoji()}</span>
      <div className={`w-2 h-2 rounded-full ${getColor()}`} />
    </div>
  )
}

// 叙事详情面板
function NarrativeDetailPanel({
  pattern,
  world,
  onClose
}: {
  pattern: NarrativePattern
  world: WorldSlice
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold">{getNarrativeTypeName(pattern.type)}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-600">参与者</div>
            <div className="mt-1">{pattern.participants.join(', ')}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">状态</div>
            <div className="mt-1">
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-sm">
                {getStatusName(pattern.status)}
              </span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">强度</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${pattern.intensity * 100}%` }}
                />
              </div>
              <span className="text-sm">{Math.round(pattern.intensity * 100)}%</span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">情感倾向</div>
            <div className="mt-1">
              {pattern.sentiment > 0 ? '积极' : pattern.sentiment < 0 ? '消极' : '中性'}
              ({pattern.sentiment.toFixed(2)})
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">时间范围</div>
            <div className="mt-1">
              Tick {pattern.started_at} - {pattern.updated_at}
              ({pattern.updated_at - pattern.started_at} ticks)
            </div>
          </div>
          
          {pattern.tags.length > 0 && (
            <div>
              <div className="text-sm text-gray-600">标签</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {pattern.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {pattern.turning_points.length > 0 && (
            <div>
              <div className="text-sm text-gray-600">转折点</div>
              <div className="mt-1 text-sm">
                {pattern.turning_points.length} 个关键事件
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 辅助函数
function getNarrativeTypeName(type: string): string {
  const names: Record<string, string> = {
    conflict: '冲突',
    alliance: '联盟',
    romance: '浪漫',
    betrayal: '背叛',
    discovery: '发现',
    transformation: '转变',
    quest: '探索',
    mystery: '谜团',
    tragedy: '悲剧',
    triumph: '胜利'
  }
  return names[type] || type
}

function getStatusName(status: string): string {
  const names: Record<string, string> = {
    emerging: '萌芽',
    developing: '发展',
    climax: '高潮',
    resolving: '解决',
    concluded: '完结',
    dormant: '休眠'
  }
  return names[status] || status
}

function getStageName(stage: string): string {
  const names: Record<string, string> = {
    setup: '铺垫',
    rising: '上升',
    climax: '高潮',
    falling: '下降',
    resolution: '解决'
  }
  return names[stage] || stage
}
