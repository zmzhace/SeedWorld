'use client'

import React from 'react'
import type { WorldSlice } from '@/domain/world'
import { createTimeEngine } from '@/engine/time-engine'
import { createKnowledgeGraph } from '@/engine/knowledge-graph'

type SystemStatsPanelProps = {
  world: WorldSlice
}

export function SystemStatsPanel({ world }: SystemStatsPanelProps) {
  const [stats, setStats] = React.useState<{
    timeEngine: {
      total: number
      active: number
      sleeping: number
      activityRate: number
    }
    knowledgeGraph: {
      totalNodes: number
      totalEdges: number
      nodesByType: Record<string, number>
      avgDegree: number
    }
  } | null>(null)

  React.useEffect(() => {
    // 计算统计信息
    const timeEngine = createTimeEngine()
    const knowledgeGraph = createKnowledgeGraph(world)

    setStats({
      timeEngine: timeEngine.getActivityStats(world),
      knowledgeGraph: knowledgeGraph.getStats(),
    })
  }, [world.tick])

  if (!stats) {
    return <div className="text-sm text-slate-500">加载中...</div>
  }

  const currentHour = new Date(world.time).getHours()

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">系统统计</h2>
      <p className="text-sm text-slate-600">
        实时监控仿真系统的运行状态
      </p>

      {/* 时间引擎统计 */}
      <div className="rounded-lg border bg-blue-50 p-4">
        <h3 className="mb-3 font-semibold text-blue-900">⏰ 时间引擎</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-blue-700">当前时间:</span>
            <span className="font-medium text-blue-900">
              {new Date(world.time).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">活跃 Agents:</span>
            <span className="font-medium text-blue-900">
              {stats.timeEngine.active} / {stats.timeEngine.total}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">活跃率:</span>
            <span className="font-medium text-blue-900">
              {(stats.timeEngine.activityRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">休眠 Agents:</span>
            <span className="font-medium text-blue-900">
              {stats.timeEngine.sleeping}
            </span>
          </div>
          
          {/* 活跃度进度条 */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-blue-700">
              <span>活跃度分布</span>
              <span>{currentHour}:00</span>
            </div>
            <div className="h-3 w-full rounded-full bg-blue-200">
              <div
                className="h-3 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${stats.timeEngine.activityRate * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 知识图谱统计 */}
      <div className="rounded-lg border bg-purple-50 p-4">
        <h3 className="mb-3 font-semibold text-purple-900">🕸️ 知识图谱</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-purple-700">总节点数:</span>
            <span className="font-medium text-purple-900">
              {stats.knowledgeGraph.totalNodes}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-purple-700">总边数:</span>
            <span className="font-medium text-purple-900">
              {stats.knowledgeGraph.totalEdges}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-purple-700">平均度数:</span>
            <span className="font-medium text-purple-900">
              {stats.knowledgeGraph.avgDegree.toFixed(2)}
            </span>
          </div>

          {/* 节点类型分布 */}
          <div className="mt-3 space-y-1">
            <div className="text-xs text-purple-700">节点类型分布:</div>
            {Object.entries(stats.knowledgeGraph.nodesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="text-purple-600">
                  {type === 'agent' && '👤 Agents'}
                  {type === 'event' && '⚡ 事件'}
                  {type === 'location' && '📍 地点'}
                  {type === 'organization' && '🏢 组织'}
                  {type === 'concept' && '💡 概念'}
                </span>
                <span className="font-medium text-purple-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 推荐系统状态 */}
      <div className="rounded-lg border bg-green-50 p-4">
        <h3 className="mb-3 font-semibold text-green-900">🎯 推荐系统</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-green-700">状态:</span>
            <span className="rounded bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
              运行中
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-green-700">可推荐事件:</span>
            <span className="font-medium text-green-900">
              {world.events.filter(e => !['tick'].includes(e.type)).length}
            </span>
          </div>
          <div className="mt-2 text-xs text-green-600">
            💡 推荐系统根据 agents 的兴趣、社交网络和事件热度智能推荐内容
          </div>
        </div>
      </div>

      {/* 系统性能 */}
      <div className="rounded-lg border bg-slate-50 p-4">
        <h3 className="mb-3 font-semibold text-slate-900">⚡ 系统性能</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-700">当前 Tick:</span>
            <span className="font-medium text-slate-900">{world.tick}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-700">总事件数:</span>
            <span className="font-medium text-slate-900">{world.events.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-700">活跃叙事:</span>
            <span className="font-medium text-slate-900">
              {world.narratives.stats.active_patterns}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-700">故事弧:</span>
            <span className="font-medium text-slate-900">
              {world.narratives.stats.total_arcs}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
