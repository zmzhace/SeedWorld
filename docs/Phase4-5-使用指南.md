# Phase 4-5 使用指南

## 快速开始

所有 Phase 4-5 的系统已经集成到 orchestrator 中，会自动运行。无需额外配置！

### 启动系统

```bash
# 1. 启动 Qdrant（如果还没启动）
docker-compose up -d

# 2. 启动开发服务器
npm run dev

# 3. 创建新世界或打开现有世界
# 系统会自动初始化所有高级机制
```

---

## 系统概览

### 自动运行的系统

以下系统在每个 tick 自动执行：

1. **声誉系统** - 追踪 agents 的声誉变化
2. **认知偏差系统** - 影响 agents 的决策
3. **资源竞争系统** - 管理资源分配和竞争
4. **戏剧张力系统** - 创造和维持故事张力
5. **涌现属性检测器** - 发现系统中的涌现现象
6. **社会角色系统** - 为 agents 分配社会角色
7. **模因传播系统** - 传播想法和信念
8. **分层记忆系统** - 管理 agents 的记忆
9. **注意力机制** - 限制 agents 的注意力

### 日志输出

系统会定期（每 10 个 tick）输出统计信息：

```
[ReputationSystem] Avg trust: 0.52, Events: 145
[RoleSystem] 24 roles, 3 conflicts
[ResourceSystem] Scarcity: 0.35, Claims: 18
[TensionSystem] Overall: 0.67, Active: 5, Peak: 2
[EmergenceDetector] Detected 2 emergent properties:
  - self_organization: Agents 自发形成了 3 个社群 (strength: 0.75)
  - synchronization: 群体情绪同步为"excited" (strength: 0.82)
[MemeSystem] Memes: 23, Transmissions: 45, Mutation rate: 15.3%
[AttentionMechanism] Avg focus: 2.3/3.5, Fatigue: 32.1%
[MemorySystem] WM: 5/7, STM: 38/50, LTM: 127
```

---

## 手动使用系统

虽然系统自动运行，但你也可以手动访问它们：

### 1. 声誉系统

```typescript
import { ReputationSystem } from '@/engine/reputation-system'

const reputationSystem = new ReputationSystem()

// 初始化 agent 声誉
const reputation = reputationSystem.initializeReputation(agent)

// 更新声誉（基于行动）
reputationSystem.updateReputation(
  agent,
  {
    type: 'help',
    target: 'other-agent-id',
    success: true,
    witnesses: ['witness1', 'witness2']
  },
  currentTick
)

// 查询声誉（从观察者视角）
const query = reputationSystem.queryReputation(
  'observer-id',
  'target-id',
  world
)

console.log(`Trust: ${query.perspective.trustworthiness}`)
console.log(`Confidence: ${query.confidence}`)

// 获取排名
const trustRanking = reputationSystem.getReputationRanking('trustworthiness')
```

### 2. 认知偏差系统

```typescript
import { CognitiveBiasSystem } from '@/engine/cognitive-bias-system'

const biasSystem = new CognitiveBiasSystem()

// 为 agent 分配偏差
const biases = biasSystem.assignBiases(agent)

// 应用偏差到决策
const { modified_decision, effects } = biasSystem.applyBiasToDecision(
  agent,
  decision,
  {
    world,
    alternatives: [],
    history: []
  },
  biases
)

console.log('Applied biases:', effects.map(e => e.bias_type))
```

### 3. 资源竞争系统

```typescript
import { ResourceCompetitionSystem } from '@/engine/resource-competition-system'

const resourceSystem = new ResourceCompetitionSystem()

// 初始化资源
resourceSystem.initializeResources(world)

// Agent 声明资源需求
resourceSystem.claimResource(
  agent,
  'food',
  10,
  'cooperate'
)

// 竞争资源
const result = resourceSystem.competeForResource('food', agents)

console.log('Allocations:', result.allocations)
console.log('Conflicts:', result.conflicts)
console.log('Cooperations:', result.cooperations)

// 资源再生
resourceSystem.regenerateResources()
```

### 4. 戏剧张力系统

```typescript
import { DramaticTensionSystem } from '@/engine/dramatic-tension-system'

const tensionSystem = new DramaticTensionSystem()

// 检测并创建张力
const newTensions = tensionSystem.detectAndCreateTension(world, narratives)

// 累积张力
for (const tension of tensionSystem.getActiveTensions()) {
  tensionSystem.buildupTension(tension.id, world.events, currentTick)
}

// 检查释放条件
tensionSystem.checkReleaseConditions(world, narratives)

// 计算整体张力
const overallTension = tensionSystem.calculateOverallTension(world)

// 创建惊奇事件
const surprise = tensionSystem.createSurprise(
  world,
  '一个神秘的陌生人出现了'
)

// 获取张力节奏
const rhythm = tensionSystem.getTensionRhythm(20)
```

