# Conversation Scenes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable emergent multi-turn conversations between colocated agents, triggered by world pressure from existing systems.

**Architecture:** A new `conversation-scene.ts` engine module computes pairwise pressure scores from 6 existing systems, spawns multi-turn LLM conversation loops for high-pressure pairs, and feeds results back through the existing `system_feedback` pipeline. The wave-based executor is modified to extract conversation participants first, run scenes as a pre-phase, then pass bystander summaries to remaining single-shot agents.

**Tech Stack:** TypeScript (strict), Vitest, existing LLM client (`streamText` via `@anthropic-ai/sdk`)

**Spec:** `docs/superpowers/specs/2026-03-16-conversation-scenes-design.md`

---

## Chunk 1: Types + Pressure Scoring

### Task 1: Define conversation types

**Files:**
- Create: `src/domain/conversation.ts`
- Test: `src/domain/conversation.test.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
// src/domain/conversation.ts
import type { SystemFeedback } from '../server/llm/agent-decision-llm'

export type ConversationTriggerType =
  | 'tension'
  | 'resource'
  | 'reputation'
  | 'meme'
  | 'narrative'
  | 'relationship'

export type ConversationTrigger = {
  type: ConversationTriggerType
  pressure_score: number
  description: string
}

export type ConversationRound = {
  speaker: string
  dialogue: string
  inner_monologue: string
  action: {
    type: string
    target?: string
    intensity: number
  }
  system_feedback?: SystemFeedback
  continue_conversation: boolean
}

export type ConversationScene = {
  id: string
  location: string
  participants: string[]
  trigger: ConversationTrigger
  rounds: ConversationRound[]
  status: 'active' | 'concluded'
}

export type ConversationResult = {
  scene: ConversationScene
  /** One-line summary for bystander context */
  bystander_summary: string
  /** Collected system_feedback from all rounds, to be routed after conclusion */
  accumulated_feedback: Array<{
    agentId: string
    feedback: SystemFeedback
  }>
}
```

- [ ] **Step 2: Write a basic import test**

```typescript
// src/domain/conversation.test.ts
import { describe, it, expect } from 'vitest'
import type {
  ConversationScene,
  ConversationRound,
  ConversationTrigger,
  ConversationResult,
} from './conversation'

describe('conversation types', () => {
  it('can construct a ConversationScene', () => {
    const trigger: ConversationTrigger = {
      type: 'tension',
      pressure_score: 0.8,
      description: 'Unresolved conflict over stolen grain',
    }
    const round: ConversationRound = {
      speaker: 'agent-a',
      dialogue: 'You took my grain!',
      inner_monologue: 'I must confront them.',
      action: { type: 'speak', intensity: 0.7 },
      continue_conversation: true,
    }
    const scene: ConversationScene = {
      id: 'conv-1',
      location: 'marketplace',
      participants: ['agent-a', 'agent-b'],
      trigger,
      rounds: [round],
      status: 'active',
    }
    expect(scene.participants).toHaveLength(2)
    expect(scene.rounds[0].continue_conversation).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/domain/conversation.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/conversation.ts src/domain/conversation.test.ts
git commit -m "feat(conversation): add ConversationScene type definitions"
```

---

### Task 2: Implement pressure scoring

**Files:**
- Create: `src/engine/conversation-scene.ts`
- Test: `src/engine/conversation-scene.test.ts`

This module computes pairwise pressure scores between colocated agents using 6 existing systems. No LLM calls — pure TypeScript scoring.

- [ ] **Step 1: Write failing tests for `computePairPressure`**

