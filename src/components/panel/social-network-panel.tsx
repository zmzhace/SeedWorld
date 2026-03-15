'use client'

import React from 'react'
import dynamic from 'next/dynamic'
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

const ForceGraph = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type SocialNetworkPanelProps = {
  world: WorldSlice
}

type CommunityInfo = { id: number; members: string[] }

export function SocialNetworkPanel({ world }: SocialNetworkPanelProps) {
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(600)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => { setMounted(true) }, [])

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

  // Build graph with graphology + ForceAtlas2, then extract positions for react-force-graph
  const { graphData, communities, nodeNames } = React.useMemo(() => {
    return buildGraphData(world)
  }, [world])

  const selectedAgent = selectedNode
    ? world.agents.npcs.find(a => a.genetics.seed === selectedNode)
    : null

  // Custom node renderer
  const nodeCanvasObject = React.useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label as string
      const color = node.color as string
      const baseRadius = Math.max(4, Math.sqrt(node.val || 1) * 2.5)
      const isHovered = node.id === hoveredNode
      const isSelected = node.id === selectedNode
      const isHighlighted = isHovered || isSelected
      const radius = isHighlighted ? baseRadius * 1.4 : baseRadius

      const x = node.x as number
      const y = node.y as number

      // Glow
      if (isHighlighted) {
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 12)
        gradient.addColorStop(0, color + '30')
        gradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(x, y, radius + 12, 0, 2 * Math.PI)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Node
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = isHighlighted ? color : color + 'CC'
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Label
      const fontSize = Math.max(10, 12 / globalScale)
      ctx.font = `${isHighlighted ? '600 ' : '400 '}${fontSize}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const textWidth = ctx.measureText(label).width
      const textY = y + radius + 4 / globalScale
      const pad = 3 / globalScale

      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.beginPath()
      const rx = x - textWidth / 2 - pad
      const ry = textY - pad
      const rw = textWidth + pad * 2
      const rh = fontSize + pad * 2
      const r = 3 / globalScale
      ctx.moveTo(rx + r, ry)
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r)
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r)
      ctx.arcTo(rx, ry + rh, rx, ry, r)
      ctx.arcTo(rx, ry, rx + rw, ry, r)
      ctx.fill()

      ctx.fillStyle = isHighlighted ? '#1e293b' : '#64748b'
      ctx.fillText(label, x, textY)
    },
    [hoveredNode, selectedNode]
  )

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Network className="h-4 w-4 text-blue-500" />
          Social Network
        </h3>
        <div className="text-xs text-slate-500">
          {graphData.nodes.length} nodes · {graphData.links.length} links · {communities.length} clusters
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-slate-200 bg-white overflow-hidden"
        style={{ height: '500px' }}
      >
        {mounted && graphData.nodes.length > 0 && (
          <ForceGraph
            graphData={graphData}
            width={containerWidth}
            height={500}
            backgroundColor="#ffffff"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath()
              ctx.arc(node.x, node.y, Math.max(8, Math.sqrt(node.val || 1) * 3), 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
            linkColor={(link: any) => {
              const src = typeof link.source === 'object' ? link.source.id : link.source
              const tgt = typeof link.target === 'object' ? link.target.id : link.target
              const hl = src === hoveredNode || tgt === hoveredNode || src === selectedNode || tgt === selectedNode
              if (link.relType === 'positive') return hl ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.35)'
              if (link.relType === 'negative') return hl ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.35)'
              return hl ? 'rgba(148,163,184,0.5)' : 'rgba(203,213,225,0.3)'
            }}
            linkWidth={(link: any) => {
              const src = typeof link.source === 'object' ? link.source.id : link.source
              const tgt = typeof link.target === 'object' ? link.target.id : link.target
              const hl = src === hoveredNode || tgt === hoveredNode || src === selectedNode || tgt === selectedNode
              return hl ? (link.strength || 1) * 3 + 1 : Math.max(0.5, (link.strength || 1) * 1.5)
            }}
            linkLineDash={(link: any) => link.relType === 'negative' ? [5, 3] : null}
            linkDirectionalParticles={(link: any) => link.relType === 'positive' ? 2 : 0}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleWidth={2.5}
            linkDirectionalParticleColor={() => 'rgba(16,185,129,0.5)'}
            onNodeClick={(node: any) => setSelectedNode(node.id)}
            onNodeHover={(node: any) => setHoveredNode(node ? node.id : null)}
            onBackgroundClick={() => setSelectedNode(null)}
            cooldownTicks={0}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}

        {!mounted || graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No agents yet
          </div>
        ) : null}

        {/* Legend */}
        <div className="absolute top-3 right-3 rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-3 text-xs pointer-events-none">
          <div className="font-semibold text-slate-700 mb-2">Legend</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-emerald-500 rounded" />
              <span className="text-slate-500">Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500 rounded border-t border-dashed border-red-500" />
              <span className="text-slate-500">Negative</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-slate-300 rounded" />
              <span className="text-slate-500">Neutral</span>
            </div>
          </div>
        </div>
      </div>

      {/* Communities */}
      {communities.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {communities.map((community, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-sm text-slate-700">Cluster {idx + 1}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {community.members.slice(0, 6).map(id => (
                  <span
                    key={id}
                    className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    onClick={() => setSelectedNode(id)}
                  >
                    {nodeNames.get(id) || id}
                  </span>
                ))}
                {community.members.length > 6 && (
                  <span className="text-xs text-slate-400">+{community.members.length - 6}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected agent detail */}
      {selectedAgent && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="font-semibold text-sm text-slate-800 mb-3">{selectedAgent.identity.name}</h4>
          <div className="space-y-2 text-xs">
            <Row label="Occupation" value={selectedAgent.occupation || '—'} />
            <Row label="Core Belief" value={selectedAgent.core_belief || '—'} />
            <Row label="Emotion" value={`${selectedAgent.emotion.label} (${Math.round(selectedAgent.emotion.intensity * 100)}%)`} />
            {Object.keys(selectedAgent.relations).length > 0 && (
              <div className="pt-2 border-t border-blue-100 space-y-1">
                {Object.entries(selectedAgent.relations)
                  .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                  .slice(0, 5)
                  .map(([target, value]) => {
                    const name = world.agents.npcs.find(a => a.genetics.seed === target)?.identity.name || target
                    return (
                      <div key={target} className="flex items-center justify-between">
                        <span className="text-slate-500">{name}</span>
                        <span className={value > 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          {value > 0 ? '+' : ''}{value.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

/**
 * Build graph data using graphology for ForceAtlas2 layout,
 * then extract positions for react-force-graph-2d
 */
function buildGraphData(world: WorldSlice) {
  const aliveAgents = world.agents.npcs.filter(a => a.life_status === 'alive')
  const communityColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']
  const nodeNames = new Map<string, string>()

  // Build graphology graph for layout
  const g = new Graph()

  for (const agent of aliveAgents) {
    const connections = Object.keys(agent.relations).length
    nodeNames.set(agent.genetics.seed, agent.identity.name)
    g.addNode(agent.genetics.seed, {
      x: Math.random() * 200 - 100,
      y: Math.random() * 200 - 100,
      size: Math.max(3, 2 + connections),
    })
  }

  for (const agent of aliveAgents) {
    for (const [target, value] of Object.entries(agent.relations)) {
      if (!g.hasNode(target)) continue
      const edgeId = [agent.genetics.seed, target].sort().join('--')
      if (g.hasEdge(edgeId)) continue
      g.addEdgeWithKey(edgeId, agent.genetics.seed, target, { weight: Math.abs(value) })
    }
  }

  // Run ForceAtlas2
  if (g.order > 1) {
    forceAtlas2.assign(g, {
      iterations: 150,
      settings: {
        gravity: 2,
        scalingRatio: 20,
        barnesHutOptimize: g.order > 30,
        strongGravityMode: true,
        slowDown: 3,
      },
    })
  }

  // Community detection (BFS)
  const communities: CommunityInfo[] = []
  const visited = new Set<string>()
  let cid = 0

  g.forEachNode((nodeId) => {
    if (visited.has(nodeId)) return
    const members: string[] = []
    const queue = [nodeId]
    visited.add(nodeId)
    while (queue.length > 0) {
      const cur = queue.shift()!
      members.push(cur)
      g.forEachNeighbor(cur, (nb) => {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
      })
    }
    if (members.length > 0) {
      communities.push({ id: cid++, members })
    }
  })

  // Build react-force-graph data with pre-computed positions
  const communityMap = new Map<string, number>()
  for (const c of communities) {
    for (const m of c.members) communityMap.set(m, c.id)
  }

  const nodes = aliveAgents.map(agent => {
    const cIdx = communityMap.get(agent.genetics.seed) || 0
    const pos = g.hasNode(agent.genetics.seed) ? g.getNodeAttributes(agent.genetics.seed) : { x: 0, y: 0 }
    return {
      id: agent.genetics.seed,
      label: agent.identity.name,
      val: Math.max(2, Object.keys(agent.relations).length * 1.5),
      color: communityColors[cIdx % communityColors.length],
      fx: pos.x * 3,  // fix position (from ForceAtlas2)
      fy: pos.y * 3,
    }
  })

  const linkSet = new Set<string>()
  const links: any[] = []
  for (const agent of aliveAgents) {
    for (const [target, value] of Object.entries(agent.relations)) {
      if (!g.hasNode(target)) continue
      const key = [agent.genetics.seed, target].sort().join('--')
      if (linkSet.has(key)) continue
      linkSet.add(key)
      links.push({
        source: agent.genetics.seed,
        target,
        strength: Math.abs(value),
        relType: value > 0.3 ? 'positive' : value < -0.3 ? 'negative' : 'neutral',
      })
    }
  }

  return { graphData: { nodes, links }, communities, nodeNames }
}