### 5. 涌现属性检测器

```typescript
import { EmergentPropertyDetector } from '@/engine/emergent-property-detector'

const detector = new EmergentPropertyDetector()

// 检测涌现
const properties = detector.detectEmergence(world, worldHistory)

for (const prop of properties) {
  console.log(`${prop.type}: ${prop.description}`)
  console.log(`Strength: ${prop.strength}, Novelty: ${prop.novelty}`)
  console.log(`Participants: ${prop.participants.length}`)
}

// 获取最近的涌现
const recent = detector.getRecentProperties(5)
```

### 6. 社会角色系统

```typescript
import { SocialRoleSystem } from '@/engine/social-role-system'

const roleSystem = new SocialRoleSystem()

// 为 agent 分配角色
const roles = roleSystem.assignRoles(agent, world)

for (const role of roles) {
  console.log(`Role: ${role.name} (${role.type})`)
  console.log(`Expectations: ${role.expectations.join(', ')}`)
  console.log(`Identity strength: ${role.identity_strength}`)
}

// 检测角色冲突
const conflicts = roleSystem.detectRoleConflicts(agent)

// 角色转换
const currentRole = roleSystem.switchRole(agent, '工作场合', world)

// 应用角色影响
const influence = roleSystem.applyRoleInfluence(
  agent,
  { type: 'help', target: 'someone' },
  currentRole
)
```

### 7. 模因传播系统

```typescript
import { MemePropagationSystem } from '@/engine/meme-propagation-system'

const memeSystem = new MemePropagationSystem()

// 创建模因
const meme = memeSystem.createMeme(
  '合作才能共赢',
  'value',
  agent.genetics.seed,
  currentTick
)

// 传播模因
const transmissions = memeSystem.propagateMeme(
  meme,
  socialNetwork,
  agents,
  currentTick
)

// 从 agent 提取模因
const newMemes = memeSystem.extractMemesFromAgent(agent, currentTick)

// 应用模因到 agent
const updatedAgent = memeSystem.applyMemeToAgent(meme, agent, currentTick)

// 获取最流行的模因
const popular = memeSystem.getMostPopularMemes(10)

// 模因衰减
memeSystem.decayMemes(currentTick)
```

### 8. 分层记忆系统

```typescript
import { HierarchicalMemorySystem } from '@/engine/hierarchical-memory-system'

const memorySystem = new HierarchicalMemorySystem()

// 从现有 agent 迁移
memorySystem.migrateFromAgent(agent, currentTick)

// 添加到工作记忆
const wm = memorySystem.addToWorkingMemory(
  '看到了一个有趣的事件',
  'perception',
  currentTick
)

// 添加到短期记忆
const stm = memorySystem.addToShortTermMemory(
  '与朋友进行了深入交谈',
  0.8,  // importance
  0.6,  // emotional_weight
  'social',
  currentTick
)

// 复述记忆（增强巩固）
memorySystem.rehearseMemory(stm.id, currentTick)

// 检索记忆
const memories = memorySystem.retrieve(
  {
    keywords: ['朋友', '交谈'],
    importance_min: 0.5,
    emotion_range: [0, 1]
  },
  currentTick,
  10
)

// 应用衰减和巩固
memorySystem.applyDecay(currentTick)

// 导出为 agent 格式
const exported = memorySystem.exportToAgent()
agent.memory_short = exported.memory_short
agent.memory_long = exported.memory_long
```

### 9. 注意力机制

```typescript
import { AttentionMechanism } from '@/engine/attention-mechanism'

const attentionMechanism = new AttentionMechanism()

// 初始化注意力
const state = attentionMechanism.initializeAttention(agent)

// 创建刺激
const stimulus = attentionMechanism.createStimulus(
  'event',
  'event-123',
  'A major conflict occurred',
  {
    salience: 0.9,
    urgency: 0.8,
    relevance: 0.7
  }
)

// 从世界生成刺激
const stimuli = attentionMechanism.generateStimuliFromWorld(world, agent)

// 分配注意力
const allocations = attentionMechanism.allocateAttention(
  agent,
  stimuli,
  currentTick
)

// 转移注意力
const shifted = attentionMechanism.shiftAttention(
  agent,
  stimulus,
  currentTick
)

// 恢复注意力
attentionMechanism.recoverAttention(agent)

// 检查是否在关注
const isAttending = attentionMechanism.isAttendingTo(
  agent.genetics.seed,
  'event-123'
)
```

---

## 集成到自定义代码

