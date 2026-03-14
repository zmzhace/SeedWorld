'use client'

import React from 'react'
import type { WorldSlice } from '@/domain/world'

type HoutuPanelProps = {
  world: WorldSlice
}

export function HoutuPanel({ world }: HoutuPanelProps) {
  // 统计生死数据
  const aliveAgents = world.agents.npcs.filter(a => a.life_status === 'alive')
  const deadAgents = world.agents.npcs.filter(a => a.life_status === 'dead')
  const reincarnatedAgents = world.agents.npcs.filter(a => 
    a.genetics.seed.includes('-reborn-')
  )
  
  // 获取死亡和轮回事件
  const deathEvents = world.events.filter(e => e.type === 'agent_death')
  const reincarnationEvents = world.events.filter(e => e.type === 'agent_reincarnation')
  
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">后土 · 幽冥黄泉</h2>
        <p className="mt-1 text-sm text-slate-600">
          生于地，归于地 · 掌管生死轮回
        </p>
      </div>

      {/* 统计概览 */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{aliveAgents.length}</div>
          <div className="text-sm text-green-600">在世</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-2xl font-bold text-gray-700">{deadAgents.length}</div>
          <div className="text-sm text-gray-600">已故</div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-2xl font-bold text-purple-700">{reincarnatedAgents.length}</div>
          <div className="text-sm text-purple-600">转世</div>
        </div>
      </div>

      {/* 在世 Agents */}
      {aliveAgents.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">在世人物</h3>
          <div className="space-y-2">
            {aliveAgents.map((agent) => (
              <div
                key={agent.genetics.seed}
                className="rounded-lg border border-green-200 bg-green-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {agent.identity.name}
                      {agent.genetics.seed.includes('-reborn-') && (
                        <span className="ml-2 text-xs text-purple-600">【转世】</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      角色: {agent.role === 'protagonist' ? '主角' : agent.role === 'supporting' ? '配角' : 'NPC'}
                      {' · '}
                      衰老: {Math.floor(agent.vitals.aging_index * 100)}%
                      {' · '}
                      压力: {Math.floor(agent.vitals.stress * 100)}%
                    </div>
                  </div>
                  <div className="text-2xl">🌱</div>
                </div>
                {agent.goals.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    目标: {agent.goals.slice(0, 2).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 已故 Agents */}
      {deadAgents.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">已故人物</h3>
          <div className="space-y-2">
            {deadAgents.map((agent) => (
              <div
                key={agent.genetics.seed}
                className="rounded-lg border border-gray-300 bg-gray-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">
                      {agent.identity.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {agent.cause_of_death || '原因未知'}
                      {agent.death_tick && ` · Tick ${agent.death_tick}`}
                    </div>
                  </div>
                  <div className="text-2xl">🪦</div>
                </div>
                {agent.legacy && agent.legacy.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    遗产: {agent.legacy.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 死亡事件 */}
      {deathEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">死亡记录</h3>
          <div className="space-y-2">
            {deathEvents.slice(-5).reverse().map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">💀</span>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {event.payload?.agent_name as string}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {event.payload?.cause as string}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(event.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 轮回事件 */}
      {reincarnationEvents.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">轮回记录</h3>
          <div className="space-y-2">
            {reincarnationEvents.slice(-5).reverse().map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">🔄</span>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {event.payload?.old_name as string} → {event.payload?.new_name as string}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {event.payload?.old_role as string} 转世为 {event.payload?.new_role as string}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(event.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {aliveAgents.length === 0 && deadAgents.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-500">
          尚无人物，请先使用女娲造人
        </div>
      )}
    </div>
  )
}
