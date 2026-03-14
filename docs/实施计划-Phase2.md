# Phase 2 实施计划：移除司命系统，实现涌现式叙事

## 目标
彻底移除自上而下的剧情控制系统（司命），实现真正的自下而上涌现式叙事。

## 时间估计
1 周

## 核心理念转变

### 从控制到涌现

**旧模式（司命系统）**：
```
司命预设剧情 → 设定触发条件 → 强制 agents 按剧本行动 → 检查成功/失败
```

**新模式（涌现式叙事）**：
```
Agents 自由互动 → 产生事件流 → 识别叙事模式 → 自然形成故事弧
```

## 实施步骤

### Step 1: 分析司命系统的影响范围

需要移除或修改的文件：

#### 核心文件（需要删除）
- `src/domain/siming.ts` - 司命类型定义
- `src/server/llm/siming-generator.ts` - 司命剧情生成器
- `src/server/llm/siming-nuwa-coordinator.ts` - 司命-女娲协调器
- `src/engine/plot-executor.ts` - 剧情执行器

#### API 端点（需要删除）
- `app/api/plots/generate/route.ts` - 生成剧情
- `app/api/plots/coordinate/route.ts` - 协调剧情
- `app/api/worlds/initialize/route.ts` - 初始化世界（包含司命调用）

#### UI 组件（需要删除或修改）
- `src/components/panel/siming-panel.tsx` - 司命面板

#### 依赖文件（需要修改）
- `src/domain/world.ts` - 移除 `plots: PlotArc[]`
- `src/engine/orchestrator.ts` - 移除剧情系统调用
- `src/domain/agents.ts` - 移除剧情相关字段（如果有）
- `app/worlds/[id]/page.tsx` - 移除剧情相关 UI

### Step 2: 创建涌现式叙事系统

#### 2.1 叙事模式识别器

**文件**: `src/engine/narrative-recognizer.ts`

**功能**:
- 从事件流中识别叙事模式
- 检测冲突、联盟、转变、发现等模式
- 追踪叙事发展阶段
- 计算叙事强度和情感曲线

**核心算法**:
```typescript
// 冲突检测：两个 agents 之间的对抗性互动
detectConflicts(events) {
  // 1. 找到涉及相同 agents 的事件序列
  // 2. 分析情感极性（正负）
  // 3. 检测对抗模式（情感相反）
  // 4. 计算冲突强度
}

// 联盟检测：agents 形成合作关系
detectAlliances(events) {
  // 1. 找到协作性互动
  // 2. 检测共同目标
  // 3. 追踪关系强化
}

// 转变检测：agent 的重大改变
detectTransformations(events) {
  // 1. 比较 agent 状态变化
  // 2. 检测目标、信念、关系的重大转变
  // 3. 识别转折点
}

// 发现检测：揭示重要信息
detectDiscoveries(events) {
  // 1. 检测知识获取事件
  // 2. 识别秘密揭露
  // 3. 追踪信息传播
}
```

#### 2.2 故事弧检测器

**文件**: `src/engine/story-arc-detector.ts`

**功能**:
- 识别经典故事结构（起承转合）
- 检测情节点（inciting incident, climax, resolution）
- 追踪多条故事线
- 评估故事完整性

**故事弧模型**:
```typescript
type StoryArc = {
  id: string
  type: 'main' | 'subplot'
  structure: {
    setup: NarrativePattern[]      // 铺垫
    rising: NarrativePattern[]     // 上升
    climax: NarrativePattern[]     // 高潮
    falling: NarrativePattern[]    // 下降
    resolution: NarrativePattern[] // 解决
  }
  emotional_curve: number[]  // 情感曲线
  participants: string[]     // 参与者
  status: 'emerging' | 'developing' | 'climax' | 'resolving' | 'concluded'
}
```

#### 2.3 叙事总结器

**文件**: `src/engine/narrative-summarizer.ts`

**功能**:
- 将事件流总结为连贯的叙事
- 生成章节和段落
- 保持叙事一致性
- 支持多种叙事风格

