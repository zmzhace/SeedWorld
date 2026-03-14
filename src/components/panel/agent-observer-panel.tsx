'use client'

import React from 'react'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'

type AgentObserverPanelProps = {
  world: WorldSlice
}

export function AgentObserverPanel({ world }: AgentObserverPanelProps) {
  const [selectedSeed, setSelectedSeed] = React.useState<string | null>(null)

  // 选择第一个 agent 作为默认
  React.useEffect(() => {
    if (world.agents.npcs.length > 0 && !selectedSeed) {
      setSelectedSeed(world.agents.npcs[0].genetics.seed)
    }
  }, [world.agents.npcs, selectedSeed])

  // 从当前 world 中获取最新的 agent 状态
  const selectedAgent = selectedSeed
    ? world.agents.npcs.find(a => a.genetics.seed === selectedSeed) ?? null
    : null

  if (world.agents.npcs.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Agent 观察台</h2>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-sm text-yellow-800">
            暂无 agents，请先初始化世界或使用女娲造人
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Agent 观察台</h2>
      <p className="mb-4 text-sm text-slate-600">
        切换 personal agent 并查看世界观察
      </p>

      {/* Agent 选择器 */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium">选择 Agent</label>
        <select
          value={selectedAgent?.genetics.seed || ''}
          onChange={(e) => {
            const agent = world.agents.npcs.find(a => a.genetics.seed === e.target.value)
            setSelectedSeed(agent?.genetics.seed ?? null)
          }}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          {world.agents.npcs.map((agent) => (
            <option key={agent.genetics.seed} value={agent.genetics.seed}>
              {agent.identity.name} ({agent.occupation || '未知职业'}) - {
                agent.role === 'protagonist' ? '主角' :
                agent.role === 'supporting' ? '配角' : 'NPC'
              }
            </option>
          ))}
        </select>
      </div>

      {/* Agent 详情 */}
      {selectedAgent && (
        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold">{selectedAgent.identity.name}</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-600">职业：</span>
                <span>{selectedAgent.occupation || '未知'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-600">角色：</span>
                <span className={`rounded px-2 py-0.5 text-xs ${
                  selectedAgent.role === 'protagonist' ? 'bg-yellow-100 text-yellow-800' :
                  selectedAgent.role === 'supporting' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedAgent.role === 'protagonist' ? '主角' :
                   selectedAgent.role === 'supporting' ? '配角' : 'NPC'}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600">状态：</span>
                <span className={`rounded px-2 py-0.5 text-xs ${
                  selectedAgent.life_status === 'alive' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedAgent.life_status === 'alive' ? '🌱 在世' : '🪦 已故'}
                </span>
              </div>
            </div>
          </div>

          {/* 个性特征 */}
          {(selectedAgent.voice || selectedAgent.approach || selectedAgent.core_belief) && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">个性特征</h4>
              <div className="space-y-2 text-sm">
                {selectedAgent.voice && (
                  <div>
                    <span className="font-medium text-slate-600">说话风格：</span>
                    <span className="ml-2">{selectedAgent.voice}</span>
                  </div>
                )}
                {selectedAgent.approach && (
                  <div>
                    <span className="font-medium text-slate-600">做事方式：</span>
                    <span className="ml-2">{selectedAgent.approach}</span>
                  </div>
                )}
                {selectedAgent.core_belief && (
                  <div>
                    <span className="font-medium text-slate-600">核心信念：</span>
                    <span className="ml-2 italic">"{selectedAgent.core_belief}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 专长 */}
          {selectedAgent.expertise && selectedAgent.expertise.length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">专长领域</h4>
              <div className="flex flex-wrap gap-2">
                {selectedAgent.expertise.map((skill, i) => (
                  <span key={i} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 目标 */}
          {selectedAgent.goals.length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">当前目标</h4>
              <ul className="space-y-1 text-sm">
                {selectedAgent.goals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 生命状态 */}
          <div className="rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-semibold">生命状态</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">能量</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${selectedAgent.vitals.energy * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right">{Math.round(selectedAgent.vitals.energy * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">压力</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{ width: `${selectedAgent.vitals.stress * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right">{Math.round(selectedAgent.vitals.stress * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">专注</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${selectedAgent.vitals.focus * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right">{Math.round(selectedAgent.vitals.focus * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">衰老</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-gray-500"
                      style={{ width: `${selectedAgent.vitals.aging_index * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right">{Math.round(selectedAgent.vitals.aging_index * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 性格特质 */}
          <div className="rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-semibold">性格特质</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">开放性</span>
                <span>{Math.round(selectedAgent.persona.openness * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">稳定性</span>
                <span>{Math.round(selectedAgent.persona.stability * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">依恋性</span>
                <span>{Math.round(selectedAgent.persona.attachment * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">主动性</span>
                <span>{Math.round(selectedAgent.persona.agency * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">共情力</span>
                <span>{Math.round(selectedAgent.persona.empathy * 100)}%</span>
              </div>
            </div>
          </div>

          {/* 情绪 */}
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 text-sm font-semibold">当前情绪</h4>
            <div className="text-sm">
              <span className="font-medium">{selectedAgent.emotion.label}</span>
              <span className="ml-2 text-slate-600">
                (强度: {Math.round(selectedAgent.emotion.intensity * 100)}%)
              </span>
            </div>
          </div>

          {/* 关系网络 */}
          {Object.keys(selectedAgent.relations).length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">关系网络</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(selectedAgent.relations).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span>{name}</span>
                    <span className={value > 0 ? 'text-green-600' : 'text-red-600'}>
                      {value > 0 ? '+' : ''}{Math.round(value * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 成功指标 */}
          {selectedAgent.success_metrics && Object.keys(selectedAgent.success_metrics).length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">成功指标</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(selectedAgent.success_metrics).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-slate-600 capitalize">{key}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
