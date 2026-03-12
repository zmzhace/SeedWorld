# Agent Observation Panel Implementation Plan (2026-03-12)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the right-side panel into an "Agent Observation Desk" that enables users to switch between personal agents and view comprehensive natural-language observation summaries covering world state, other agents, social events, memory/cognition, and self-state.

**Context:** This plan builds on the existing MVP implementation and focuses on enhancing the observation panel with LLM-driven agent generation and rich observation summaries.

**Tech Stack:** Next.js, React, TypeScript, Anthropic Claude API, Vitest, Testing Library

---

## Task 1: Enhance domain schema for multi-agent support

**Files:**
- Modify: `src/domain/agents.ts`
- Modify: `src/domain/world.ts`
- Test: `src/domain/agents.test.ts`

**Step 1: Write the failing test**

Add to `src/domain/agents.test.ts`:

```ts
import { createPersonalAgent } from './agents'

describe('createPersonalAgent', () => {
  it('creates a personal agent with unique seed and default state', () => {
    const agent = createPersonalAgent('curious-explorer')
    
    expect(agent.genetics.seed).toBe('curious-explorer')
    expect(agent.kind).toBe('personal')
    expect(agent.memory).toEqual([])
    expect(agent.vitals).toBeDefined()
    expect(agent.persona).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/agents.test.ts`
Expected: FAIL if createPersonalAgent doesn't exist or doesn't match signature.

**Step 3: Write minimal implementation**


Ensure `createPersonalAgent` factory function exists and returns a properly structured personal agent with:
- Unique genetics seed
- Empty memory array
- Default vitals state
- Default persona state
- Empty action history

Update `WorldSlice` type to support multiple personal agents in a registry/map structure.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/agents.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/agents.ts src/domain/world.ts src/domain/agents.test.ts
git commit -m "feat: enhance domain schema for multi-agent support"
```

---

## Task 2: Implement LLM-driven agent generation service

**Files:**
- Create: `src/server/llm/agent-generator.ts`
- Test: `src/server/llm/agent-generator.test.ts`

**Step 1: Write the failing test**

Create `src/server/llm/agent-generator.test.ts`:

```ts
import { generatePersonalAgents } from './agent-generator'