### 在 Agent 决策中使用

```typescript
import { AgentDecisionMaker } from '@/engine/agent-decision-maker'
import { ReputationSystem } from '@/engine/reputation-system'
import { CognitiveBiasSystem } from '@/engine/cognitive-bias-system'
import { SocialRoleSystem } from '@/engine/social-role-system'

const decisionMaker = new AgentDecisionMaker()
const reputationSystem = new ReputationSystem()
const biasSystem = new CognitiveBiasSystem()
const roleSystem = new SocialRoleSystem()

// 1. 生成决策
const decision = decisionMaker.makeDecision({
  world,
  agent,
  narratives: world.narratives.patterns,
  recentEvents: world.events.slice(-10)
})

// 2. 考虑声誉
if (decision.target) {
  const reputation = reputationSystem.queryReputation(
    agent.genetics.seed,
    decision.target,
    world
  )
  
  // 根据声誉调整决策
  if (reputation.perspective.trustworthiness < 0.3) {
    decision.type = 'avoid'
  }
}

// 3. 应用认知偏差
const biases = biasSystem.assignBiases(agent)
const { modified_decision } = biasSystem.applyBiasToDecision(
  agent,
  decision,
  { world, alternatives: [], history: [] },
  biases
)

// 4. 应用角色影响
const roles = roleSystem.assignRoles(agent, world)
const currentRole = roles[0]
if (currentRole) {
  const influence = roleSystem.applyRoleInfluence(
    agent,
    { type: modified_decision.type, target: modified_decision.target },
    currentRole
  )
  
  if (influence.modified) {
    console.log(influence.influence_description)
  }
}

// 5. 执行决策
executeDecision(modified_decision)
```

---

## 调试和监控

### 启用详细日志

在 `orchestrator.ts` 中，所有系统都会输出日志。你可以调整日志频率：

```typescript
// 每 10 个 tick 输出一次
if (nextTick % 10 === 0) {
  console.log(`[System] Stats...`)
}

// 改为每个 tick 都输出
if (true) {
  console.log(`[System] Stats...`)
}
```

### 访问系统状态

所有系统都提供 `getStats()` 方法：

```typescript
const reputationStats = reputationSystem.getStats()
const biasStats = biasSystem.getStats(agents)
const resourceStats = resourceSystem.getStats()
const tensionStats = tensionSystem.getStats()
const emergenceStats = emergenceDetector.getStats()
const roleStats = roleSystem.getStats()
const memeStats = memeSystem.getStats()
const memoryStats = memorySystem.getStats()
const attentionStats = attentionMechanism.getStats()
```

### 导出数据

```typescript
// 导出声誉数据
const allReputations = reputationSystem.getAllReputations()

// 导出模因数据
const allMemes = memeSystem.getAllMemes()

// 导出张力数据
const allTensions = tensionSystem.getAllTensions()

// 导出涌现属性
const allProperties = emergenceDetector.getAllProperties()

// 导出角色冲突
const allConflicts = roleSystem.getAllConflicts()
```

---

## 性能优化

### 1. 调整执行频率

某些系统不需要每个 tick 都执行：

```typescript
// 每 5 个 tick 执行一次
if (nextTick % 5 === 0) {
  const emergentProperties = emergenceDetector.detectEmergence(next, worldHistory)
}

// 每 10 个 tick 执行一次
if (nextTick % 10 === 0) {
  memeSystem.decayMemes(nextTick)
}
```

### 2. 限制处理数量

```typescript
// 只处理前 N 个 agents
for (const agent of next.agents.npcs.slice(0, 10)) {
  // ...
}

// 只传播前 N 个模因
for (const meme of allMemes.slice(0, 5)) {
  // ...
}
```

### 3. 使用采样

```typescript
// 随机采样 20% 的 agents
const sampledAgents = next.agents.npcs.filter(() => Math.random() < 0.2)
```

---

## 故障排除

### 问题：系统没有初始化

**解决方案**：检查 orchestrator 是否正确导入和初始化系统。

### 问题：内存使用过高

**解决方案**：
1. 限制记忆系统的容量
2. 增加衰减率
3. 定期清理旧数据

### 问题：性能下降

**解决方案**：
1. 减少执行频率
2. 使用采样
3. 限制处理数量
4. 启用缓存

### 问题：数据不一致

**解决方案**：
1. 确保使用全局单例
2. 检查数据同步
3. 验证导入/导出逻辑

---

## 下一步

- 查看 `Phase4-5-完成总结.md` 了解系统详情
- 查看各个系统的源代码了解实现细节
- 创建 UI 面板可视化系统状态
- 实现更多高级机制

祝你使用愉快！🎉
