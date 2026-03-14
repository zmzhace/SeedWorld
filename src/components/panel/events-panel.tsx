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
          recentEvents.map((event, index) => (
            <div
              key={event.id}
              className="rounded border p-3 text-sm"
            >
              <div className="flex items-start justify-between">
                <span className="font-medium text-slate-700">
                  {event.type === 'world_created' && '🌍 世界创建'}
                  {event.type === 'agents_created' && '👥 Agents 创建'}
                  {event.type === 'plot_created' && '📖 剧情编织'}
                  {event.type === 'plot_triggered' && '🎬 剧情触发'}
                  {event.type === 'plot_stage_completed' && '✨ 剧情推进'}
                  {event.type === 'plot_completed' && '🎉 剧情完成'}
                  {event.type === 'plot_failed' && '💔 剧情失败'}
                  {event.type === 'agent_death' && '💀 人物死亡'}
                  {event.type === 'agent_reincarnation' && '🔄 轮回转世'}
                  {event.type === 'tick' && '⏱️ 时间推进'}
                  {event.type === 'user_message' && '💬 用户消息'}
                  {event.type === 'micro' && '🎭 Agent 行动'}
                  {event.type === 'macro' && '🌟 重大事件'}
                  {!['world_created', 'agents_created', 'plot_created', 'plot_triggered', 'plot_stage_completed', 'plot_completed', 'plot_failed', 'agent_death', 'agent_reincarnation', 'tick', 'user_message', 'micro', 'macro'].includes(event.type) && `📌 ${event.type}`}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              {event.payload && (
                <div className="mt-2 text-xs text-slate-600">
                  {event.payload.summary && <p>{String(event.payload.summary)}</p>}
                  {event.payload.message && <p>消息: {String(event.payload.message)}</p>}
                  {event.payload.count && <p>数量: {String(event.payload.count)}</p>}
                  {event.payload.agent_names && Array.isArray(event.payload.agent_names) && (
                    <p>Agents: {event.payload.agent_names.join(', ')}</p>
                  )}
                  {event.payload.plot_title && <p>剧情: {String(event.payload.plot_title)}</p>}
                  {event.payload.stage_name && <p>阶段: {String(event.payload.stage_name)}</p>}
                  {event.payload.agent_name && event.type === 'agent_death' && (
                    <p>💀 {String(event.payload.agent_name)} - {String(event.payload.cause)}</p>
                  )}
                  {event.payload.old_name && event.type === 'agent_reincarnation' && (
                    <p>🔄 {String(event.payload.old_name)} 转世为 {String(event.payload.new_name)}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