```typescript
// src/engine/conversation-scene.test.ts
import { describe, it, expect } from 'vitest'
import { computePairPressure } from './conversation-scene'
import type { PersonalAgentState, WorldSlice } from '../domain/world'
import { createPersonalAgent } from '../domain/agents'

function makeAgent(seed: string, overrides?: Partial<PersonalAgentState>): PersonalAgentState {
  return { ...createPersonalAgent(seed), ...overrides } as PersonalAgentState
}

describe('computePairPressure', () => {
  it('returns zero pressure for unrelated agents', () => {
    const a = makeAgent('a')
    const b = makeAgent('b')
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBe(0)
  })

  it('returns high pressure for strong negative relationship', () => {
    const a = makeAgent('a', { relations: { b: -0.8 } })
    const b = makeAgent('b', { relations: { a: -0.6 } })
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBeGreaterThan(0)
    expect(result.type).toBe('relationship')
  })

  it('returns high pressure for strong positive relationship', () => {
    const a = makeAgent('a', { relations: { b: 0.9 } })
    const b = makeAgent('b', { relations: { a: 0.85 } })
    const result = computePairPressure(a, b, {} as WorldSlice)
    expect(result.pressure_score).toBeGreaterThan(0)
    expect(result.type).toBe('relationship')
  })

  it('picks the highest pressure signal as the trigger type', () => {
    // Agents with both relationship tension AND shared narrative
    const a = makeAgent('a', {
      relations: { b: -0.9 },
      narrative_roles: { 'n1': { role: 'protagonist', involvement: 0.8, impact: 0.7 } },
    })
    const b = makeAgent('b', {
      relations: { a: -0.7 },
      narrative_roles: { 'n1': { role: 'antagonist', involvement: 0.9, impact: 0.8 } },
    })
    const world = {
      narratives: {
        patterns: [
          { id: 'n1', participants: ['a', 'b'], status: 'climax', intensity: 0.9, type: 'conflict' },
        ],
      },
    } as unknown as WorldSlice
    const result = computePairPressure(a, b, world)
    expect(result.pressure_score).toBeGreaterThan(0)
    // The trigger type should be whichever signal is strongest
    expect(['relationship', 'narrative']).toContain(result.type)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: FAIL — `computePairPressure` is not exported

- [ ] **Step 3: Implement `computePairPressure`**

```typescript
// src/engine/conversation-scene.ts
import type { PersonalAgentState, WorldSlice } from '../domain/world'
import type { ConversationTrigger, ConversationTriggerType } from '../domain/conversation'
import { DramaticTensionSystem } from './dramatic-tension-system'
import { MemePropagationSystem } from './meme-propagation-system'
import { ReputationSystem } from './reputation-system'

type PressureSignal = { type: ConversationTriggerType; score: number; description: string }

/**
 * Compute the conversation pressure score between two colocated agents.
 * Returns the highest-pressure signal as the trigger.
 */
