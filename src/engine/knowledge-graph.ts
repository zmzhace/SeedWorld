/**
 * Knowledge graph system — builds entity-relationship network for the world
 * Inspired by GraphRAG design patterns
 */

import type { PersonalAgentState, WorldSlice } from '@/domain/world'

/** Runtime ontology identifier. Genre-specific values are never platform constants. */
export type NodeType = string

export type KnowledgeNode = {
  id: string
  type: NodeType
  label: string
  properties: Record<string, any>
  embedding?: number[]  // for semantic search (future: plug in embeddings API)
  created_at: number  // tick
  updated_at: number  // tick
}

/** Runtime relation identifier supplied by the current world's ontology. */
export type RelationType = string

export type KnowledgeEdge = {
  id: string
  source: string  // node id
  target: string  // node id
  relation: RelationType
  weight: number  // relation strength [0-1]
  properties: Record<string, any>
  created_at: number  // tick
  updated_at: number  // tick
}

/**
 * Knowledge graph class
 */
export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map()
  private edges: Map<string, KnowledgeEdge> = new Map()
  
  // Indexes for fast queries
  private nodesByType: Map<NodeType, Set<string>> = new Map()
  private edgesBySource: Map<string, Set<string>> = new Map()
  private edgesByTarget: Map<string, Set<string>> = new Map()

  /**
   * Add node
   */
  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node)
    
    // Update type index
    if (!this.nodesByType.has(node.type)) {
      this.nodesByType.set(node.type, new Set())
    }
    this.nodesByType.get(node.type)!.add(node.id)
  }

  /**
   * Add edge
   */
  addEdge(edge: KnowledgeEdge): void {
    this.edges.set(edge.id, edge)
    
    // Update indexes
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
   * Get node
   */
  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id)
  }

  /**
   * Get edge
   */
  getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id)
  }

  /**
   * Get all nodes of a given type
   */
  getNodesByType(type: NodeType): KnowledgeNode[] {
    const nodeIds = this.nodesByType.get(type) || new Set()
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id)!)
      .filter(node => node !== undefined)
  }

  /**
   * Get all outgoing edges of a node
   */
  getOutgoingEdges(nodeId: string): KnowledgeEdge[] {
    const edgeIds = this.edgesBySource.get(nodeId) || new Set()
    return Array.from(edgeIds)
      .map(id => this.edges.get(id)!)
      .filter(edge => edge !== undefined)
  }

  /**
   * Get all incoming edges of a node
   */
  getIncomingEdges(nodeId: string): KnowledgeEdge[] {
    const edgeIds = this.edgesByTarget.get(nodeId) || new Set()
    return Array.from(edgeIds)
      .map(id => this.edges.get(id)!)
      .filter(edge => edge !== undefined)
  }

  /**
   * Get all neighbors of a node
   */
  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighbors = new Set<string>()
    
    // Outgoing edge targets
    for (const edge of this.getOutgoingEdges(nodeId)) {
      neighbors.add(edge.target)
    }
    
    // Incoming edge sources
    for (const edge of this.getIncomingEdges(nodeId)) {
      neighbors.add(edge.source)
    }
    
    return Array.from(neighbors)
      .map(id => this.nodes.get(id)!)
      .filter(node => node !== undefined)
  }

  /**
   * Query all information related to an agent (depth-first search)
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
      
      // Traverse all related edges
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
   * Find shortest path between two nodes
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

    return null  // no path found
  }

  /**
   * Get graph statistics
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
   * Update an existing node's properties (merge)
   */
  updateNode(id: string, updates: Partial<Pick<KnowledgeNode, 'label' | 'properties'>>, tick: number): void {
    const existing = this.nodes.get(id)
    if (!existing) return
    this.nodes.set(id, {
      ...existing,
      label: updates.label ?? existing.label,
      properties: { ...existing.properties, ...updates.properties },
      updated_at: tick,
    })
  }

  /**
   * Update an existing edge's weight/properties (merge)
   */
  updateEdge(id: string, updates: Partial<Pick<KnowledgeEdge, 'weight' | 'properties'>>, tick: number): void {
    const existing = this.edges.get(id)
    if (!existing) return
    this.edges.set(id, {
      ...existing,
      weight: updates.weight ?? existing.weight,
      properties: { ...existing.properties, ...updates.properties },
      updated_at: tick,
    })
  }

  /**
   * Upsert a node — add if missing, update if exists
   */
  upsertNode(node: KnowledgeNode): void {
    const existing = this.nodes.get(node.id)
    if (existing) {
      this.updateNode(node.id, { label: node.label, properties: node.properties }, node.updated_at)
    } else {
      this.addNode(node)
    }
  }

  /**
   * Upsert an edge — add if missing, update if exists
   */
  upsertEdge(edge: KnowledgeEdge): void {
    const existing = this.edges.get(edge.id)
    if (existing) {
      this.updateEdge(edge.id, { weight: edge.weight, properties: edge.properties }, edge.updated_at)
    } else {
      this.addEdge(edge)
    }
  }

  /**
   * Remove a node and all its connected edges
   */
  removeNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return

    // Remove from type index
    this.nodesByType.get(node.type)?.delete(id)

    // Remove all connected edges
    const outEdges = this.getOutgoingEdges(id)
    const inEdges = this.getIncomingEdges(id)
    for (const edge of [...outEdges, ...inEdges]) {
      this.removeEdge(edge.id)
    }

    this.nodes.delete(id)
  }

  /**
   * Remove an edge
   */
  removeEdge(id: string): void {
    const edge = this.edges.get(id)
    if (!edge) return

    this.edgesBySource.get(edge.source)?.delete(id)
    this.edgesByTarget.get(edge.target)?.delete(id)
    this.edges.delete(id)
  }

  /**
   * Incremental update from world state — only sync changes, don't rebuild
   */
  incrementalUpdate(world: WorldSlice): void {
    const tick = world.tick

    // 1. Sync agent nodes (add new, update existing, mark dead)
    const currentAgentIds = new Set(world.agents.npcs.map(a => a.genetics.seed))

    for (const agent of world.agents.npcs) {
      this.upsertNode({
        id: agent.genetics.seed,
        type: 'agent',
        label: agent.identity.name,
        properties: {
          name: agent.identity.name,
          occupation: agent.occupation,
          expertise: agent.expertise,
          goals: agent.goals,
          life_status: agent.life_status,
          location: agent.location,
          voice: agent.voice,
          approach: agent.approach,
          core_belief: agent.core_belief,
          last_action: agent.last_action_description,
        },
        created_at: tick,
        updated_at: tick,
      })
    }

    // Mark removed agents
    for (const node of this.getNodesByType('agent')) {
      if (!currentAgentIds.has(node.id)) {
        this.updateNode(node.id, { properties: { life_status: 'removed' } }, tick)
      }
    }

    // 2. Sync relationship edges
    for (const agent of world.agents.npcs) {
      for (const [targetSeed, value] of Object.entries(agent.relations)) {
        if (!this.nodes.has(targetSeed)) continue
        const relation: RelationType = value > 0 ? 'likes' : value < 0 ? 'dislikes' : 'knows'
        const edgeId = `${agent.genetics.seed}-rel-${targetSeed}`
        this.upsertEdge({
          id: edgeId,
          source: agent.genetics.seed,
          target: targetSeed,
          relation,
          weight: Math.abs(value),
          properties: { sentiment: value },
          created_at: tick,
          updated_at: tick,
        })
      }
    }

    // 3. Sync location edges
    for (const agent of world.agents.npcs) {
      if (!agent.location) continue
      const locNodeId = `loc-${agent.location}`

      // Ensure location node exists
      if (!this.nodes.has(locNodeId)) {
        this.addNode({
          id: locNodeId,
          type: 'location',
          label: agent.location,
          properties: {},
          created_at: tick,
          updated_at: tick,
        })
      }

      const edgeId = `${agent.genetics.seed}-at-${locNodeId}`
      this.upsertEdge({
        id: edgeId,
        source: agent.genetics.seed,
        target: locNodeId,
        relation: 'located_in',
        weight: 1.0,
        properties: {},
        created_at: tick,
        updated_at: tick,
      })
    }

    // 4. Add new narrative patterns
    for (const narrative of world.narratives.patterns) {
      this.upsertNode({
        id: narrative.id,
        type: 'concept',
        label: narrative.type,
        properties: {
          type: narrative.type,
          intensity: narrative.intensity,
          participants: narrative.participants,
          status: narrative.status,
        },
        created_at: narrative.started_at,
        updated_at: tick,
      })

      for (const seed of narrative.participants) {
        this.upsertEdge({
          id: `${narrative.id}-participant-${seed}`,
          source: seed,
          target: narrative.id,
          relation: 'participates_in',
          weight: narrative.intensity,
          properties: {},
          created_at: narrative.started_at,
          updated_at: tick,
        })
      }
    }

    // 5. Add new important events (only events not yet in graph)
    const importantEvents = world.events.filter(e =>
      ['agent_death', 'agent_reincarnation', 'agent_spawn'].includes(e.type) &&
      !this.nodes.has(e.id)
    )

    for (const event of importantEvents) {
      this.addNode({
        id: event.id,
        type: 'event',
        label: event.type,
        properties: {
          type: event.type,
          timestamp: event.timestamp,
          payload: event.payload,
        },
        created_at: tick,
        updated_at: tick,
      })

      if (event.payload?.agent_seed) {
        this.addEdge({
          id: `${event.id}-caused-by-${event.payload.agent_seed}`,
          source: event.payload.agent_seed as string,
          target: event.id,
          relation: 'caused_by',
          weight: 1.0,
          properties: {},
          created_at: tick,
          updated_at: tick,
        })
      }
    }
  }

  /**
   * Ingest an agent's action into the graph as an event node + edges
   */
  ingestAgentAction(
    agentSeed: string,
    action: {
      type: string
      target?: string
      description?: string
      location?: string
      is_conflict?: boolean
    },
    tick: number
  ): void {
    const eventId = `action-${agentSeed}-${tick}`

    // Add action as event node
    this.upsertNode({
      id: eventId,
      type: 'event',
      label: action.type,
      properties: {
        description: action.description,
        location: action.location,
        is_conflict: action.is_conflict,
        actor: agentSeed,
      },
      created_at: tick,
      updated_at: tick,
    })

    // Edge: agent caused this action
    this.upsertEdge({
      id: `${eventId}-by-${agentSeed}`,
      source: agentSeed,
      target: eventId,
      relation: 'caused_by',
      weight: 0.8,
      properties: {},
      created_at: tick,
      updated_at: tick,
    })

    // Edge: action targets another agent
    if (action.target && this.nodes.has(action.target)) {
      this.upsertEdge({
        id: `${eventId}-targets-${action.target}`,
        source: eventId,
        target: action.target,
        relation: 'related_to',
        weight: 0.7,
        properties: { role: 'target' },
        created_at: tick,
        updated_at: tick,
      })
    }

    // Edge: action happened at location
    if (action.location) {
      const locNodeId = `loc-${action.location}`
      if (this.nodes.has(locNodeId)) {
        this.upsertEdge({
          id: `${eventId}-at-${locNodeId}`,
          source: eventId,
          target: locNodeId,
          relation: 'located_in',
          weight: 0.5,
          properties: {},
          created_at: tick,
          updated_at: tick,
        })
      }
    }
  }

  /**
   * Build knowledge graph from world state
   */
  static buildFromWorld(world: WorldSlice): KnowledgeGraph {
    const graph = new KnowledgeGraph()
    const currentTick = world.tick

    // 1. Add all agents as nodes
    for (const agent of world.agents.npcs) {
      graph.addNode({
        id: agent.genetics.seed,
        type: 'agent',
        label: agent.identity.name,
        properties: {
          name: agent.identity.name,
          occupation: agent.occupation,
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

    // 2. Add relationship edges between agents
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

    // 3. Add narratives as nodes (emergent narrative system)
    for (const narrative of world.narratives.patterns) {
      graph.addNode({
        id: narrative.id,
        type: 'concept',
        label: narrative.type,
        properties: {
          type: narrative.type,
          intensity: narrative.intensity,
          participants: narrative.participants,
          status: narrative.status,
        },
        created_at: narrative.started_at,
        updated_at: currentTick,
      })

      // Connect narrative to participants
      for (const participantSeed of narrative.participants) {
        graph.addEdge({
          id: `${narrative.id}-participant-${participantSeed}`,
          source: participantSeed,
          target: narrative.id,
          relation: 'participates_in',
          weight: narrative.intensity,
          properties: {},
          created_at: narrative.started_at,
          updated_at: currentTick,
        })
      }
    }

    // 4. Add important events as nodes
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

      // Connect event to related agent
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

      // Connect event to related narrative
      if (event.payload?.narrative_id) {
        const narrativeId = event.payload.narrative_id as string
        graph.addEdge({
          id: `${event.id}-related-to-${narrativeId}`,
          source: event.id,
          target: narrativeId,
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
   * Trace causal chain — follow caused_by edges to find the chain of events
   * starting from a given event node. Returns the chain of connected events.
   */
  traceCausalChain(eventNodeId: string, maxDepth: number = 10): KnowledgeNode[] {
    const chain: KnowledgeNode[] = []
    const visited = new Set<string>()

    const traverse = (nodeId: string, depth: number) => {
      if (depth >= maxDepth || visited.has(nodeId)) return
      visited.add(nodeId)

      const node = this.nodes.get(nodeId)
      if (node) chain.push(node)

      // Follow caused_by and related_to edges
      for (const edge of this.edges.values()) {
        if (edge.source === nodeId && (edge.relation === 'caused_by' || edge.relation === 'related_to')) {
          traverse(edge.target, depth + 1)
        }
        if (edge.target === nodeId && edge.relation === 'caused_by') {
          traverse(edge.source, depth + 1)
        }
      }
    }

    traverse(eventNodeId, 0)
    return chain
  }

  /**
   * Export to JSON (for visualization)
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
   * Import from JSON
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
 * Create knowledge graph instance
 */
export function createKnowledgeGraph(world?: WorldSlice): KnowledgeGraph {
  if (world) {
    return KnowledgeGraph.buildFromWorld(world)
  }
  return new KnowledgeGraph()
}
