/**
 * 知识图谱系统 - 构建世界的实体关系网络
 * 参考 MiroFish 的 GraphRAG 设计
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'
import type { PlotArc } from '@/domain/siming'

export type NodeType = 'agent' | 'location' | 'organization' | 'event' | 'concept' | 'plot'

export type KnowledgeNode = {
  id: string
  type: NodeType
  label: string
  properties: Record<string, any>
  embedding?: number[]  // 用于语义搜索（未来可接入 OpenAI Embeddings）
  created_at: number  // tick
  updated_at: number  // tick
}

export type RelationType = 
  | 'knows'           // agent 认识 agent
  | 'likes'           // agent 喜欢 agent
  | 'dislikes'        // agent 不喜欢 agent
  | 'works_for'       // agent 为 organization 工作
  | 'located_in'      // agent/organization 位于 location
  | 'participates_in' // agent 参与 plot/event
  | 'caused_by'       // event 由 agent 引起
  | 'related_to'      // 通用关系
  | 'protagonist_of'  // agent 是 plot 的主角
  | 'antagonist_of'   // agent 是 plot 的对手
  | 'supports'        // agent 支持 plot

export type KnowledgeEdge = {
  id: string
  source: string  // node id
  target: string  // node id
  relation: RelationType
  weight: number  // 关系强度 [0-1]
  properties: Record<string, any>
  created_at: number  // tick
  updated_at: number  // tick
}

/**
 * 知识图谱类
 */
