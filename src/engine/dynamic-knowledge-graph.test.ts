import { describe, expect, it } from 'vitest'
import { KnowledgeGraph } from './knowledge-graph'

describe('dynamic knowledge graph', () => {
  it('accepts work-specific entity and relation identifiers', () => {
    const graph = new KnowledgeGraph()
    graph.addNode({ id: 'a', type: 'ConditionalExistence', label: '只对一人存在的对象', properties: {}, created_at: 0, updated_at: 0 })
    graph.addNode({ id: 'b', type: 'Observer', label: '观察者', properties: {}, created_at: 0, updated_at: 0 })
    graph.addEdge({ id: 'e', source: 'a', target: 'b', relation: 'VISIBLE_ONLY_TO', weight: 1, properties: {}, created_at: 0, updated_at: 0 })
    expect(graph.getNodesByType('ConditionalExistence')).toHaveLength(1)
    expect(graph.getOutgoingEdges('a')[0].relation).toBe('VISIBLE_ONLY_TO')
  })
})