**总结策略**:
```typescript
// 基于时间窗口的总结
summarizeByTimeWindow(events, windowSize) {
  // 将事件按时间分组
  // 每个窗口生成一个章节
}

// 基于叙事模式的总结
summarizeByNarrativePattern(patterns) {
  // 按叙事模式组织内容
  // 突出关键转折点
}

// 基于角色视角的总结
summarizeByCharacterPerspective(agent, events) {
  // 从特定角色视角叙述
  // 只包含该角色知道的信息
}
```

### Step 3: 更新数据模型

#### 3.1 移除剧情相关字段

**修改**: `src/domain/world.ts`

```typescript
// 移除
export type WorldSlice = {
  // ...
  plots: PlotArc[]  // ❌ 删除这个
}

// 添加
export type WorldSlice = {
  // ...
  narratives: {
    patterns: NarrativePattern[]  // 识别出的叙事模式
    arcs: StoryArc[]              // 涌现的故事弧
    summaries: NarrativeSummary[] // 叙事总结
  }
}
```

#### 3.2 更新 Agent 状态

**修改**: `src/domain/agents.ts`

```typescript
// 移除剧情相关字段
export type PersonalAgentState = {
  // ...
  // role: 'protagonist' | 'supporting' | 'npc'  // ❌ 删除固定角色
  
  // 添加动态角色识别
  narrative_roles: {
    [narrativeId: string]: {
      role: 'protagonist' | 'antagonist' | 'supporting' | 'observer'
      involvement: number  // 参与度 [0-1]
      impact: number       // 影响力 [0-1]
    }
  }
}
```

### Step 4: 重构 Orchestrator

**修改**: `src/engine/orchestrator.ts`

#### 移除剧情系统调用

```typescript
// ❌ 删除这些
import { checkPlotTriggers, advancePlotStages, applyPlotInfluenceToAgents } from './plot-executor'

// 移除剧情检查和推进
const { triggeredPlots, completedPlots, failedPlots } = checkPlotTriggers(next)
const { updatedPlots: plotsWithAdvancedStages, stageEvents } = advancePlotStages(next)
```

#### 添加叙事识别

```typescript
// ✅ 添加这些
import { NarrativeRecognizer } from './narrative-recognizer'
import { StoryArcDetector } from './story-arc-detector'
import { NarrativeSummarizer } from './narrative-summarizer'

// 在每个 tick 识别叙事模式
const narrativeRecognizer = new NarrativeRecognizer(graphRAG)
const newPatterns = await narrativeRecognizer.recognizePatterns(
  world.events.slice(-100),  // 最近 100 个事件
  graphRAG
)

// 更新现有模式
const updatedPatterns = await Promise.all(
  world.narratives.patterns.map(pattern =>
    narrativeRecognizer.trackNarrativeDevelopment(pattern, world.events.slice(-10))
  )
)

// 检测故事弧
const storyArcDetector = new StoryArcDetector()
const newArcs = await storyArcDetector.detectArcs(updatedPatterns)

// 生成叙事总结（每 N 个 tick）
if (world.tick % 10 === 0) {
  const summarizer = new NarrativeSummarizer()
  const summary = await summarizer.summarize(updatedPatterns, world.events)
  world.narratives.summaries.push(summary)
}
```

### Step 5: 更新 UI

#### 5.1 移除司命面板

删除 `src/components/panel/siming-panel.tsx`

#### 5.2 创建叙事面板

**新文件**: `src/components/panel/narrative-panel.tsx`

**功能**:
- 显示识别出的叙事模式
- 展示故事弧的发展
- 显示叙事总结
- 可视化情感曲线

