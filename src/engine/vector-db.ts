/**
 * 向量数据库 - 使用 Qdrant
 * 用于语义搜索和相似度匹配
 */

import { QdrantClient } from '@qdrant/js-client-rest'

export type VectorSearchResult = {
  id: string
  score: number
  payload: Record<string, any>
}

export type VectorSearchOptions = {
  topK?: number
  threshold?: number
  filter?: Record<string, any>
}

export class VectorDatabase {
  private client: QdrantClient
  private initialized = false
  
  constructor(url: string = process.env.QDRANT_URL || 'http://localhost:6333') {
    this.client = new QdrantClient({ url })
  }
  
  /**
   * 初始化数据库（创建集合）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      await this.createCollections()
      this.initialized = true
      console.log('[VectorDB] Initialized successfully')
    } catch (error) {
      console.error('[VectorDB] Initialization failed:', error)
      throw error
    }
  }
  
  /**
   * 创建所有需要的集合
   */
  private async createCollections(): Promise<void> {
    const collections = [
      { name: 'events', description: '事件向量' },
      { name: 'agent_interests', description: 'Agent 兴趣向量' },
      { name: 'memories', description: '记忆向量' },
      { name: 'nodes', description: '图节点向量' }
    ]
    
    for (const collection of collections) {
      try {
        // 检查集合是否存在
        await this.client.getCollection(collection.name)
        console.log(`[VectorDB] Collection '${collection.name}' already exists`)
      } catch (error) {
        // 集合不存在，创建它
        await this.client.createCollection(collection.name, {
          vectors: {
            size: 3072,  // text-embedding-3-large 的维度
            distance: 'Cosine'
          }
        })
        console.log(`[VectorDB] Created collection '${collection.name}'`)
      }
    }
  }
  
  /**
   * 插入向量
   */
  async insert(
    collection: string,
    id: string,
    vector: number[],
    payload: Record<string, any> = {}
  ): Promise<void> {
    await this.ensureInitialized()
    
    await this.client.upsert(collection, {
      points: [{
        id,
        vector,
        payload
      }]
    })
  }
  
  /**
   * 批量插入向量
   */
  async insertBatch(
    collection: string,
    points: Array<{ id: string; vector: number[]; payload?: Record<string, any> }>
  ): Promise<void> {
    await this.ensureInitialized()
    
    await this.client.upsert(collection, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload || {}
      }))
    })
  }
  
  /**
   * 搜索相似向量
   */
  async search(
    collection: string,
    vector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized()
    
    const { topK = 10, threshold = 0.7, filter } = options
    
    const results = await (this.client as unknown as { search: (name: string, input: Record<string, unknown>) => Promise<Array<{ id: string | number; score: number; payload?: Record<string, unknown> }>> }).search(collection, {
      vector,
      limit: topK,
      score_threshold: threshold,
      filter: filter ? { must: [filter] } : undefined
    })
    
    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload || {}
    }))
  }
  
  /**
   * 删除向量
   */
  async delete(collection: string, id: string): Promise<void> {
    await this.ensureInitialized()
    
    await this.client.delete(collection, {
      points: [id]
    })
  }
  
  /**
   * 清空集合
   */
  async clear(collection: string): Promise<void> {
    await this.ensureInitialized()
    
    await this.client.delete(collection, {
      filter: {}  // 删除所有
    })
  }
  
  /**
   * 获取集合统计信息
   */
  async getStats(collection: string): Promise<{
    pointsCount: number
    vectorsCount: number
  }> {
    await this.ensureInitialized()
    
    const info = await this.client.getCollection(collection)
    
    return {
      pointsCount: info.points_count || 0,
      vectorsCount: (info as any).vectors_count || 0
    }
  }
  
  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}

/**
 * 创建向量数据库实例（单例）
 */
let vectorDBInstance: VectorDatabase | null = null

export function getVectorDB(): VectorDatabase {
  if (!vectorDBInstance) {
    vectorDBInstance = new VectorDatabase()
  }
  return vectorDBInstance
}
