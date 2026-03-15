'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'
import {
  Network,
  Users,
  Heart,
  Skull,
  Minus,
} from 'lucide-react'

const ForceGraph = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type SocialNetworkPanelProps = {
  world: WorldSlice
}

type NetworkNode = {
  id: string
  name: string
  group: number
  size: number
  color: string
}

type NetworkLink = {
  source: string
  target: string
  value: number
  type: 'positive' | 'negative' | 'neutral'
}

type GraphNode = {
  id: string
  name: string
  val: number
  color: string
  group: number
}

type GraphLink = {
  source: string
  target: string
  color: string
  width: number
  type: 'positive' | 'negative' | 'neutral'
  value: number
}

export function SocialNetworkPanel({ world }: SocialNetworkPanelProps) {
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(600)

  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const { nodes, links, communities } = React.useMemo(() => {
    return buildNetworkData(world)
  }, [world])

  const graphData = React.useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map(n => ({
      id: n.id,
      name: n.name,
      val: Math.max(2, n.size),
      color: n.color,
      group: n.group,
    }))

    const graphLinks: GraphLink[] = links.map(l => ({
      source: l.source,
      target: l.target,
      color:
        l.type === 'positive'
          ? 'rgba(16,185,129,0.5)'
          : l.type === 'negative'
            ? 'rgba(239,68,68,0.5)'
            : 'rgba(148,163,184,0.2)',
      width: Math.max(0.5, l.value * 2),
      type: l.type,
      value: l.value,
    }))

    return { nodes: graphNodes, links: graphLinks }
  }, [nodes, links])

  const connectedNodeIds = React.useMemo(() => {
    if (!hoveredNode) return new Set<string>()
    const ids = new Set<string>()
    ids.add(hoveredNode)
    for (const l of links) {
      if (l.source === hoveredNode) ids.add(l.target)
      if (l.target === hoveredNode) ids.add(l.source)
    }
    return ids
  }, [hoveredNode, links])

  const nodeCanvasObject = React.useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const id = node.id as string
      const label = node.name as string
      const color = node.color as string
      const baseRadius = Math.max(4, Math.sqrt(node.val || 1) * 2.5)
      const isHovered = id === hoveredNode
      const isSelected = id === selectedNode
      const isHighlighted = isHovered || isSelected
      const radius = isHighlighted ? baseRadius * 1.4 : baseRadius

      const x = node.x as number
      const y = node.y as number

      // Glow effect for highlighted nodes
      if (isHighlighted) {
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 10)
        gradient.addColorStop(0, color + '40')
        gradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(x, y, radius + 10, 0, 2 * Math.PI)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = isHighlighted ? color : color + 'CC'
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Label below the node
      const fontSize = 11 / globalScale
      ctx.font = `${isHighlighted ? 'bold ' : ''}${fontSize}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const textWidth = ctx.measureText(label).width
      const textY = y + radius + 3 / globalScale
      const padding = 2 / globalScale

      // Light background rect for readability
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.fillRect(
        x - textWidth / 2 - padding,
        textY - padding,
        textWidth + padding * 2,
        fontSize + padding * 2
      )

      ctx.fillStyle = isHighlighted ? '#1e293b' : '#64748b'
      ctx.fillText(label, x, textY)
    },
    [hoveredNode, selectedNode]
  )

  const nodePointerAreaPaint = React.useCallback(
    (node: any, paintColor: string, ctx: CanvasRenderingContext2D) => {
      const radius = Math.max(6, Math.sqrt(node.val || 1) * 3)
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = paintColor
      ctx.fill()
    },
    []
  )

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
          {nodes.length} nodes · {links.length} links · {communities.length} clusters
        </div>
      </div>

      {/* Network graph */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-slate-200 bg-slate-50"
        style={{ height: '500px' }}
      >
        <ForceGraph
          graphData={graphData}
          width={containerWidth}
          height={500}
          backgroundColor="#f8fafc"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkColor={(link: any) => {
            const src = typeof link.source === 'object' ? link.source.id : link.source
            const tgt = typeof link.target === 'object' ? link.target.id : link.target
            const isHighlighted =
              src === hoveredNode || tgt === hoveredNode ||
              src === selectedNode || tgt === selectedNode

            if (link.type === 'positive') {
              return isHighlighted ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.4)'
            }
            if (link.type === 'negative') {
              return isHighlighted ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.4)'
            }
            return isHighlighted ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.15)'
          }}
          linkWidth={(link: any) => {
            const src = typeof link.source === 'object' ? link.source.id : link.source
            const tgt = typeof link.target === 'object' ? link.target.id : link.target
            const isHighlighted =
              src === hoveredNode || tgt === hoveredNode ||
              src === selectedNode || tgt === selectedNode
            return isHighlighted ? link.value * 3 + 1 : Math.max(0.5, link.value * 1.5)
          }}
          linkLineDash={(link: any) =>
            link.type === 'negative' ? [4, 2] : null
          }
          linkDirectionalParticles={(link: any) =>
            link.type === 'positive' ? 2 : 0
          }
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={(link: any) => 'rgba(16,185,129,0.6)'}
          onNodeClick={(node: any) => {
            setSelectedNode(node.id as string)
          }}
          onNodeHover={(node: any) => {
            setHoveredNode(node ? (node.id as string) : null)
          }}
          onBackgroundClick={() => {
            setSelectedNode(null)
          }}
          warmupTicks={100}
          cooldownTicks={0}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />

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
                const memberNode = nodes.find(n => n.id === memberId)
                return (
                  <span
                    key={memberId}
                    className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    onClick={() => setSelectedNode(memberId)}
                  >
                    {memberNode?.name || memberId}
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

function buildNetworkData(world: WorldSlice): {
  nodes: NetworkNode[]
  links: NetworkLink[]
  communities: Array<{ id: number; members: string[] }>
} {
  const nodes: NetworkNode[] = []
  const links: NetworkLink[] = []

  const allAgents = world.agents.npcs.filter(a => a.life_status === 'alive')

  for (const agent of allAgents) {
    const connectionCount = Object.keys(agent.relations).length

    nodes.push({
      id: agent.genetics.seed,
      name: agent.identity.name,
      group: 0,
      size: Math.max(5, connectionCount * 2),
      color: '#3b82f6'
    })
  }

  for (const agent of allAgents) {
    for (const [target, value] of Object.entries(agent.relations)) {
      const existingLink = links.find(
        l => (l.source === agent.genetics.seed && l.target === target) ||
             (l.source === target && l.target === agent.genetics.seed)
      )

      if (!existingLink) {
        links.push({
          source: agent.genetics.seed,
          target,
          value: Math.abs(value),
          type: value > 0.3 ? 'positive' : value < -0.3 ? 'negative' : 'neutral'
        })
      }
    }
  }

  const communities = detectCommunities(nodes, links)

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
  for (const node of nodes) {
    const community = communities.find(c => c.members.includes(node.id))
    if (community) {
      node.group = community.id
      node.color = colors[community.id % colors.length]
    }
  }

  return { nodes, links, communities }
}

function detectCommunities(
  nodes: NetworkNode[],
  links: NetworkLink[]
): Array<{ id: number; members: string[] }> {
  const communities: Array<{ id: number; members: string[] }> = []
  const visited = new Set<string>()

  let communityId = 0

  for (const node of nodes) {
    if (visited.has(node.id)) continue

    const community: string[] = []
    const queue = [node.id]
    visited.add(node.id)

    while (queue.length > 0) {
      const current = queue.shift()!
      community.push(current)

      const neighbors = links
        .filter(l => l.source === current || l.target === current)
        .map(l => l.source === current ? l.target : l.source)
        .filter(n => !visited.has(n))

      for (const neighbor of neighbors) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }

    if (community.length > 0) {
      communities.push({ id: communityId++, members: community })
    }
  }

  return communities
}