**UI 结构**:
```
┌─────────────────────────────────────┐
│ 涌现的叙事                           │
├─────────────────────────────────────┤
│ 🔥 冲突: Alice vs Bob               │
│    强度: ████████░░ 80%             │
│    阶段: 高潮                        │
│    参与者: Alice, Bob, Charlie      │
├─────────────────────────────────────┤
│ 🤝 联盟: Research Team              │
│    强度: ██████░░░░ 60%             │
│    阶段: 发展中                      │
│    成员: Alice, David, Eve          │
├─────────────────────────────────────┤
│ 🔄 转变: Bob's Redemption           │
│    强度: ███████░░░ 70%             │
│    阶段: 解决中                      │
│    影响: Bob, Alice                 │
└─────────────────────────────────────┘
```

#### 5.3 更新世界页面

**修改**: `app/worlds/[id]/page.tsx`

```typescript
// 移除剧情标签
// <Tab value="plots">剧情</Tab>

// 添加叙事标签
<Tab value="narratives">涌现叙事</Tab>

// 内容区域
{activeTab === 'narratives' && (
  <NarrativePanel world={world} />
)}
```

### Step 6: 创建迁移脚本

**文件**: `scripts/migrate-to-emergent-narrative.ts`

**功能**:
- 将现有世界的剧情数据转换为叙事模式
- 保留重要的叙事信息
- 更新数据库结构

```typescript
async function migrateWorld(worldId: string) {
  // 1. 加载旧世界数据
  const oldWorld = await loadWorld(worldId)
  
  // 2. 转换剧情为叙事模式
  const narrativePatterns = oldWorld.plots.map(plot => ({
    type: inferNarrativeType(plot),
    participants: [...plot.protagonists, ...plot.antagonists, ...plot.supporting],
    events: [],  // 需要从历史事件中重建
    intensity: calculateIntensity(plot),
    status: mapPlotStatusToNarrativeStatus(plot.status)
  }))
  
  // 3. 创建新世界结构
  const newWorld = {
    ...oldWorld,
    plots: undefined,  // 移除
    narratives: {
      patterns: narrativePatterns,
      arcs: [],
      summaries: []
    }
  }
  
  // 4. 保存
  await saveWorld(newWorld)
}
```

## 测试计划

### 单元测试

#### 叙事识别器测试
```typescript
describe('NarrativeRecognizer', () => {
  it('should detect conflicts', async () => {
    const events = createConflictEvents()
    const patterns = await recognizer.recognizePatterns(events)
    expect(patterns).toContainEqual(
      expect.objectContaining({ type: 'conflict' })
    )
  })
  
  it('should detect alliances', async () => {
    const events = createAllianceEvents()
    const patterns = await recognizer.recognizePatterns(events)
    expect(patterns).toContainEqual(
      expect.objectContaining({ type: 'alliance' })
    )
  })
  
  it('should track narrative development', async () => {
    const pattern = createNarrativePattern()
    const newEvents = createFollowUpEvents()
    const updated = await recognizer.trackNarrativeDevelopment(pattern, newEvents)
    expect(updated.status).toBe('developing')
  })
})
```

#### 故事弧检测器测试
```typescript
describe('StoryArcDetector', () => {
  it('should detect story structure', async () => {
    const patterns = createNarrativePatterns()
    const arcs = await detector.detectArcs(patterns)
    expect(arcs[0].structure).toHaveProperty('setup')
    expect(arcs[0].structure).toHaveProperty('climax')
  })
  
  it('should identify climax', async () => {
    const patterns = createClimaxPatterns()
    const arcs = await detector.detectArcs(patterns)
    expect(arcs[0].status).toBe('climax')
  })
})
```

### 集成测试

```typescript
describe('Emergent Narrative System', () => {
  it('should recognize narratives from agent interactions', async () => {
    // 1. 创建世界和 agents
    const world = createTestWorld()
    
    // 2. 模拟 agents 互动
    for (let i = 0; i < 50; i++) {
      world = await runWorldTick(world)
    }
    
    // 3. 检查是否识别出叙事
    expect(world.narratives.patterns.length).toBeGreaterThan(0)
  })
  
  it('should form story arcs naturally', async () => {
    const world = createTestWorld()
    
    // 模拟长时间运行
    for (let i = 0; i < 200; i++) {
      world = await runWorldTick(world)
    }
    
    // 应该形成完整的故事弧
    const completedArcs = world.narratives.arcs.filter(
      arc => arc.status === 'concluded'
    )
    expect(completedArcs.length).toBeGreaterThan(0)
  })
})
```

