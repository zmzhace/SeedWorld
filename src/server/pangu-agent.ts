import type { PanguAgent } from '@/domain/agents'
import type { WorldSlice } from '@/domain/world'
import { generateStorylineEvent } from './llm/pangu-director'

/**
 * 盘古世界驱动 Agent
 * 负责观察世界状态，生成推动故事发展的事件
 */
export const panguDirectorAgent: PanguAgent = {
  id: 'pangu-director',
  role: 'macro',
  run: async (world: unknown) => {
    const worldSlice = world as WorldSlice
    
    // 每 3 个 tick 运行一次，避免过于频繁
    if (worldSlice.tick % 3 !== 0) {
      return {
        timeDelta: 0,
        events: [],
        rulesDelta: [],
        notes: ['Pangu director skipped this tick'],
        meta: {},
      }
    }
    
    console.log(`[Pangu Director] Running at tick ${worldSlice.tick}`)
    
    // 生成故事线事件
    const patch = await generateStorylineEvent(worldSlice)
    
    console.log(`[Pangu Director] Generated event:`, patch.events?.[0]?.summary || 'none')
    
    return patch
  },
}
