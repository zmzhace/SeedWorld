'use client'

import React from 'react'
import type { WorldSlice } from '@/domain/world'
import {
  Network,
  Users,
  Heart,
  Skull,
  Minus,
} from 'lucide-react'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'

// Dynamic import for Sigma (WebGL, not SSR compatible)
const SigmaContainer = React.lazy(() =>
  import('@react-sigma/core').then(mod => ({ default: mod.SigmaContainer }))
)

// Event handler component (must be child of SigmaContainer to use hooks)
function SigmaEvents({ onClickNode, onClickStage }: {
  onClickNode: (nodeId: string) => void
  onClickStage: () => void
}) {
  const registerEventsRef = React.useRef<any>(null)

  React.useEffect(() => {
    import('@react-sigma/core').then(mod => {
      // Can't use hooks directly in lazy-loaded context, so we skip this
      // Events will be handled via the sigma instance approach below
    })
  }, [])

  return null
}

type SocialNetworkPanelProps = {
  world: WorldSlice
}

type CommunityInfo = { id: number; members: string[] }

export function SocialNetworkPanel({ world }: SocialNetworkPanelProps) {
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  // Build graphology graph
  const { graph, communities } = React.useMemo(() => {
    return buildGraph(world)
  }, [world])

  const selectedAgent = selectedNode
    ? world.agents.npcs.find(a => a.genetics.seed === selectedNode)
    : null

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Network className="h-4 w-4 text-blue-500" />
          Social Network
        </h3>
        <div className="text-xs text-slate-500">
          {graph.order} nodes · {graph.size} links · {communities.length} clusters
        </div>
      </div>

      {/* Sigma graph */}
      <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden" style={{ height: '500px' }}>
        {mounted && graph.order > 0 ? (
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading graph...</div>
          }>
            <SigmaContainer
              graph={graph}
              style={{ height: '500px', width: '100%' }}
              settings={{
                defaultNodeColor: '#3b82f6',
                defaultEdgeColor: '#cbd5e1',
                labelColor: { color: '#475569' },
                labelFont: 'system-ui, sans-serif',
                labelSize: 12,
                renderLabels: true,
                renderEdgeLabels: false,
                labelRenderedSizeThreshold: 0,
                defaultEdgeType: 'line',
              }}
            />
          </React.Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            {graph.order === 0 ? 'No agents yet' : 'Loading...'}
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-3 right-3 rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-3 text-xs pointer-events-none">
          <div className="font-semibold text-slate-700 mb-2">Legend</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Heart className="h-3 w-3 text-emerald-500" />
              <span className="text-slate-500">Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <Skull className="h-3 w-3 text-red-500" />
              <span className="text-slate-500">Negative</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-3 w-3 text-slate-400" />
              <span className="text-slate-500">Neutral</span>
            </div>
          </div>
        </div>
      </div>

      {/* Community list */}
      <div className="grid grid-cols-2 gap-3">
        {communities.map((community, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-sm text-slate-700">Cluster {idx + 1}</span>
            </div>
            <div className="text-xs text-slate-500 mb-2">
              {community.members.length} members
            </div>
            <div className="flex flex-wrap gap-1">
              {community.members.slice(0, 5).map(memberId => {
                const name = graph.hasNode(memberId)
                  ? (graph.getNodeAttribute(memberId, 'label') as string)
                  : memberId
                return (
                  <span
                    key={memberId}
                    className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    onClick={() => setSelectedNode(memberId)}
                  >
                    {name}
                  </span>
                )
              })}
              {community.members.length > 5 && (
                <span className="text-xs text-slate-400">
                  +{community.members.length - 5}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Node details */}
      {selectedAgent && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="font-semibold text-sm text-slate-800 mb-3">{selectedAgent.identity.name}</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Occupation</span>
              <span className="text-slate-700">{selectedAgent.occupation || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Core Belief</span>
              <span className="text-slate-700">{selectedAgent.core_belief || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Relationships</span>
              <span className="text-blue-600 font-medium">{Object.keys(selectedAgent.relations).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Emotion</span>
              <span className="text-slate-700">
                {selectedAgent.emotion.label}
                <span className="text-slate-400 ml-1">
                  ({Math.round(selectedAgent.emotion.intensity * 100)}%)
                </span>
              </span>
            </div>
            {Object.keys(selectedAgent.relations).length > 0 && (
              <div className="pt-2 border-t border-blue-100">
                <span className="text-slate-500">Key Relationships</span>
                <div className="mt-1.5 space-y-1">
                  {Object.entries(selectedAgent.relations)
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 5)
                    .map(([target, value]) => {
                      const targetAgent = world.agents.npcs.find(a => a.genetics.seed === target)
                      return (
                        <div key={target} className="flex items-center justify-between">
                          <span className="text-slate-500">{targetAgent?.identity.name || target}</span>
                          <span className={value > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {value > 0 ? '+' : ''}{value.toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Build a graphology graph from world data and run ForceAtlas2 layout
 */
function buildGraph(world: WorldSlice): { graph: Graph; communities: CommunityInfo[] } {
  const graph = new Graph()

  const aliveAgents = world.agents.npcs.filter(a => a.life_status === 'alive')
  const communityColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  // Add nodes
  for (const agent of aliveAgents) {
    const connectionCount = Object.keys(agent.relations).length
    graph.addNode(agent.genetics.seed, {
      label: agent.identity.name,
      size: Math.max(8, 5 + connectionCount * 1.5),
      color: '#3b82f6',
      x: Math.random() * 100,
      y: Math.random() * 100,
    })
  }

  // Add edges
  for (const agent of aliveAgents) {
    for (const [target, value] of Object.entries(agent.relations)) {
      if (!graph.hasNode(target)) continue
      const edgeId = [agent.genetics.seed, target].sort().join('--')
      if (graph.hasEdge(edgeId)) continue

      const type = value > 0.3 ? 'positive' : value < -0.3 ? 'negative' : 'neutral'
      graph.addEdgeWithKey(edgeId, agent.genetics.seed, target, {
        size: Math.max(1, Math.abs(value) * 3),
        color: type === 'positive' ? '#22c55e' : type === 'negative' ? '#ef4444' : '#cbd5e1',
        type: 'line',
      })
    }
  }

  // Run ForceAtlas2 layout
  if (graph.order > 1) {
    forceAtlas2.assign(graph, {
      iterations: 100,
      settings: {
        gravity: 1,
        scalingRatio: 10,
        barnesHutOptimize: graph.order > 50,
        strongGravityMode: true,
        slowDown: 5,
      },
    })
  }

  // Detect communities (BFS connected components)
  const communities: CommunityInfo[] = []
  const visited = new Set<string>()
  let communityId = 0

  graph.forEachNode((nodeId) => {
    if (visited.has(nodeId)) return

    const members: string[] = []
    const queue = [nodeId]
    visited.add(nodeId)

    while (queue.length > 0) {
      const current = queue.shift()!
      members.push(current)

      graph.forEachNeighbor(current, (neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      })
    }

    if (members.length > 0) {
      // Color nodes by community
      const color = communityColors[communityId % communityColors.length]
      for (const m of members) {
        graph.setNodeAttribute(m, 'color', color)
      }
      communities.push({ id: communityId++, members })
    }
  })

  return { graph, communities }
}