### 对比测试

```typescript
describe('Siming vs Emergent Narrative', () => {
  it('emergent narratives should be more diverse', async () => {
    // 运行多次模拟
    const runs = []
    for (let i = 0; i < 10; i++) {
      const world = createTestWorld()
      for (let j = 0; j < 100; j++) {
        world = await runWorldTick(world)
      }
      runs.push(world.narratives)
    }
    
    // 计算叙事多样性
    const diversity = calculateNarrativeDiversity(runs)
    expect(diversity).toBeGreaterThan(0.7)  // 高多样性
  })
})
```

## 性能优化

### 1. 叙事识别缓存
```typescript
class NarrativeRecognizer {
  private cache = new Map<string, NarrativePattern[]>()
  
  async recognizePatterns(events: WorldEvent[]) {
    const cacheKey = this.generateCacheKey(events)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    const patterns = await this.doRecognize(events)
    this.cache.set(cacheKey, patterns)
    return patterns
  }
}
```

### 2. 增量更新
```typescript
// 不要每次都重新识别所有事件
// 只处理新事件
async recognizePatternsIncremental(
  existingPatterns: NarrativePattern[],
  newEvents: WorldEvent[]
) {
  // 1. 更新现有模式
  const updated = await this.updatePatterns(existingPatterns, newEvents)
  
  // 2. 只在新事件中寻找新模式
  const newPatterns = await this.findNewPatterns(newEvents)
  
  return [...updated, ...newPatterns]
}
```

### 3. 并行处理
```typescript
// 并行识别不同类型的叙事模式
async recognizePatterns(events: WorldEvent[]) {
  const [conflicts, alliances, transformations, discoveries] = await Promise.all([
    this.detectConflicts(events),
    this.detectAlliances(events),
    this.detectTransformations(events),
    this.detectDiscoveries(events)
  ])
  
  return [...conflicts, ...alliances, ...transformations, ...discoveries]
}
```

## 回滚计划

如果涌现式叙事系统出现问题，可以：

1. **保留旧代码的备份**
   ```bash
   git checkout -b backup-siming-system
   git push origin backup-siming-system
   ```

2. **创建功能开关**
   ```typescript
   const USE_EMERGENT_NARRATIVE = process.env.USE_EMERGENT_NARRATIVE === 'true'
   
   if (USE_EMERGENT_NARRATIVE) {
     // 使用新系统
   } else {
     // 使用旧系统
   }
   ```

3. **渐进式迁移**
   - 先在新世界中使用涌现式叙事
   - 旧世界继续使用司命系统
   - 逐步迁移

## 成功标准

### 功能标准
- [ ] 能够从 agents 互动中识别叙事模式
- [ ] 能够追踪叙事发展
- [ ] 能够形成完整的故事弧
- [ ] 能够生成连贯的叙事总结

### 质量标准
- [ ] 叙事多样性 > 70%（每次运行都不同）
- [ ] 叙事连贯性 > 80%（LLM 评估）
- [ ] 用户满意度 > 85%

### 性能标准
- [ ] 叙事识别 < 500ms / tick
- [ ] 内存占用 < 500MB（1000 agents）
- [ ] 无明显性能退化

## 时间表

| 任务 | 预计时间 | 负责人 |
|------|---------|--------|
| Step 1: 分析影响范围 | 0.5 天 | - |
| Step 2: 创建叙事系统 | 2 天 | - |
| Step 3: 更新数据模型 | 0.5 天 | - |
| Step 4: 重构 Orchestrator | 1 天 | - |
| Step 5: 更新 UI | 1 天 | - |
| Step 6: 测试和优化 | 2 天 | - |
| **总计** | **7 天** | - |

## 下一步

完成 Phase 2 后，进入 Phase 3：实现涌现式叙事的高级功能。