export function computePairPressure(
  a: PersonalAgentState,
  b: PersonalAgentState,
  world: WorldSlice,
): ConversationTrigger {
  const seedA = a.genetics.seed
  const seedB = b.genetics.seed
  const signals: PressureSignal[] = []

  // 1. Relationship intensity — |relation| above 0.5 creates pressure
  const relAB = a.relations?.[seedB] ?? 0
  const relBA = b.relations?.[seedA] ?? 0
  const avgIntensity = (Math.abs(relAB) + Math.abs(relBA)) / 2
  if (avgIntensity > 0.5) {
    const sentiment = (relAB + relBA) / 2 < 0 ? 'hostility' : 'closeness'
    signals.push({
      type: 'relationship',
      score: avgIntensity,
      description: `Strong ${sentiment} between ${seedA} and ${seedB}`,
    })
  }

  // 2. Dramatic tension — active tensions involving both agents
  if (world.systems?.tension) {
    try {
      const ts = new DramaticTensionSystem()
      ts.fromSnapshot(world.systems.tension)
      const shared = ts.getActiveTensions().filter(
        t => t.target_agents.includes(seedA) && t.target_agents.includes(seedB),
      )
      const maxLevel = Math.max(0, ...shared.map(t => t.level))
      if (maxLevel > 0.3) {
        signals.push({
          type: 'tension',
          score: maxLevel,
          description: `Unresolved tension (level ${maxLevel.toFixed(2)}) between ${seedA} and ${seedB}`,
        })
      }
    } catch { /* system not available */ }
  }

  // 3. Shared narrative role — both agents in same active pattern
  if (world.narratives?.patterns) {
    const shared = world.narratives.patterns.filter(
      p => p.participants?.includes(seedA) && p.participants?.includes(seedB)
        && (p.status === 'developing' || p.status === 'climax'),
    )
    if (shared.length > 0) {
      const best = shared.reduce((a, b) => ((b.intensity ?? 0) > (a.intensity ?? 0) ? b : a))
      const score = best.intensity ?? 0.5
      if (score > 0.3) {
        signals.push({
          type: 'narrative',
          score,
          description: `Both part of "${best.type}" narrative (${best.status})`,
        })
      }
    }
  }

  // 4. Meme carrying — agent carrying a meme originating from the other
  if (world.systems?.memes) {
    try {
      const ms = new MemePropagationSystem()
      ms.fromSnapshot(world.systems.memes)
      const aMemes = ms.getAgentMemes(seedA).filter(m => m.origin === seedB)
      const bMemes = ms.getAgentMemes(seedB).filter(m => m.origin === seedA)
      const memeCount = aMemes.length + bMemes.length
      if (memeCount > 0) {
        const score = Math.min(1, memeCount * 0.3)
        const memeContent = (aMemes[0] || bMemes[0])?.content ?? 'a rumor'
        signals.push({
          type: 'meme',
          score,
          description: `Carrying a meme about the other: "${memeContent}"`,
        })
      }
    } catch { /* system not available */ }
  }

  // 5. Reputation shift — recent reputation events involving either agent
  if (world.systems?.reputation) {
    try {
      const rs = new ReputationSystem()
      rs.fromSnapshot(world.systems.reputation)
      const repA = rs.getAllReputations().get(seedA)
      const repB = rs.getAllReputations().get(seedB)
      // Check if either agent had a recent notable reputation change
      const recentA = repA?.history?.slice(-3) ?? []
      const recentB = repB?.history?.slice(-3) ?? []
      const hasNotableChange = [...recentA, ...recentB].some(
        e => Object.values(e.impact ?? {}).some(v => Math.abs(Number(v) ?? 0) > 0.1),
      )
      if (hasNotableChange) {
        signals.push({
          type: 'reputation',
          score: 0.4,
          description: `Recent reputation shift noticed between ${seedA} and ${seedB}`,
        })
      }
    } catch { /* system not available */ }
  }

  // 6. Resource competition — both agents competing for same resource
  // Checked via world.systems.resources, but requires full allocation run.
  // Simplified: if both agents have low energy and are colocated, resource tension exists.
  if (a.vitals?.energy !== undefined && b.vitals?.energy !== undefined) {
    if (a.vitals.energy < 0.4 && b.vitals.energy < 0.4) {
      signals.push({
        type: 'resource',
        score: 0.35,
        description: `Both ${seedA} and ${seedB} are resource-stressed`,
      })
    }
  }

  // Pick highest signal
  if (signals.length === 0) {
    return { type: 'relationship', pressure_score: 0, description: 'No pressure' }
  }
  signals.sort((a, b) => b.score - a.score)
  const best = signals[0]
  return { type: best.type, pressure_score: best.score, description: best.description }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/conversation-scene.ts src/engine/conversation-scene.test.ts
git commit -m "feat(conversation): implement pairwise pressure scoring"
```

---

### Task 3: Implement `selectConversationPairs`

**Files:**
- Modify: `src/engine/conversation-scene.ts`
- Modify: `src/engine/conversation-scene.test.ts`

This function takes all active agents grouped by location, computes pairwise pressure, and returns pairs above threshold.

- [ ] **Step 1: Write failing tests for `selectConversationPairs`**

```typescript
// Add to src/engine/conversation-scene.test.ts
import { selectConversationPairs } from './conversation-scene'

describe('selectConversationPairs', () => {
  const THRESHOLD = 0.4

  it('returns no pairs when agents are unrelated', () => {
    const agents = [makeAgent('a'), makeAgent('b'), makeAgent('c')]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    expect(pairs).toHaveLength(0)
  })

  it('returns pairs above threshold', () => {
    const agents = [
      makeAgent('a', { relations: { b: -0.9 } }),
      makeAgent('b', { relations: { a: -0.8 } }),
      makeAgent('c'),
    ]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    expect(pairs.length).toBeGreaterThanOrEqual(1)
    expect(pairs[0].participants).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('does not let an agent appear in multiple pairs', () => {
    const agents = [
      makeAgent('a', { relations: { b: -0.9, c: -0.85 } }),
      makeAgent('b', { relations: { a: -0.8 } }),
      makeAgent('c', { relations: { a: -0.7 } }),
    ]
    const pairs = selectConversationPairs(agents, {} as WorldSlice, THRESHOLD)
    const allParticipants = pairs.flatMap(p => p.participants)
    const unique = new Set(allParticipants)
    expect(unique.size).toBe(allParticipants.length)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: FAIL — `selectConversationPairs` not exported

- [ ] **Step 3: Implement `selectConversationPairs`**

Add to `src/engine/conversation-scene.ts`:

```typescript
import type { ConversationTrigger } from '../domain/conversation'

type ConversationPair = {
  participants: [string, string]
  agents: [PersonalAgentState, PersonalAgentState]
  trigger: ConversationTrigger
}

/**
 * From a list of colocated agents, find pairs with pressure above threshold.
 * Each agent can only appear in one conversation per tick (highest pressure wins).
 */
export function selectConversationPairs(
  agents: PersonalAgentState[],
  world: WorldSlice,
  threshold: number,
): ConversationPair[] {
  // Compute all pairwise pressures
  const candidates: ConversationPair[] = []
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const trigger = computePairPressure(agents[i], agents[j], world)
      if (trigger.pressure_score >= threshold) {
        candidates.push({
          participants: [agents[i].genetics.seed, agents[j].genetics.seed],
          agents: [agents[i], agents[j]],
          trigger,
        })
      }
    }
  }
  // Sort by pressure descending
  candidates.sort((a, b) => b.trigger.pressure_score - a.trigger.pressure_score)

  // Greedily select pairs — each agent appears at most once
  const claimed = new Set<string>()
  const selected: ConversationPair[] = []
  for (const pair of candidates) {
    const [seedA, seedB] = pair.participants
    if (!claimed.has(seedA) && !claimed.has(seedB)) {
      selected.push(pair)
      claimed.add(seedA)
      claimed.add(seedB)
    }
  }
  return selected
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/conversation-scene.ts src/engine/conversation-scene.test.ts
git commit -m "feat(conversation): implement selectConversationPairs with greedy dedup"
```

---

## Chunk 2: Conversation Loop + LLM Integration

### Task 4: Add conversation-mode prompt building

**Files:**
- Modify: `src/server/llm/agent-decision-llm.ts` (lines ~460-496 for JSON schema, lines ~611-644 for `generateAgentDecisionViaLLM`)

The conversation prompt reuses `buildAgentPrompt()` but adds: (a) conversation transcript so far, (b) pressure context, (c) `continue_conversation` field in the JSON schema.

- [ ] **Step 1: Add `continue_conversation` to `LLMDecisionResult` type**

In `src/server/llm/agent-decision-llm.ts`, add `continue_conversation` to the type (around line 39):

```typescript
// Add to LLMDecisionResult type, after system_feedback
continue_conversation?: boolean
```

- [ ] **Step 1b: Export `buildAgentPrompt` and `parseLLMResponse`**

These are currently private functions. `buildConversationPrompt` (same file) calls `buildAgentPrompt`, and `generateConversationTurn` calls `parseLLMResponse`. Change their declarations:

```typescript
// Line 46: change `function buildAgentPrompt` to:
export function buildAgentPrompt(

// Line 502: change `function parseLLMResponse` to:
export function parseLLMResponse(
```

- [ ] **Step 2: Add `continue_conversation` to `parseLLMResponse`**

In `parseLLMResponse()` (line 536), add after the `system_feedback` line and before the closing `}`:

```typescript
      system_feedback: parseSystemFeedback(parsed.system_feedback),
      continue_conversation: parsed.continue_conversation ?? true,
    }
```

- [ ] **Step 3: Create `buildConversationPrompt` function**

Add a new exported function to `src/server/llm/agent-decision-llm.ts`:

```typescript
/**
 * Build a prompt for an agent participating in a multi-turn conversation.
 * Reuses buildAgentPrompt() and injects conversation context.
 */
export function buildConversationPrompt(
  agent: PersonalAgentState,
  world: WorldSlice,
  conversationHistory: Array<{ speaker: string; dialogue: string; action: { type: string; intensity: number } }>,
  trigger: { type: string; description: string },
): string {
  const basePrompt = buildAgentPrompt(agent, world)

  // Build conversation transcript
  let transcript = ''
  if (conversationHistory.length > 0) {
    transcript = '\n\n[Conversation so far]\n'
    for (const round of conversationHistory) {
      transcript += `${round.speaker} said: "${round.dialogue}" (${round.action.type}, intensity ${round.action.intensity})\n`
    }
    transcript += '\nYou must respond to what was just said. Continue the conversation naturally.\n'
  }

  // Build pressure awareness
  const pressureContext = `\n\n[What draws you into this interaction]\n${trigger.description}\n`

  // Inject conversation context before the JSON schema instruction
  // The base prompt ends with the JSON schema block starting with "---"
  const schemaMarker = '---\n\nNow, as'
  const parts = basePrompt.split(schemaMarker)

  // Modify the JSON schema to include continue_conversation
  const continueField = `
  "continue_conversation": boolean // true if you have more to say, false if you're done talking or want to end this exchange`

  let modifiedSchema = parts.length > 1 ? parts[1] : ''
  // Insert continue_conversation into the JSON schema (after system_feedback closing brace)
  modifiedSchema = modifiedSchema.replace(
    '"system_feedback"',
    `"continue_conversation": true,\n    "system_feedback"`,
  )

  if (parts.length > 1) {
    return parts[0] + pressureContext + transcript + schemaMarker + modifiedSchema
  }
  // Fallback: append to end
  return basePrompt + pressureContext + transcript
}
```

- [ ] **Step 3b: Write failing test for `buildConversationPrompt`**

```typescript
// Add to src/engine/conversation-scene.test.ts (or create src/server/llm/conversation-prompt.test.ts)
import { buildConversationPrompt, buildAgentPrompt } from '../server/llm/agent-decision-llm'

describe('buildConversationPrompt', () => {
  it('includes pressure context and conversation transcript', () => {
    const agent = makeAgent('a')
    const world = { environment: { description: 'A village' } } as unknown as WorldSlice
    const history = [
      { speaker: 'b', dialogue: 'Hello there', action: { type: 'speak', intensity: 0.5 } },
    ]
    const trigger = { type: 'tension', description: 'Unresolved conflict' }

    const prompt = buildConversationPrompt(agent, world, history, trigger)

    expect(prompt).toContain('Unresolved conflict')
    expect(prompt).toContain('Hello there')
    expect(prompt).toContain('continue_conversation')
  })
})
```

- [ ] **Step 4: Create `generateConversationTurn` function**

Add to `src/server/llm/agent-decision-llm.ts`. Uses the same `streamText` pattern as `generateAgentDecisionViaLLM`:

```typescript
import type { ConversationRound } from '../../domain/conversation'

/**
 * Generate one conversation turn for an agent via LLM.
 */
export async function generateConversationTurn(
  agent: PersonalAgentState,
  world: WorldSlice,
  conversationHistory: ConversationRound[],
  trigger: { type: string; description: string },
): Promise<LLMDecisionResult | null> {
  try {
    const visibleHistory = conversationHistory.map(r => ({
      speaker: r.speaker,
      dialogue: r.dialogue,
      action: r.action,
    }))
    const prompt = buildConversationPrompt(agent, world, visibleHistory, trigger)

    const client = createAnthropicClient()
    const model = getModel()
    const responseText = await streamText(client, {
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    if (!responseText?.trim()) return null
    return parseLLMResponse(responseText)
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Run existing tests to verify no regressions**

Run: `npx vitest run src/server/llm/agent-decision-llm.test.ts` (if exists) or `npx vitest run src/server/llm/`
Expected: PASS (no existing tests break)

- [ ] **Step 6: Commit**

```bash
git add src/server/llm/agent-decision-llm.ts
git commit -m "feat(conversation): add conversation-mode prompt + generateConversationTurn"
```

---

### Task 5: Implement conversation loop

**Files:**
- Modify: `src/engine/conversation-scene.ts`
- Modify: `src/engine/conversation-scene.test.ts`

The loop alternates turns between two agents, collecting rounds until termination.

- [ ] **Step 1: Write failing test for `runConversationScene`**

```typescript
// Add to src/engine/conversation-scene.test.ts
import { runConversationScene } from './conversation-scene'
import type { ConversationResult } from '../domain/conversation'
import { vi } from 'vitest'

// Mock the LLM module
vi.mock('../server/llm/agent-decision-llm', () => ({
  generateConversationTurn: vi.fn(),
}))

import { generateConversationTurn } from '../server/llm/agent-decision-llm'
const mockGenerate = vi.mocked(generateConversationTurn)

describe('runConversationScene', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
  })

  it('runs a 2-round conversation when agents continue then stop', async () => {
    // Round 1: agent A speaks, continues
    // Round 1: agent B responds, continues
    // Round 2: agent A speaks, stops → B gets final turn
    // Round 2: agent B responds (final turn)
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.7 },
        dialogue: 'You stole my grain!',
        inner_monologue: 'I must confront them.',
        behavior_description: 'confronts angrily',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.6 },
        dialogue: 'I did no such thing!',
        inner_monologue: 'How dare they accuse me.',
        behavior_description: 'denies defensively',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.4 },
        dialogue: 'Then who did?',
        inner_monologue: 'Maybe I was wrong.',
        behavior_description: 'calms down',
        continue_conversation: false,
      } as any)
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.3 },
        dialogue: 'Let us investigate together.',
        inner_monologue: 'This could be resolved.',
        behavior_description: 'extends hand',
        continue_conversation: false,
      } as any)

    const a = makeAgent('a', { relations: { b: -0.7 } })
    const b = makeAgent('b', { relations: { a: -0.5 } })

    const result = await runConversationScene(
      [a, b],
      { type: 'relationship', pressure_score: 0.8, description: 'Hostility' },
      'marketplace',
      {} as WorldSlice,
    )

    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds).toHaveLength(4) // 2 rounds x 2 agents
    expect(result.scene.rounds[0].speaker).toBeDefined()
    expect(result.bystander_summary).toBeTruthy()
  })

  it('terminates immediately when agent chooses leave action', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'leave', intensity: 0.8 },
        dialogue: 'I have nothing to say to you.',
        inner_monologue: 'Not worth my time.',
        behavior_description: 'turns away',
        continue_conversation: false,
      } as any)

    const a = makeAgent('a')
    const b = makeAgent('b')

    const result = await runConversationScene(
      [a, b],
      { type: 'tension', pressure_score: 0.6, description: 'Tension' },
      'square',
      {} as WorldSlice,
    )

    expect(result.scene.rounds).toHaveLength(1)
    expect(result.scene.status).toBe('concluded')
  })

  it('handles LLM failure gracefully', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        action: { type: 'speak', intensity: 0.5 },
        dialogue: 'Hello.',
        inner_monologue: 'Thinking...',
        behavior_description: 'speaks',
        continue_conversation: true,
      } as any)
      .mockResolvedValueOnce(null) // LLM failure

    const a = makeAgent('a')
    const b = makeAgent('b')

    const result = await runConversationScene(
      [a, b],
      { type: 'tension', pressure_score: 0.5, description: 'Tension' },
      'square',
      {} as WorldSlice,
    )

    // Should conclude gracefully with rounds completed so far
    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: FAIL — `runConversationScene` not exported

- [ ] **Step 3: Implement `runConversationScene`**

Add to `src/engine/conversation-scene.ts`:

```typescript
import type {
  ConversationScene,
  ConversationRound,
  ConversationTrigger,
  ConversationResult,
} from '../domain/conversation'
import { generateConversationTurn } from '../server/llm/agent-decision-llm'

const MAX_ROUNDS = 6
const LEAVE_ACTIONS = ['leave', 'withdraw', 'walk_away', 'depart']

/**
 * Run a multi-turn conversation scene between agents.
 * Returns when: both agents stop, one leaves, LLM fails, or safety cap hit.
 */
export async function runConversationScene(
  agents: PersonalAgentState[],
  trigger: ConversationTrigger,
  location: string,
  world: WorldSlice,
): Promise<ConversationResult> {
  const scene: ConversationScene = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    location,
    participants: agents.map(a => a.genetics.seed),
    trigger,
    rounds: [],
    status: 'active',
  }

  const accumulated_feedback: ConversationResult['accumulated_feedback'] = []

  // Randomly select who speaks first
  const order = Math.random() < 0.5 ? [0, 1] : [1, 0]
  let pendingFinalTurn = false
  let finalTurnAgent: number | null = null

  for (let roundNum = 0; roundNum < MAX_ROUNDS; roundNum++) {
    for (const idx of order) {
      const agent = agents[idx]
      const result = await generateConversationTurn(
        agent,
        world,
        scene.rounds,
        { type: trigger.type, description: trigger.description },
      )

      // LLM failure — treat as "leave"
      if (!result) {
        scene.status = 'concluded'
        return makeConcludedResult(scene, accumulated_feedback)
      }

      const round: ConversationRound = {
        speaker: agent.genetics.seed,
        dialogue: result.dialogue ?? '',
        inner_monologue: result.inner_monologue ?? '',
        action: {
          type: result.action?.type ?? 'speak',
          target: result.action?.target,
          intensity: result.action?.intensity ?? 0.5,
        },
        system_feedback: result.system_feedback,
        continue_conversation: result.continue_conversation ?? true,
      }

      scene.rounds.push(round)

      if (result.system_feedback) {
        accumulated_feedback.push({
          agentId: agent.genetics.seed,
          feedback: result.system_feedback,
        })
      }

      // Check "leave" action — immediate termination, no final turn
      if (LEAVE_ACTIONS.includes(round.action.type.toLowerCase())) {
        scene.status = 'concluded'
        return makeConcludedResult(scene, accumulated_feedback)
      }

      // Check continue_conversation: false — other agent gets one final turn
      if (!round.continue_conversation) {
        if (pendingFinalTurn) {
          // Both have now said they're done
          scene.status = 'concluded'
          return makeConcludedResult(scene, accumulated_feedback)
        }
        pendingFinalTurn = true
        finalTurnAgent = order.find(i => i !== idx)!
      }
    }

    // After both agents spoke this round, check if we need one final turn
    if (pendingFinalTurn && finalTurnAgent !== null) {
      // The final turn was already given in this round's loop
      scene.status = 'concluded'
      return makeConcludedResult(scene, accumulated_feedback)
    }
  }

  // Safety cap reached
  scene.status = 'concluded'
  return makeConcludedResult(scene, accumulated_feedback)
}

function makeConcludedResult(
  scene: ConversationScene,
  accumulated_feedback: ConversationResult['accumulated_feedback'],
): ConversationResult {
  // Generate a one-line bystander summary from the conversation
  const speakers = [...new Set(scene.rounds.map(r => r.speaker))]
  const lastDialogue = scene.rounds[scene.rounds.length - 1]
  const tone = scene.trigger.type === 'tension' ? 'tensely'
    : scene.trigger.type === 'relationship' ? 'intensely'
    : 'earnestly'

  const bystander_summary = scene.rounds.length > 0
    ? `${speakers.join(' and ')} spoke ${tone} about ${scene.trigger.description.toLowerCase()}`
    : `${speakers.join(' and ')} had a brief encounter`

  return { scene, bystander_summary, accumulated_feedback }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/conversation-scene.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/conversation-scene.ts src/engine/conversation-scene.test.ts
git commit -m "feat(conversation): implement multi-turn conversation loop with termination"
```

---

## Chunk 3: Integration with Executor + Orchestrator

### Task 6: Modify NPC executor to run conversations first

**Files:**
- Modify: `src/engine/npc-agent-executor.ts` (lines ~216-323, the `executeNpcAgents` function)

The key change: before the wave loop, extract conversation pairs per location, run them, then pass bystander summaries to remaining agents in the wave.

- [ ] **Step 1: Add conversation imports, types, and update return type**

At the top of `src/engine/npc-agent-executor.ts`, add:

```typescript
import { selectConversationPairs, runConversationScene } from './conversation-scene'
import type { ConversationResult } from '../domain/conversation'
import type { SystemFeedback } from '../server/llm/agent-decision-llm'
```

Update the return type of `executeNpcAgents` (around line 218) to include `conversationFeedback`:

```typescript
export async function executeNpcAgents(
  world: WorldSlice,
): Promise<Array<{
  agentId: string
  patch: AgentPatch
  updatedAgent: PersonalAgentState
  systemFeedback?: SystemFeedback
  conversationFeedback?: Array<{ agentId: string; feedback: SystemFeedback }>
}>> {
```

- [ ] **Step 2: Modify `executeNpcAgents` to run conversations before waves**

In `executeNpcAgents()` (around line 239, inside the location group loop), add a conversation pre-phase. The modified flow:

```typescript
// Inside the for-of loop over locationGroups:

// --- Conversation pre-phase ---
const CONVERSATION_THRESHOLD = 0.4
const conversationPairs = selectConversationPairs(agentsAtLocation, world, CONVERSATION_THRESHOLD)

// Get seeds of agents in conversations (they skip the wave)
const conversingSeedSet = new Set(conversationPairs.flatMap(p => p.participants))
const conversationResults: ConversationResult[] = []

// Run all conversation scenes at this location in parallel
if (conversationPairs.length > 0) {
  const scenePromises = conversationPairs.map(pair =>
    runConversationScene(pair.agents, pair.trigger, location, world)
  )
  conversationResults.push(...await Promise.all(scenePromises))
}

// Build bystander context from conversation results
const bystanderContext = conversationResults
  .map(r => r.bystander_summary)
  .join('\n')

// Filter out conversing agents from waves
const waveAgents = agentsAtLocation.filter(
  a => !conversingSeedSet.has(a.genetics.seed)
)

// --- Existing wave logic continues with waveAgents instead of agentsAtLocation ---
// Inject bystanderContext into thisTickContext for wave agents
```

- [ ] **Step 3: Collect conversation results into the return array**

After the wave loop, map conversation results into the same return format as wave results:

```typescript
// Map conversation scene rounds into the standard return format
for (const convResult of allConversationResults) {
  for (const participant of convResult.scene.participants) {
    const agent = world.agents.npcs.find(a => a.genetics.seed === participant)
    if (!agent) continue
    // Use the last round's data for this agent
    const agentRounds = convResult.scene.rounds.filter(r => r.speaker === participant)
    const lastRound = agentRounds[agentRounds.length - 1]
    if (!lastRound) continue

    const conversationMemory: MemoryRecord = {
      id: `conv-mem-${convResult.scene.id}-${participant}`,
      content: `Conversation with ${convResult.scene.participants.filter(p => p !== participant).join(', ')}: ${convResult.bystander_summary}`,
      importance: Math.min(1, 0.4 + convResult.scene.rounds.length * 0.1),
      emotional_weight: lastRound.action.intensity,
      source: 'social',
      timestamp: new Date().toISOString(),
      decay_rate: 0.02,
      retrieval_strength: 0.8,
    }

    results.push({
      agentId: participant,
      patch: {
        timeDelta: 0,
        events: [{
          id: `conv-${convResult.scene.id}-${participant}`,
          kind: 'micro' as const,
          summary: convResult.bystander_summary,
        }],
        rulesDelta: [],
        notes: [],
        meta: {},
      },
      updatedAgent: {
        ...agent,
        last_action_description: lastRound.dialogue,
        last_dialogue: lastRound.dialogue,
        last_inner_monologue: lastRound.inner_monologue,
        memory_short: [
          ...agent.memory_short,
          conversationMemory,
        ].slice(-20),
      },
      systemFeedback: undefined, // Feedback is handled via accumulated_feedback
      conversationFeedback: convResult.accumulated_feedback,
    })
  }
}
```

Note: Import `MemoryRecord` from `'../domain/world'` at the top of the file.

- [ ] **Step 4: Run existing executor tests to verify no regressions**

Run: `npx vitest run src/engine/`
Expected: Existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/npc-agent-executor.ts
git commit -m "feat(conversation): integrate conversation pre-phase into NPC executor"
```

---

### Task 7: Route conversation feedback through orchestrator

**Files:**
- Modify: `src/engine/orchestrator.ts` (lines ~651-683, the system_feedback routing section)

- [ ] **Step 1: Handle `conversationFeedback` in the feedback routing loop**

In `orchestrator.ts`, after the existing `npcResult.systemFeedback` routing (around line 683), add handling for conversation feedback:

```typescript
// Route conversation feedback (batched from multi-turn scenes)
for (const npcResult of npcResults) {
  if (!npcResult.conversationFeedback) continue
  for (const { agentId, feedback } of npcResult.conversationFeedback) {
    // Find witnesses (colocated agents)
    const agent = updatedNpcsMap.get(agentId)
    const location = agent?.location
    const witnesses = next.agents.npcs
      .filter(n => n.genetics.seed !== agentId && n.location === location)
      .map(n => n.genetics.seed)

    // Route through same 6 systems as single-shot feedback
    if (feedback.reputation_impact && globalReputationSystem) {
      globalReputationSystem.updateFromLLMFeedback(agentId, feedback.reputation_impact, witnesses, next.tick)
    }
    if ((feedback.current_role || feedback.role_conflict) && globalRoleSystem) {
      globalRoleSystem.updateFromLLMFeedback(agentId, feedback.current_role, feedback.role_conflict)
    }
    if (feedback.resource_action && globalResourceSystem) {
      globalResourceSystem.claimFromLLMFeedback(agentId, feedback.resource_action)
    }
    if (feedback.tension_effect && globalTensionSystem) {
      globalTensionSystem.updateFromLLMFeedback(agentId, feedback.tension_effect, next.tick)
    }
    if (feedback.meme_spread && globalMemeSystem) {
      globalMemeSystem.ingestFromLLMFeedback(agentId, feedback.meme_spread, next.tick)
    }
    if (feedback.perceived_bias && globalBiasSystem) {
      globalBiasSystem.recordBias(agentId, feedback.perceived_bias, next.tick)
    }
  }
}
```

- [ ] **Step 2: Run orchestrator tests**

Run: `npx vitest run src/engine/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/orchestrator.ts
git commit -m "feat(conversation): route batched conversation feedback through 6 systems"
```

---

### Task 8: End-to-end smoke test

**Files:**
- Create: `src/engine/conversation-integration.test.ts`

A test that verifies the full flow: agents with high pressure → conversation triggered → rounds executed → feedback collected.

- [ ] **Step 1: Write integration test**

```typescript
// src/engine/conversation-integration.test.ts
import { describe, it, expect, vi } from 'vitest'
import { selectConversationPairs, runConversationScene } from './conversation-scene'
import { createPersonalAgent } from '../domain/agents'
import type { PersonalAgentState, WorldSlice } from '../domain/world'

// Mock LLM
vi.mock('../server/llm/agent-decision-llm', () => ({
  generateConversationTurn: vi.fn()
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.7 },
      dialogue: 'We need to talk about the water supply.',
      inner_monologue: 'Resources are dwindling.',
      behavior_description: 'speaks urgently',
      continue_conversation: true,
      system_feedback: { tension_effect: 'building' },
    })
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.6 },
      dialogue: 'I agree, we must act.',
      inner_monologue: 'This is serious.',
      behavior_description: 'nods gravely',
      continue_conversation: false,
      system_feedback: { reputation_impact: [{ dimension: 'competence', delta: 0.05, reason: 'showed leadership' }] },
    })
    .mockResolvedValueOnce({
      action: { type: 'speak', intensity: 0.4 },
      dialogue: 'Then let us gather the others.',
      inner_monologue: 'Good, we are aligned.',
      behavior_description: 'stands up',
      continue_conversation: false,
    }),
}))

function makeAgent(seed: string, overrides?: Partial<PersonalAgentState>): PersonalAgentState {
  return { ...createPersonalAgent(seed), ...overrides } as PersonalAgentState
}

describe('conversation integration', () => {
  it('full flow: pressure → pair selection → conversation → feedback', async () => {
    const agentA = makeAgent('leader', { relations: { rival: -0.8 } })
    const agentB = makeAgent('rival', { relations: { leader: -0.7 } })
    const world = {} as WorldSlice

    // Step 1: Pair selection
    const pairs = selectConversationPairs([agentA, agentB], world, 0.4)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].trigger.type).toBe('relationship')

    // Step 2: Run conversation
    const result = await runConversationScene(
      pairs[0].agents,
      pairs[0].trigger,
      'village-square',
      world,
    )

    // Step 3: Verify conversation completed
    expect(result.scene.status).toBe('concluded')
    expect(result.scene.rounds.length).toBeGreaterThanOrEqual(2)
    expect(result.bystander_summary).toBeTruthy()

    // Step 4: Verify feedback was collected
    expect(result.accumulated_feedback.length).toBeGreaterThanOrEqual(1)
    const tensionFeedback = result.accumulated_feedback.find(
      f => f.feedback.tension_effect,
    )
    expect(tensionFeedback).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run src/engine/conversation-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/conversation-integration.test.ts
git commit -m "test(conversation): add end-to-end integration test for conversation scenes"
```

- [ ] **Step 5: Push all commits**

```bash
git push
```