describe('generatePersonalAgents', () => {
  it('generates multiple personal agents from natural language prompt', async () => {
    const agents = await generatePersonalAgents({
      prompt: '创建三个不同性格的探险者',
      count: 3,
    })
    
    expect(agents).toHaveLength(3)
    expect(agents[0].genetics.seed).toBeTruthy()
    expect(agents[0].kind).toBe('personal')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/llm/agent-generator.test.ts`
Expected: FAIL because agent-generator doesn't exist.

**Step 3: Write minimal implementation**


Implement `generatePersonalAgents` that:
- Takes a natural language prompt and desired count
- Calls Claude API with structured prompt to generate agent specifications
- Parses LLM response into PersonalAgent objects
- Returns array of generated agents with unique seeds and varied personas

Use Anthropic SDK and structured output format.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/llm/agent-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/llm/agent-generator.ts src/server/llm/agent-generator.test.ts
git commit -m "feat: add LLM-driven agent generation service"
```

---

## Task 3: Implement observation summary generator

**Files:**
- Create: `src/server/llm/observation-generator.ts`
- Test: `src/server/llm/observation-generator.test.ts`

**Step 1: Write the failing test**

Create `src/server/llm/observation-generator.test.ts`:

```ts
import { generateObservationSummary } from './observation-generator'
import { createInitialWorldSlice } from '@/domain/world'
import { createPersonalAgent } from '@/domain/agents'

describe('generateObservationSummary', () => {
  it('generates comprehensive observation summary for selected agent', async () => {
    const world = createInitialWorldSlice()
    const agent = createPersonalAgent('test-agent')
    
    const summary = await generateObservationSummary({
      world,
      agent,
    })
    
    expect(summary).toBeTruthy()
    expect(summary.length).toBeGreaterThan(50)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/llm/observation-generator.test.ts`
Expected: FAIL because observation-generator doesn't exist.


**Step 3: Write minimal implementation**

Implement `generateObservationSummary` that:
- Takes world state and selected agent
- Constructs comprehensive context including:
  - World state (tick, time, events)
  - Other agents in the world
  - Social context (narratives, pressures, events)
  - Agent's memory and cognition state
  - Agent's vitals and persona
- Calls Claude API with structured prompt
- Returns natural language observation summary covering all five categories

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/llm/observation-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/llm/observation-generator.ts src/server/llm/observation-generator.test.ts
git commit -m "feat: add observation summary generator"
```

---

## Task 4: Create agent registry API endpoint

**Files:**
- Create: `app/api/agents/route.ts`
- Modify: `src/server/agents.ts` (if exists, otherwise create)
- Test: `src/server/agents.test.ts`

**Step 1: Write the failing test**

Update or create `src/server/agents.test.ts`:

```ts
import { handleAgentGeneration } from './agents'

describe('handleAgentGeneration', () => {
  it('generates agents and registers them with Pangu', async () => {
    const result = await handleAgentGeneration({
      prompt: '创建两个探险者',
      worldId: 'test-world',
    })
    
    expect(result.agents).toHaveLength(2)
    expect(result.success).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/agents.test.ts`
Expected: FAIL because handleAgentGeneration doesn't exist or doesn't match signature.


**Step 3: Write minimal implementation**

Implement:
- `handleAgentGeneration` server function that:
  - Calls `generatePersonalAgents` with user prompt
  - Registers generated agents with Pangu
  - Saves updated world state
  - Returns agent list
- API route at `app/api/agents/route.ts` that:
  - Accepts POST with { prompt, worldId }
  - Calls handleAgentGeneration
  - Returns { success, agents }

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/agents.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/agents/route.ts src/server/agents.ts src/server/agents.test.ts
git commit -m "feat: add agent registry API endpoint"
```

---

## Task 5: Create observation API endpoint

**Files:**
- Create: `app/api/observations/route.ts`
- Modify: `src/server/observations.ts` (if exists, otherwise create)
- Test: `src/server/observations.test.ts`

**Step 1: Write the failing test**

Update or create `src/server/observations.test.ts`:

```ts
import { handleObservationRequest } from './observations'
import { createInitialWorldSlice } from '@/domain/world'

describe('handleObservationRequest', () => {
  it('generates observation summary for selected agent', async () => {
    const world = createInitialWorldSlice()
    
    const result = await handleObservationRequest({
      worldId: world.world_id,
      agentId: 'test-agent',
    })
    
    expect(result.summary).toBeTruthy()
    expect(result.success).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/observations.test.ts`
Expected: FAIL because handleObservationRequest doesn't exist or doesn't match signature.


**Step 3: Write minimal implementation**

Implement:
- `handleObservationRequest` server function that:
  - Loads world state
  - Finds selected agent
  - Calls `generateObservationSummary`
  - Returns observation summary
- API route at `app/api/observations/route.ts` that:
  - Accepts POST with { worldId, agentId }
  - Calls handleObservationRequest
  - Returns { success, summary }

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/observations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/observations/route.ts src/server/observations.ts src/server/observations.test.ts
git commit -m "feat: add observation API endpoint"
```

---

## Task 6: Redesign AgentPanel component

**Files:**
- Modify: `src/components/panel/agent-panel.tsx`
- Test: `src/components/panel/agent-panel.test.tsx`

**Step 1: Write the failing test**

Update `src/components/panel/agent-panel.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentPanel } from './agent-panel'
import { createInitialWorldSlice } from '@/domain/world'

describe('AgentPanel', () => {
  it('renders agent selector, observation summary, and world snapshot', () => {
    render(<AgentPanel world={createInitialWorldSlice()} />)
    
    expect(screen.getByText(/agent observation desk/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/personal agent/i)).toBeInTheDocument()
    expect(screen.getByText(/world snapshot/i)).toBeInTheDocument()
  })
  
  it('generates agents when user submits prompt', async () => {
    const user = userEvent.setup()
    render(<AgentPanel world={createInitialWorldSlice()} />)
    
    await user.type(screen.getByPlaceholderText(/描述/i), '创建探险者')
    await user.click(screen.getByRole('button', { name: /生成/i }))
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toHaveValue('')
    })
  })
})
```


**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/panel/agent-panel.test.tsx`
Expected: FAIL until component is properly redesigned.

**Step 3: Write minimal implementation**

Redesign `AgentPanel` with three main sections:

1. **Top Section - Agent Selector:**
   - Input field for natural language prompt
   - "Generate" button to create agents
   - Dropdown/select to choose from generated agents
   - Loading and error states

2. **Middle Section - Observation Summary:**
   - Natural language summary display area
   - "Refresh" button to regenerate summary
   - Loading spinner during generation
   - Error message display
   - Empty state prompt

3. **Bottom Section - World Snapshot (Collapsible):**
   - Tick counter
   - Current time
   - Minimal metadata
   - Collapse/expand toggle

Implement proper state management for:
- Agent list
- Selected agent ID
- Observation summary
- Loading states
- Error states

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/panel/agent-panel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/panel/agent-panel.tsx src/components/panel/agent-panel.test.tsx
git commit -m "feat: redesign agent observation panel UI"
```

---

## Task 7: Add world snapshot collapsible component

**Files:**
- Create: `src/components/panel/world-snapshot.tsx`
- Test: `src/components/panel/world-snapshot.test.tsx`


**Step 1: Write the failing test**

Create `src/components/panel/world-snapshot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorldSnapshot } from './world-snapshot'
import { createInitialWorldSlice } from '@/domain/world'

describe('WorldSnapshot', () => {
  it('renders collapsible world metadata', () => {
    render(<WorldSnapshot world={createInitialWorldSlice()} />)
    
    expect(screen.getByText(/world snapshot/i)).toBeInTheDocument()
    expect(screen.getByText(/tick:/i)).toBeInTheDocument()
  })
  
  it('toggles collapse state when clicked', async () => {
    const user = userEvent.setup()
    render(<WorldSnapshot world={createInitialWorldSlice()} />)
    
    const toggle = screen.getByRole('button', { name: /world snapshot/i })
    await user.click(toggle)
    
    // Content should be hidden after toggle
    expect(screen.queryByText(/tick:/i)).not.toBeVisible()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/panel/world-snapshot.test.tsx`
Expected: FAIL because WorldSnapshot component doesn't exist.

**Step 3: Write minimal implementation**

Create `WorldSnapshot` component that:
- Displays world metadata (tick, time, world_id)
- Has collapsible/expandable behavior
- Shows collapse indicator (chevron icon)
- Defaults to expanded state
- Uses accessible button for toggle

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/panel/world-snapshot.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/panel/world-snapshot.tsx src/components/panel/world-snapshot.test.tsx
git commit -m "feat: add collapsible world snapshot component"
```

---

## Task 8: Integrate components and update panel shell

**Files:**
- Modify: `src/components/panel/panel-shell.tsx`
- Test: `src/components/panel/panel-shell.test.tsx`


**Step 1: Write the failing test**

Update `src/components/panel/panel-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PanelShell } from './panel-shell'
import { createInitialWorldSlice } from '@/domain/world'

describe('PanelShell', () => {
  it('renders complete agent observation desk', () => {
    render(<PanelShell world={createInitialWorldSlice()} />)
    
    expect(screen.getByText(/agent observation desk/i)).toBeInTheDocument()
    expect(screen.getByText(/world snapshot/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/panel/panel-shell.test.tsx`
Expected: FAIL if panel-shell doesn't properly integrate all components.

**Step 3: Write minimal implementation**

Update `PanelShell` to:
- Render redesigned `AgentPanel` as main content
- Include `WorldSnapshot` at the bottom
- Remove old panel components (world-overview, memory-panel, trace-panel) if no longer needed
- Maintain clean layout with proper spacing

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/panel/panel-shell.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/panel/panel-shell.tsx src/components/panel/panel-shell.test.tsx
git commit -m "feat: integrate agent observation desk components"
```

---

## Task 9: Add error boundary and loading states

**Files:**
- Create: `src/components/panel/observation-error-boundary.tsx`
- Modify: `src/components/panel/agent-panel.tsx`
- Test: `src/components/panel/observation-error-boundary.test.tsx`

**Step 1: Write the failing test**

Create `src/components/panel/observation-error-boundary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ObservationErrorBoundary } from './observation-error-boundary'

describe('ObservationErrorBoundary', () => {
  it('catches errors and displays fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error')
    }
    
    render(
      <ObservationErrorBoundary>
        <ThrowError />
      </ObservationErrorBoundary>
    )
    
    expect(screen.getByText(/generation failed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
```


**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/panel/observation-error-boundary.test.tsx`
Expected: FAIL because ObservationErrorBoundary doesn't exist.

**Step 3: Write minimal implementation**

Implement:
- `ObservationErrorBoundary` React error boundary component
- Catches LLM generation errors
- Displays user-friendly error message
- Provides "Retry" button
- Preserves last successful observation summary
- Logs errors for debugging

Update `AgentPanel` to:
- Wrap observation generation in error boundary
- Show loading spinner with timestamp during generation
- Display "Generation failed, retry" on error
- Keep last successful summary visible on error

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/panel/observation-error-boundary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/panel/observation-error-boundary.tsx src/components/panel/observation-error-boundary.test.tsx src/components/panel/agent-panel.tsx
git commit -m "feat: add error boundary and enhanced loading states"
```

---

## Task 10: Add end-to-end test for agent observation flow

**Files:**
- Create: `tests/e2e/agent-observation.spec.ts`

**Step 1: Write the failing test**

Create `tests/e2e/agent-observation.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('complete agent observation flow', async ({ page }) => {
  await page.goto('http://localhost:3000')
  
  // Generate agents
  await page.getByPlaceholderText(/描述/i).fill('创建一个好奇的探险者')
  await page.getByRole('button', { name: /生成/i }).click()
  
  // Wait for agents to be generated
  await expect(page.getByRole('combobox')).not.toHaveValue('', { timeout: 10000 })
  
  // Select an agent
  const selector = page.getByRole('combobox')
  await selector.selectOption({ index: 1 })
  
  // Refresh observation summary
  await page.getByRole('button', { name: /刷新摘要/i }).click()
  
  // Verify observation summary appears
  await expect(page.getByText(/观察摘要/i)).toBeVisible()
  
  // Verify world snapshot is visible
  await expect(page.getByText(/world snapshot/i)).toBeVisible()
  await expect(page.getByText(/tick:/i)).toBeVisible()
})
```


**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/agent-observation.spec.ts`
Expected: FAIL until the complete flow is implemented.

**Step 3: Write minimal implementation**

Make any final integration fixes needed for the complete flow:
- Agent generation API works correctly
- Observation generation API works correctly
- UI properly handles async operations
- State updates propagate correctly

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/agent-observation.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/e2e/agent-observation.spec.ts
git commit -m "test: add e2e test for agent observation flow"
```

---

## Task 11: Add auto-refresh option for observations

**Files:**
- Modify: `src/components/panel/agent-panel.tsx`
- Test: `src/components/panel/agent-panel.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/panel/agent-panel.test.tsx`:

```tsx
it('auto-refreshes observation when enabled', async () => {
  const user = userEvent.setup()
  render(<AgentPanel world={createInitialWorldSlice()} />)
  
  // Enable auto-refresh
  await user.click(screen.getByLabelText(/auto refresh/i))
  
  // Verify refresh happens automatically
  await waitFor(() => {
    expect(screen.getByText(/观察摘要/i)).toBeInTheDocument()
  }, { timeout: 5000 })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/panel/agent-panel.test.tsx`
Expected: FAIL because auto-refresh feature doesn't exist.

**Step 3: Write minimal implementation**

Add to `AgentPanel`:
- Checkbox/toggle for "Auto Refresh"
- When enabled, automatically refresh observation after world updates
- Use React effect to detect world.tick changes
- Debounce refresh calls to avoid excessive API usage
- Show indicator when auto-refresh is active


**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/panel/agent-panel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/panel/agent-panel.tsx src/components/panel/agent-panel.test.tsx
git commit -m "feat: add auto-refresh option for observations"
```

---

## Task 12: Verify complete implementation

**Files:**
- Modify: any files required by verification fixes

**Step 1: Run all unit and integration tests**

Run: `npm test`
Expected: PASS

**Step 2: Run all end-to-end tests**

Run: `npx playwright test`
Expected: PASS

**Step 3: Manual verification**

Run: `npm run dev`

Verify:
1. Agent generation works with natural language prompts
2. Agent selector populates with generated agents
3. Observation summary generates and displays correctly
4. Summary covers all five categories (world, agents, social, memory, self)
5. World snapshot is collapsible
6. Error states display properly
7. Loading states show progress
8. Auto-refresh works when enabled

**Step 4: Fix only failures found in verification**

Make minimal changes to fix any issues discovered.

**Step 5: Commit**

```bash
git add <exact files changed during verification>
git commit -m "fix: complete agent observation panel implementation"
```

---

## Implementation Notes

### LLM Prompt Design

**Agent Generation Prompt:**
```
Generate {count} distinct personal agents based on this description: "{prompt}"

For each agent, provide:
- A unique seed identifier (kebab-case)
- Persona traits (openness, stability, attachment, agency, empathy) as values 0-1
- Initial vitals (energy, stress, sleep_debt, focus, aging_index) as values 0-1
- A brief backstory or motivation

Return as JSON array.
```


**Observation Summary Prompt:**
```
You are observing the world through the perspective of agent "{agent.genetics.seed}".

Agent State:
- Persona: {agent.persona}
- Vitals: {agent.vitals}
- Recent memories: {agent.memory.slice(-5)}

World State:
- Tick: {world.tick}
- Time: {world.time}
- Recent events: {world.events.slice(-10)}

Other Agents:
{list of other agents in world}

Social Context:
- Narratives: {world.social_context.narratives}
- Pressures: {world.social_context.pressures}
- Macro events: {world.social_context.macro_events}

Generate a natural language observation summary covering:
1. World understanding (what's happening in the world)
2. Understanding of other agents (who else is here, what are they doing)
3. Social event understanding (broader social/cultural context)
4. Memory/cognition (what this agent remembers and thinks about)
5. Self-state understanding (how this agent feels physically and emotionally)

Write in first person from the agent's perspective. Be concise but comprehensive.
```

### API Environment Variables

Add to `.env.local`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

### Testing Strategy

- Unit tests: Test individual functions with mocked LLM responses
- Integration tests: Test API endpoints with test fixtures
- E2E tests: Test complete user flows in browser
- Manual testing: Verify LLM output quality and UX

### Performance Considerations

- Cache observation summaries to reduce API calls
- Debounce auto-refresh to avoid excessive generation
- Show loading states immediately for better UX
- Consider streaming responses for long summaries

### Accessibility

- Ensure all interactive elements are keyboard accessible
- Provide ARIA labels for screen readers
- Use semantic HTML elements
- Maintain sufficient color contrast
- Support reduced motion preferences