export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map()
  private edges: Map<string, KnowledgeEdge> = new Map()
  
  // 索引：加速查询
  private nodesByType: Map<NodeType, Set<string>> = new Map()
  private edgesBySource: Map<string, Set<string>> = new Map()
  private edgesByTarget: Map<string, Set<string>> = new Map()

  /**
   * 添加节点
   */
  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node)
    
    // 更新类型索引
    if (!this.nodesByType.has(node.type)) {
      this.nodesByType.set(node.type, new Set())
    }
    this.nodesByType.get(node.type)!.add(node.id)
  }

  /**
   * 添加边
   */
  addEdge(edge: KnowledgeEdge): void {
    this.edges.set(edge.id, edge)
    
    // 更新索引
    if (!this.edgesBySource.has(edge.source)) {
      this.edgesBySource.set(edge.source, new Set())
    }
    this.edgesBySource.get(edge.source)!.add(edge.id)
    
    if (!this.edgesByTarget.has(edge.target)) {
      this.edgesByTarget.set(edge.target, new Set())
    }
    this.edgesByTarget.get(edge.target)!.add(edge.id)
  }

  /**
   * 获取节点
   */
  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id)
  }

  /**
   * 获取边
   */
  getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id)
  }

  /**
   * 获取某类型的所有节点
   */
  getNodesByType(type: NodeType): KnowledgeNode[] {
    const nodeIds = this.nodesByType.get(type) || new Set()
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id)!)
      .filter(node => node !== undefined)
  }

  /**
   * 获取节点的所有出边
   */
  getOutgoingEdges(nodeId: string): KnowledgeEdge[] {
    const edgeIds = this.edgesBySource.get(nodeId) || new Set()
    return Array.from(edgeIds)
      .map(id => this.edges.get(id)!)
      .filter(edge => edge !== undefined)
  }

  /**
   * 获取节点的所有入边
   */
  getIncomingEdges(nodeId: string): KnowledgeEdge[] {
    const edgeIds = this.edgesByTarget.get(nodeId) || new Set()
    return Array.from(edgeIds)
      .map(id => this.edges.get(id)!)
      .filter(edge => edge !== undefined)
  }

  /**
   * 获取节点的所有邻居
   */
  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighbors = new Set<string>()
    
    // 出边的目标节点
    for (const edge of this.getOutgoingEdges(nodeId)) {
      neighbors.add(edge.target)
    }
    
    // 入边的源节点
    for (const edge of this.getIncomingEdges(nodeId)) {
      neighbors.add(edge.source)
    }
    
    return Array.from(neighbors)
      .map(id => this.nodes.get(id)!)
      .filter(node => node !== undefined)
  }

  /**
   * 查询与某个 agent 相关的所有信息（深度优先搜索）
   */
  getAgentContext(agentId: string, depth: number = 2): {
    nodes: KnowledgeNode[]
    edges: KnowledgeEdge[]
  } {
    const visited = new Set<string>()
    const resultNodes: KnowledgeNode[] = []
    const resultEdges: KnowledgeEdge[] = []
    
    const traverse = (nodeId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(nodeId)) return
      visited.add(nodeId)
      
      const node = this.nodes.get(nodeId)
      if (node) resultNodes.push(node)
      
      // 遍历所有相关边
      const outEdges = this.getOutgoingEdges(nodeId)
      const inEdges = this.getIncomingEdges(nodeId)
      
      for (const edge of [...outEdges, ...inEdges]) {
        if (!resultEdges.find(e => e.id === edge.id)) {
          resultEdges.push(edge)
        }
        
        const nextNodeId = edge.source === nodeId ? edge.target : edge.source
        traverse(nextNodeId, currentDepth + 1)
      }
    }
    
    traverse(agentId, 0)
    return { nodes: resultNodes, edges: resultEdges }
  }

  /**
   * 查找两个节点之间的最短路径
   */
  findShortestPath(sourceId: string, targetId: string): KnowledgeNode[] | null {
    if (sourceId === targetId) {
      const node = this.nodes.get(sourceId)
      return node ? [node] : null
    }

    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: sourceId, path: [sourceId] }]
    const visited = new Set<string>([sourceId])

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!

      for (const neighbor of this.getNeighbors(nodeId)) {
        if (neighbor.id === targetId) {
          const fullPath = [...path, neighbor.id]
          return fullPath.map(id => this.nodes.get(id)!).filter(n => n !== undefined)
        }

        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id)
          queue.push({ nodeId: neighbor.id, path: [...path, neighbor.id] })
        }
      }
    }

    return null  // 没有找到路径
  }

  /**
   * 获取图谱统计信息
   */
  getStats(): {
    totalNodes: number
    totalEdges: number
    nodesByType: Record<NodeType, number>
    avgDegree: number
  } {
    const nodesByType: Record<string, number> = {}
    for (const [type, nodeIds] of this.nodesByType.entries()) {
      nodesByType[type] = nodeIds.size
    }

    const totalDegrees = Array.from(this.nodes.keys()).reduce((sum, nodeId) => {
      return sum + this.getOutgoingEdges(nodeId).length + this.getIncomingEdges(nodeId).length
    }, 0)

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByType: nodesByType as Record<NodeType, number>,
      avgDegree: this.nodes.size > 0 ? totalDegrees / this.nodes.size : 0,
    }
  }

  /**
   * 从世界状态构建知识图谱
   */
  static buildFromWorld(world: WorldSlice): KnowledgeGraph {
    const graph = new KnowledgeGraph()
    const currentTick = world.tick

    // 1. 添加所有 agents 作为节点
    for (const agent of world.agents.npcs) {
      graph.addNode({
        id: agent.genetics.seed,
        type: 'agent',
        label: agent.identity.name,
        properties: {
          name: agent.identity.name,
          occupation: agent.occupation,
          role: agent.role,
          expertise: agent.expertise,
          goals: agent.goals,
          life_status: agent.life_status,
          voice: agent.voice,
          approach: agent.approach,
          core_belief: agent.core_belief,
        },
        created_at: currentTick,
        updated_at: currentTick,
      })
    }

    // 2. 添加 agents 之间的关系边
    for (const agent of world.agents.npcs) {
      for (const [otherAgentName, relationValue] of Object.entries(agent.relations)) {
        const otherAgent = world.agents.npcs.find(a => a.identity.name === otherAgentName)
        if (otherAgent) {
          const relation: RelationType = relationValue > 0 ? 'likes' : 'dislikes'
          graph.addEdge({
            id: `${agent.genetics.seed}-${relation}-${otherAgent.genetics.seed}`,
            source: agent.genetics.seed,
            target: otherAgent.genetics.seed,
            relation,
            weight: Math.abs(relationValue),
            properties: {
              sentiment: relationValue > 0 ? 'positive' : 'negative',
            },
            created_at: currentTick,
            updated_at: currentTick,
          })
        }
      }
    }

    // 3. 添加剧情作为节点
    for (const plot of world.plots) {
      graph.addNode({
        id: plot.id,
        type: 'plot',
        label: plot.title,
        properties: {
          title: plot.title,
          description: plot.description,
          type: plot.type,
          status: plot.status,
          current_stage: plot.current_stage,
          stages: plot.stages,
        },
        created_at: plot.created_at,
        updated_at: currentTick,
      })

      // 连接剧情与主角
      for (const protagonistSeed of plot.protagonists) {
        graph.addEdge({
          id: `${plot.id}-protagonist-${protagonistSeed}`,
          source: protagonistSeed,
          target: plot.id,
          relation: 'protagonist_of',
          weight: 1.0,
          properties: {},
          created_at: plot.created_at,
          updated_at: currentTick,
        })
      }

      // 连接剧情与对手
      for (const antagonistSeed of plot.antagonists) {
        graph.addEdge({
          id: `${plot.id}-antagonist-${antagonistSeed}`,
          source: antagonistSeed,
          target: plot.id,
          relation: 'antagonist_of',
          weight: 1.0,
          properties: {},
          created_at: plot.created_at,
          updated_at: currentTick,
        })
      }

      // 连接剧情与配角
      for (const supportingSeed of plot.supporting) {
        graph.addEdge({
          id: `${plot.id}-supporting-${supportingSeed}`,
          source: supportingSeed,
          target: plot.id,
          relation: 'supports',
          weight: 0.7,
          properties: {},
          created_at: plot.created_at,
          updated_at: currentTick,
        })
      }
    }

    // 4. 添加重要事件作为节点
    const importantEvents = world.events.filter(e => 
      ['plot_triggered', 'plot_completed', 'agent_death', 'agent_reincarnation'].includes(e.type)
    )

    for (const event of importantEvents) {
      graph.addNode({
        id: event.id,
        type: 'event',
        label: event.type,
        properties: {
          type: event.type,
          timestamp: event.timestamp,
          payload: event.payload,
        },
        created_at: currentTick,
        updated_at: currentTick,
      })

      // 连接事件与相关 agent
      if (event.payload?.agent_seed) {
        const agentSeed = event.payload.agent_seed as string
        graph.addEdge({
          id: `${event.id}-caused-by-${agentSeed}`,
          source: agentSeed,
          target: event.id,
          relation: 'caused_by',
          weight: 1.0,
          properties: {},
          created_at: currentTick,
          updated_at: currentTick,
        })
      }

      // 连接事件与相关剧情
      if (event.payload?.plot_id) {
        const plotId = event.payload.plot_id as string
        graph.addEdge({
          id: `${event.id}-related-to-${plotId}`,
          source: event.id,
          target: plotId,
          relation: 'related_to',
          weight: 1.0,
          properties: {},
          created_at: currentTick,
          updated_at: currentTick,
        })
      }
    }

    return graph
  }

  /**
   * 导出为 JSON 格式（用于可视化）
   */
  toJSON(): {
    nodes: KnowledgeNode[]
    edges: KnowledgeEdge[]
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    }
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): KnowledgeGraph {
    const graph = new KnowledgeGraph()
    
    for (const node of data.nodes) {
      graph.addNode(node)
    }
    
    for (const edge of data.edges) {
      graph.addEdge(edge)
    }
    
    return graph
  }
}

/**
 * 创建知识图谱实例
 */
export function createKnowledgeGraph(world?: WorldSlice): KnowledgeGraph {
  if (world) {
    return KnowledgeGraph.buildFromWorld(world)
  }
  return new KnowledgeGraph()
}
