import React from 'react'
import type { WorldSlice } from '@/domain/world'

type EventsPanelProps = {
  world: WorldSlice
}

export function EventsPanel({ world }: EventsPanelProps) {
  // 获取最近的事件
  const recentEvents = world.events.slice(-20).reverse()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">事件日志</h2>
        <span className="text-sm text-slate-600">Tick {world.tick}</span>
      </div>

      <div className="space-y-2">
        {recentEvents.length === 0 ? (
          <p className="text-sm text-slate-500">暂无事件</p>
        ) : (
          recentEvents.map((event) => {
            const payload = event.payload || {}
            const summary = payload.summary ? String(payload.summary) : null
            const message = payload.message ? String(payload.message) : null
            const count = payload.count !== undefined ? String(payload.count) : null
            const agentNames = payload.agent_names && Array.isArray(payload.agent_names) 
              ? (payload.agent_names as string[]).join(', ') 
              : null
            const narrativeTitle = payload.narrative_title ? String(payload.narrative_title) : null
            const narrativeType = payload.narrative_type ? String(payload.narrative_type) : null
            const agentName = payload.agent_name ? String(payload.agent_name) : null
            const cause = payload.cause ? String(payload.cause) : null
            const oldName = payload.old_name ? String(payload.old_name) : null
            const newName = payload.new_name ? String(payload.new_name) : null
            
            return (
              <div
                key={event.id}
                className="rounded border p-3 text-sm"
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium text-slate-700">
                    {event.type === 'world_created' && '🌍 世界创建'}
                    {event.type === 'world_initialized' && '✨ 世界初始化'}
                    {event.type === 'agents_created' && '👥 Agents 创建'}
                    {event.type === 'narrative_emerged' && '📖 叙事涌现'}
                    {event.type === 'narrative_concluded' && '🎉 叙事完结'}
                    {event.type === 'story_arc_detected' && '🎬 故事弧检测'}
                    {event.type === 'agent_death' && '💀 人物死亡'}
                    {event.type === 'agent_reincarnation' && '🔄 轮回转世'}
                    {event.type === 'tick' && '⏱️ 时间推进'}
                    {event.type === 'user_message' && '💬 用户消息'}
                    {event.type === 'micro' && '🎭 Agent 行动'}
                    {event.type === 'macro' && '🌟 重大事件'}
                    {!['world_created', 'world_initialized', 'agents_created', 'narrative_emerged', 'narrative_concluded', 'story_arc_detected', 'agent_death', 'agent_reincarnation', 'tick', 'user_message', 'micro', 'macro'].includes(event.type) && `📌 ${event.type}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {Object.keys(payload).length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {summary && <div>摘要: {summary}</div>}
                    {message && <div>消息: {message}</div>}
                    {count && <div>数量: {count}</div>}
                    {agentNames && <div>Agents: {agentNames}</div>}
                    {narrativeTitle && <div>叙事: {narrativeTitle}</div>}
                    {narrativeType && <div>类型: {narrativeType}</div>}
                    {agentName && event.type === 'agent_death' && cause && (
                      <div>💀 {agentName} - {cause}</div>
                    )}
                    {oldName && event.type === 'agent_reincarnation' && newName && (
                      <div>🔄 {oldName} 转世为 {newName}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
