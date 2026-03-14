'use client'

import React from 'react'
import type { WorldSlice, PersonalAgentState } from '@/domain/world'

type SocialNetworkPanelProps = {
  world: WorldSlice
}

type NetworkNode = {
  id: string
  name: string
  group: number  // 社区 ID
  size: number   // 节点大小（基于连接数）
  color: string
}

type NetworkLink = {
  source: string
  target: string
  value: number  // 关系强度
  type: 'positive' | 'negative' | 'neutral'
}

export function SocialNetworkPanel({ world }: SocialNetworkPanelProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null)
  
  // 构建网络数据
  const { nodes, links, communities } = React.useMemo(() => {
    return buildNetworkData(world)
  }, [world])
  
  // 绘制网络图
  React.useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 设置画布大小
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    
    // 简单的力导向布局（简化版）
    const positions = calculateLayout(nodes, links, canvas.width, canvas.height)
    
    // 绘制
    drawNetwork(ctx, nodes, links, positions, hoveredNode, selectedNode)
  }, [nodes, links, hoveredNode, selectedNode])
  
  // 处理鼠标事件
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 查找点击的节点
    const positions = calculateLayout(nodes, links, canvas.width, canvas.height)
    const clickedNode = findNodeAtPosition(nodes, positions, x, y)
    
    setSelectedNode(clickedNode)
  }
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const positions = calculateLayout(nodes, links, canvas.width, canvas.height)
    const hoveredNode = findNodeAtPosition(nodes, positions, x, y)
    
    setHoveredNode(hoveredNode)
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default'
  }
  
  // 获取选中节点的详细信息
  const selectedAgent = selectedNode
    ? world.agents.npcs.find(a => a.genetics.seed === selectedNode)
    : null
  
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">社交网络</h3>
        <div className="text-sm text-gray-600">
          {nodes.length} 个节点 · {links.length} 条关系 · {communities.length} 个社区
        </div>
      </div>
      
      {/* 网络图 */}
      <div className="relative border rounded-lg bg-gray-50" style={{ height: '500px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        />
        
        {/* 图例 */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-semibold mb-2">图例</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500" />
              <span>友好关系</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500" />
              <span>敌对关系</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-400" />
              <span>中立关系</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 社区列表 */}
      <div className="grid grid-cols-2 gap-4">
        {communities.map((community, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-white">
            <div className="font-semibold mb-2">社区 {idx + 1}</div>
            <div className="text-sm text-gray-600">
              {community.members.length} 个成员
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {community.members.slice(0, 5).map(member => (
                <span
                  key={member}
                  className="text-xs bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200"
                  onClick={() => setSelectedNode(member)}
                >
                  {member}
                </span>
              ))}
              {community.members.length > 5 && (
                <span className="text-xs text-gray-500">
                  +{community.members.length - 5}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* 节点详情 */}
      {selectedAgent && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h4 className="font-semibold mb-3">{selectedAgent.identity.name}</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">职业：</span>
              {selectedAgent.occupation || '未知'}
            </div>
            <div>
              <span className="text-gray-600">信念：</span>
              {selectedAgent.core_belief || '未知'}
            </div>
            <div>
              <span className="text-gray-600">关系数量：</span>
              {Object.keys(selectedAgent.relations).length}
            </div>
            <div>
              <span className="text-gray-600">情感状态：</span>
              {selectedAgent.emotion.label} ({Math.round(selectedAgent.emotion.intensity * 100)}%)
            </div>
            {Object.keys(selectedAgent.relations).length > 0 && (
              <div>
                <span className="text-gray-600">主要关系：</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(selectedAgent.relations)
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 5)
                    .map(([target, value]) => (
                      <div key={target} className="flex items-center justify-between">
                        <span>{target}</span>
                        <span className={value > 0 ? 'text-green-600' : 'text-red-600'}>
                          {value > 0 ? '+' : ''}{value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 构建网络数据
function buildNetworkData(world: WorldSlice): {
  nodes: NetworkNode[]
  links: NetworkLink[]
  communities: Array<{ id: number; members: string[] }>
} {
  const nodes: NetworkNode[] = []
  const links: NetworkLink[] = []
  
  // 创建节点
  const allAgents = [world.agents.personal, ...world.agents.npcs]
  
  for (const agent of allAgents) {
    const connectionCount = Object.keys(agent.relations).length
    
    nodes.push({
      id: agent.genetics.seed,
      name: agent.identity.name,
      group: 0,  // 稍后分配社区
      size: Math.max(5, connectionCount * 2),
      color: '#3b82f6'
    })
  }
  
  // 创建连接
  for (const agent of allAgents) {
    for (const [target, value] of Object.entries(agent.relations)) {
      // 避免重复连接
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
  
  // 社区发现（简化版：基于连接密度）
  const communities = detectCommunities(nodes, links)
  
  // 为节点分配社区颜色
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

// 社区发现（简化版）
function detectCommunities(
  nodes: NetworkNode[],
  links: NetworkLink[]
): Array<{ id: number; members: string[] }> {
  const communities: Array<{ id: number; members: string[] }> = []
  const visited = new Set<string>()
  
  let communityId = 0
  
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    
    // BFS 查找连通分量
    const community: string[] = []
    const queue = [node.id]
    visited.add(node.id)
    
    while (queue.length > 0) {
      const current = queue.shift()!
      community.push(current)
      
      // 找到所有邻居
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

// 计算布局（简化的力导向布局）
function calculateLayout(
  nodes: NetworkNode[],
  links: NetworkLink[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  // 初始化随机位置
  for (const node of nodes) {
    positions.set(node.id, {
      x: Math.random() * width,
      y: Math.random() * height
    })
  }
  
  // 简化：使用圆形布局
  const radius = Math.min(width, height) * 0.35
  const centerX = width / 2
  const centerY = height / 2
  
  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI
    positions.set(node.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    })
  })
  
  return positions
}

// 绘制网络
function drawNetwork(
  ctx: CanvasRenderingContext2D,
  nodes: NetworkNode[],
  links: NetworkLink[],
  positions: Map<string, { x: number; y: number }>,
  hoveredNode: string | null,
  selectedNode: string | null
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  
  // 绘制连接
  for (const link of links) {
    const sourcePos = positions.get(link.source)
    const targetPos = positions.get(link.target)
    
    if (!sourcePos || !targetPos) continue
    
    ctx.beginPath()
    ctx.moveTo(sourcePos.x, sourcePos.y)
    ctx.lineTo(targetPos.x, targetPos.y)
    
    // 根据关系类型设置颜色
    if (link.type === 'positive') {
      ctx.strokeStyle = '#10b981'
    } else if (link.type === 'negative') {
      ctx.strokeStyle = '#ef4444'
    } else {
      ctx.strokeStyle = '#d1d5db'
    }
    
    ctx.lineWidth = link.value * 2
    ctx.stroke()
  }
  
  // 绘制节点
  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue
    
    const isHovered = node.id === hoveredNode
    const isSelected = node.id === selectedNode
    const radius = node.size * (isHovered || isSelected ? 1.5 : 1)
    
    // 绘制节点
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.fill()
    
    // 选中或悬停时添加边框
    if (isHovered || isSelected) {
      ctx.strokeStyle = isSelected ? '#1e40af' : '#60a5fa'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    
    // 绘制标签
    if (isHovered || isSelected) {
      ctx.fillStyle = '#000'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, pos.x, pos.y + radius + 15)
    }
  }
}

// 查找位置上的节点
function findNodeAtPosition(
  nodes: NetworkNode[],
  positions: Map<string, { x: number; y: number }>,
  x: number,
  y: number
): string | null {
  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue
    
    const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2))
    if (distance <= node.size) {
      return node.id
    }
  }
  
  return null
}
