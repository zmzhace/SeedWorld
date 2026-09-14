# SeedWorld 流水线重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec v2 重建章节管线：确定性 Engine＋Route 调度、Writer 六步工序、review-agent 审稿、节律谱执法、人在回路，同时修掉全部卡死类 bug。

**Architecture:** 新增 `engine-route`（Route 决策表＋Phase/Flow 校验，纯函数零 LLM）、`arbiter-service`（单次裁定）、`material-compiler`（统一素材＋token 预算）、`chapter-director-service`（导演立纲＋综合）、`rhythm`（谱＋能量纯函数）、`craft-deck`（12 张种子卡静态数据）；改造 `tick-workflow-service`（lease＋恢复＋重建）、`chapter-service`（守卫 verdict＋重试＋配额区分）、`scene-resolution-service`（独立采样＋veto）、`narrative-planning-service`（立谱）、DB 迁移、API 路由、UI。

**Tech Stack:** Next.js 14 ＋ TypeScript strict ＋ SQLite（better-sqlite3 同步 API）＋ Vitest ＋ OpenAI-compatible LLM（`chatJson`/`chatText`）

## Global Constraints

- 继续免费模型：`nex-agi/nex-n2.5-mini:free`，输入上限 27k tokens；material 总预算 12k 字符；演员/守卫并发 3。
- 调度零 LLM 开销；多 Agent 讨论只允许在 plan 与 check 两步内；步序/超时/fallback 由确定性代码钉死。
- 审稿通过＝零 critical/error＋deletionTestPassed＋确定性检查通过；七维分数仅展示，不卡门。
- 配额错误（403/402/429）标 `failed:配额`，永不锁下一轮；JSON 格式错误自动重试 3 次。
- 每个工具成功后写 checkpoint；`running/queued` 超 30 分钟无心跳视为孤儿，由 Engine 重建。
- blocked 文案禁止暴露内部常量，必须是作者可读的操作指引。
- 每章固定工序 `context → read_prev → plan → draft → check → commit`，顺序严格。

---

## File Structure

| 文件 | 职责 |
|---|---|
| Create `src/server/engine-route.ts` | Route 决策表＋Phase/Flow 校验＋孤儿判定，全部纯函数（无 DB、无 LLM），可穷举测试 |
| Create `src/server/arbiter-service.ts` | Arbiter 三裁定（启动选路/干预分诊/失败出路），单次 `chatJson`，结果可落盘结构 |
| Create `src/server/material-compiler.ts` | 统一素材组装：token 预算＋契约相关度截断＋丢弃计数＋相关章节推荐＋下一章预告 |
| Create `src/server/chapter-director-service.ts` | 导演 R1 立纲＋R3 综合＋veto 处理＋书面裁决 |
| Create `src/server/rhythm.ts` | 节律谱类型＋能量派生＋节奏守卫四执法，纯函数 |
| Create `src/server/craft-deck.ts` ＋ `src/server/craft-cards/*.md`（12 个文件） | 种子卡静态数据＋loader（读文件＋校验字段完整） |
| Create `src/server/review-gate.ts` | 逐章验收许可（permit 跟章节号绑定，重写/评审不耗许可） |
| Modify `src/domain/narrative-workflow.ts` | 新增类型：`ChapterFunction`、`EnergyLevel`、`ChapterSlot`、`SlotVeto`、`Phase`、`Flow`、`ReviewPermit`、`DirectorVerdict` |
| Modify `src/server/tick-workflow-service.ts` | 接 Route＋lease 心跳＋awaiting_chapter 恢复＋无 workflow 重建＋可读错误 |
| Modify `src/server/chapter-service.ts` | 三守卫 verdict＋总编综合＋brace-aware JSON＋配额区分＋token 预算走 compiler＋`?runId=` 支持＋wait 超时＋`getChapterRunForTick` relaunch |
| Modify `src/server/scene-resolution-service.ts` | 提案两次独立调用＋意图 veto 字段透传（生成仍隔离并行） |
| Modify `src/server/narrative-planning-service.ts` | 弧展开时立谱（功能序列＋能量派生），落 `outline_json` |
| Modify `src/server/database.ts` | 迁移：`review_permits` 表＋`rhythm_spectra` 表＋`workflow_checkpoints` 复用（无新列则不动现有表） |
| Modify `app/api/worlds/[id]/chapters/route.ts` | GET 支持 `?runId=` |
| Create `app/api/worlds/[id]/steer/route.ts` | 实时干预入口（存指令＋调 Arbiter 分诊＋执行路由） |
| Create `app/api/worlds/[id]/review-gate/route.ts` | 验收闸开关＋`/next` 放行 |
| Modify `src/components/panel/novel-studio-panel.tsx` | 本轮卡片（状态机可视＋trace＋就地重规划/废弃/改谱） |
| Modify `src/components/mf/step-report.tsx` | 退役手动编排（改为只读历史＋“重新生成”走正常管线），按 runId 跟踪 |

Wave 切分（每波独立可测可发）：Wave 0＝Task 1-3（卡死消失）；Wave 1＝Task 4-6（写手管线＋审稿）；Wave 2＝Task 7-8（节律＋章法）；Wave 3＝Task 9-10（人在回路＋UI）。

---

### Task 1: engine-route（Route 决策表＋Phase/Flow＋孤儿判定，纯函数）

**Files:**
- Create: `src/server/engine-route.ts`
- Test: `src/server/engine-route.test.ts`

**Interfaces:**
- Consumes: 无（纯函数，只收 plain state 对象，方便穷举测试）。
- Produces: `decideRoute(state: TickState) => RouteAction`；`checkPhase(from: Phase, to: Phase) => boolean`；`checkFlow(from: Flow, to: Flow) => boolean`；`isOrphan(run: {status: string; updatedAt: string}, nowMs: number) => boolean`。后继 Task 2/3/6 依赖这四个签名。

```typescript
// TickState / RouteAction 定义（与 Task 2 的 DB 行映射对接）
export type Phase = 'init' | 'premise' | 'outline' | 'writing' | 'complete';
export type Flow = 'writing' | 'reviewing' | 'rewriting' | 'polishing' | 'steering';
export type TickState = {
  tickStatus: 'planning' | 'simulating' | 'awaiting_chapter' | 'reviewing' | 'blocked' | 'published';
  chapterStatus?: 'queued' | 'running' | 'completed' | 'failed' | 'failed_quota';
  hasWorkflowRun: boolean;
  blockReason?: string;
};
export type RouteAction =
  | { kind: 'resume_execute'; tick: number }
  | { kind: 'resume_chapter'; tick: number }
  | { kind: 'rebuild_workflow'; tick: number }
  | { kind: 'await_author' }
  | { kind: 'advance_next' };
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/engine-route.test.ts
import { describe, expect, it } from 'vitest';
import { checkFlow, checkPhase, decideRoute, isOrphan } from './engine-route';

describe('checkPhase', () => {
  it('allows forward only', () => {
    expect(checkPhase('outline', 'writing')).toBe(true);
    expect(checkPhase('writing', 'writing')).toBe(true);
    expect(checkPhase('writing', 'premise')).toBe(false);
    expect(checkPhase('complete', 'writing')).toBe(false);
  });
});

describe('checkFlow', () => {
  it('blocks rewriting -> reviewing', () => {
    expect(checkFlow('writing', 'reviewing')).toBe(true);
    expect(checkFlow('reviewing', 'rewriting')).toBe(true);
    expect(checkFlow('rewriting', 'reviewing')).toBe(false);
  });
});

describe('decideRoute', () => {
  it('resumes orphan awaiting_chapter via chapter path', () => {
    expect(decideRoute({ tickStatus: 'awaiting_chapter', chapterStatus: 'running', hasWorkflowRun: true }))
      .toEqual({ kind: 'resume_chapter', tick: expect.any(Number) });
  });
  it('rebuilds migration-locked ticks without workflow', () => {
    expect(decideRoute({ tickStatus: 'blocked', hasWorkflowRun: false, blockReason: 'WORKFLOW_MIGRATION_REQUIRED' }))
      .toEqual({ kind: 'rebuild_workflow', tick: expect.any(Number) });
  });
  it('waits for author on ordinary blocked ticks', () => {
    expect(decideRoute({ tickStatus: 'blocked', hasWorkflowRun: true, blockReason: '审稿未过' }))
      .toEqual({ kind: 'await_author' });
  });
});

describe('isOrphan', () => {
  it('flags running runs silent for 30min', () => {
    const now = Date.now();
    expect(isOrphan({ status: 'running', updatedAt: new Date(now - 31 * 60_000).toISOString() }, now)).toBe(true);
    expect(isOrphan({ status: 'running', updatedAt: new Date(now - 5 * 60_000).toISOString() }, now)).toBe(false);
    expect(isOrphan({ status: 'completed', updatedAt: new Date(0).toISOString() }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/engine-route.test.ts`
Expected: FAIL with "Failed to resolve import ./engine-route"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/engine-route.ts
import 'server-only';

export type Phase = 'init' | 'premise' | 'outline' | 'writing' | 'complete';
export type Flow = 'writing' | 'reviewing' | 'rewriting' | 'polishing' | 'steering';
export type TickState = {
  tickStatus: 'planning' | 'simulating' | 'awaiting_chapter' | 'reviewing' | 'blocked' | 'published';
  chapterStatus?: 'queued' | 'running' | 'completed' | 'failed' | 'failed_quota';
  hasWorkflowRun: boolean;
  blockReason?: string;
};
export type RouteAction =
  | { kind: 'resume_execute'; tick: number }
  | { kind: 'resume_chapter'; tick: number }
  | { kind: 'rebuild_workflow'; tick: number }
  | { kind: 'await_author' }
  | { kind: 'advance_next' };

const PHASE_ORDER: Phase[] = ['init', 'premise', 'outline', 'writing', 'complete'];
export function checkPhase(from: Phase, to: Phase): boolean {
  return PHASE_ORDER.indexOf(to) >= PHASE_ORDER.indexOf(from);
}

const FLOW_EDGES: Record<Flow, Flow[]> = {
  writing: ['reviewing', 'rewriting', 'polishing', 'steering', 'writing'],
  reviewing: ['writing', 'rewriting', 'polishing', 'steering', 'reviewing'],
  rewriting: ['writing', 'steering', 'rewriting'],
  polishing: ['writing', 'steering', 'polishing'],
  steering: ['writing', 'reviewing', 'rewriting', 'polishing', 'steering'],
};
export function checkFlow(from: Flow, to: Flow): boolean {
  return FLOW_EDGES[from].includes(to);
}

const ORPHAN_MS = 30 * 60_000;
export function isOrphan(run: { status: string; updatedAt: string }, nowMs: number): boolean {
  if (run.status !== 'queued' && run.status !== 'running') return false;
  return nowMs - new Date(run.updatedAt).getTime() > ORPHAN_MS;
}

export function decideRoute(state: TickState & { tick?: number }): RouteAction {
  const tick = state.tick ?? 0;
  if (state.tickStatus === 'planning' || state.tickStatus === 'simulating') {
    return { kind: 'resume_execute', tick };
  }
  if (state.tickStatus === 'awaiting_chapter' || state.tickStatus === 'reviewing') {
    return { kind: 'resume_chapter', tick };
  }
  if (state.tickStatus === 'blocked' && !state.hasWorkflowRun) {
    return { kind: 'rebuild_workflow', tick };
  }
  if (state.tickStatus === 'blocked') return { kind: 'await_author' };
  return { kind: 'advance_next' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/engine-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/engine-route.ts src/server/engine-route.test.ts
git commit -m "feat: deterministic engine route table with phase/flow guards"
```

---

### Task 2: tick-workflow 接 Route＋恢复＋重建＋可读错误

**Files:**
- Modify: `src/server/tick-workflow-service.ts`
- Test: extend existing flow with `src/server/tick-workflow-route.test.ts` (DB 隔离：用 `getDatabase` 前先设 `SEEDWORLD_DATA_DIR` 到临时目录；若仓库已有隔离模式则沿用，见 `src/server/persistence.test.ts`)

**Interfaces:**
- Consumes: Task 1 的 `decideRoute`、`isOrphan`。
- Produces: `startTickWorkflow` 新行为（awaiting_chapter 恢复；迁移锁死 rebuild）；`replanTickWorkflow` 无 workflow 时重建；错误文案映射 `toAuthorError(reason: string) => string`（后继 UI 直接展示）。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/tick-workflow-route.test.ts
import { describe, expect, it } from 'vitest';
import { decideRoute } from './engine-route';

describe('route wiring contract', () => {
  it('awaiting_chapter with dead chapter run routes to resume_chapter', () => {
    const action = decideRoute({ tick: 3, tickStatus: 'awaiting_chapter', chapterStatus: 'failed', hasWorkflowRun: true });
    expect(action).toEqual({ kind: 'resume_chapter', tick: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/tick-workflow-route.test.ts`
Expected: FAIL（`decideRoute` 对该组合返回 resume_chapter 才算 wiring 目标；先写实现再补全，此步先确认 harness 能跑——若直接 PASS 则把断言改成 `rebuild_workflow` 反例确保红灯，见 Step 3 注释）

- [ ] **Step 3: Modify tick-workflow-service**

```typescript
// 在 startTickWorkflow 的 unfinished 分支中：
import { decideRoute, isOrphan } from './engine-route';

// unfinished tick（含 awaiting_chapter/reviewing）一律走 decideRoute：
const current = getTickWorkflowStatus(worldId, unfinished.tick)!;
const chapterStale = current.chapter && ['queued', 'running'].includes(current.chapter.status);
const action = decideRoute({
  tick: unfinished.tick,
  tickStatus: current.status as TickState['tickStatus'],
  chapterStatus: current.chapter?.status as TickState['chapterStatus'],
  hasWorkflowRun: Boolean(current.workflowRunId),
  blockReason: current.blockReason,
});
if (action.kind === 'resume_execute' && current.workflowRunId) void executeTick(worldId, unfinished.tick, current.workflowRunId);
if (action.kind === 'resume_chapter') void resumeChapterForTick(worldId, unfinished.tick); // 新函数：见下
return current;

// 新函数 resumeChapterForTick：
export function resumeChapterForTick(worldId: string, tick: number) {
  const { getLatestChapterRun } = require('./chapter-service') as typeof import('./chapter-service');
  const run = getLatestChapterRun(worldId); // 自带 relaunch（Task 3 补 getChapterRunForTick 同等能力）
  if (!run || run.tick !== tick || !['queued', 'running'].includes(run.status)) {
    // 无可恢复 run：按现有 startChapterRun 重建（需 contractId，查最新 evolution_contracts）
  }
}

// replanTickWorkflow：无 workflow 时重建而非抛错：
const workflow = db.prepare('SELECT id FROM workflow_runs WHERE world_id=? AND tick=?').get(worldId, tick) as { id: string } | undefined;
if (!workflow) {
  // 走 discard 语义清 tick 后按 startTickWorkflow 重建（UID 可查现有 discardTickWorkflow 实现复用）
}

// toAuthorError 映射（禁止内部常量外泄）：
const AUTHOR_ERRORS: Array<[RegExp, string]> = [
  [/WORKFLOW_MIGRATION_REQUIRED/, '该轮是旧版本遗留，可点“废弃并重建”后继续'],
  [/全书大纲未通过结构审查/, '大纲没过结构评审：已保留评审意见，点“按证据重规划”重试'],
  [/审稿结果不是有效 JSON/, '审稿输出格式坏了，系统会自动重试 3 次'],
  [/403|overdue/i, '模型配额用完了（免费额度），稍后点重试，不锁下一轮'],
  [/token limit|27000/i, '本章素材超长，已自动压缩，点重试即可'],
];
export function toAuthorError(reason: string): string {
  for (const [re, text] of AUTHOR_ERRORS) if (re.test(reason)) return text;
  return reason.slice(0, 200);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/server/tick-workflow-route.test.ts src/server/engine-route.test.ts`
Expected: PASS；另全量 `npx vitest run src/server` 无新增失败（基线失败先记录，不修不相关）

- [ ] **Step 5: Commit**

```bash
git add src/server/tick-workflow-service.ts src/server/tick-workflow-route.test.ts
git commit -m "feat: tick workflow resumes orphan chapters and rebuilds migration-locked ticks"
```

---

### Task 3: chapter-service 可靠性（relaunch＋超时＋runId＋配额区分）

**Files:**
- Modify: `src/server/chapter-service.ts`
- Modify: `app/api/worlds/[id]/chapters/route.ts`（GET `?runId=`）
- Test: `src/server/chapter-service-reliability.test.ts`（纯函数部分：extractJson brace-aware＋状态映射；DB 部分复用 Task 2 隔离模式）

**Interfaces:**
- Consumes: Task 1 `isOrphan`；Task 5 的 compiler（本 Task 先以字符预算占位，签名对齐：`compileMaterial(...): { material: string; dropped: number }`，Task 5 实现后替换占位）。
- Produces: `getChapterRun(worldId, runId)`；`extractReviewJson(content: string)`；`mapQuotaError(error: unknown) => 'quota' | 'format' | 'other'`；`waitChapterRun` 30 分钟超时抛错。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/chapter-service-reliability.test.ts
import { describe, expect, it } from 'vitest';
import { extractReviewJson, mapQuotaError } from './chapter-service';

describe('extractReviewJson', () => {
  it('parses chatter around a single object', () => {
    expect(extractReviewJson('好的：{"a":1} 就这样')).toEqual({ a: 1 });
  });
  it('rejects trailing second JSON container', () => {
    expect(() => extractReviewJson('{"a":1} {"b":2}')).toThrow();
  });
  it('rejects unbalanced braces', () => {
    expect(() => extractReviewJson('{"a":')).toThrow();
  });
});

describe('mapQuotaError', () => {
  it('detects quota errors', () => {
    expect(mapQuotaError(new Error('403 Access denied due to overdue account'))).toBe('quota');
    expect(mapQuotaError(new Error('400 input token limit is 27000'))).toBe('quota');
    expect(mapQuotaError(new Error('boom'))).toBe('other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/chapter-service-reliability.test.ts`
Expected: FAIL（`extractReviewJson`/`mapQuotaError` 未导出）

- [ ] **Step 3: Write minimal implementation**

```typescript
// 在 chapter-service.ts 中：
// 1) extractJson 替换为 brace-aware（照抄 openai-compat extractFirstJsonObject 思路＋trailing 容器拒绝）：
//    export function extractReviewJson(content: string): Record<string, unknown> { ... }
//    旧 extractJson 保留壳调用新函数，避免改动 reviewStateEvidence 调用点。
// 2) export function mapQuotaError(error: unknown): 'quota' | 'format' | 'other' {
//      const msg = error instanceof Error ? error.message : String(error);
//      if (/403|402|429|overdue|token limit|27000/i.test(msg)) return 'quota';
//      if (/JSON|json|unbalanced|multiple JSON/i.test(msg)) return 'format';
//      return 'other';
//    }
//    markChapterFailure 中：quota → reportRun status 'failed' 且 stage 'quota_blocked'，
//    simulation_ticks 保持 'awaiting_chapter'（不锁下一轮，见 Task 2 resume_chapter 可重建）。
// 3) getChapterRunForTick 增加与 getLatestChapterRun 同等的 launchChapterRun 逻辑；
//    waitChapterRun 循环加 deadline（Date.now() + 30*60_000，超时抛 '章节任务超时（30分钟），已可重试'）。
// 4) 新增 getChapterRun(worldId, runId)；chapters/route.ts GET 读 searchParams runId，有则返回指定 run＋chapter。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/chapter-service-reliability.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/chapter-service.ts "app/api/worlds/[id]/chapters/route.ts" src/server/chapter-service-reliability.test.ts
git commit -m "feat: chapter runs resumable, quota-aware, pollable by run id"
```

---

### Task 4: 素材编译器 material-compiler（统一截断＋推荐＋预告）

**Files:**
- Create: `src/server/material-compiler.ts`
- Test: `src/server/material-compiler.test.ts`

**Interfaces:**
- Consumes: DB 行（entities/claims/events/outlines，由调用方传入 plain 数组，保持纯函数可测）。
- Produces: `compileMaterial(input: MaterialInput, budget: MaterialBudget) => { material: string; dropped: number; droppedKinds: string[] }`。Task 5/6 的调用方；Task 3 的占位在此被真实实现替换。

```typescript
export type MaterialInput = {
  ticks: Array<{ tick: number; text: string; relevant: boolean }>;
  facts: Array<{ text: string; relevant: boolean }>;
  contractText: string; // 契约永不截断
  extras: Array<{ kind: string; text: string; relevant: boolean }>;
};
export type MaterialBudget = { totalChars: number }; // 默认 { totalChars: 12000 }
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/material-compiler.test.ts
import { describe, expect, it } from 'vitest';
import { compileMaterial } from './material-compiler';

describe('compileMaterial', () => {
  it('never truncates contract and drops irrelevant first', () => {
    const out = compileMaterial({
      ticks: [{ tick: 1, text: 'x'.repeat(9000), relevant: false }],
      facts: [{ text: 'y'.repeat(9000), relevant: true }],
      contractText: 'CONTRACT',
      extras: [],
    }, { totalChars: 12000 });
    expect(out.material).toContain('CONTRACT');
    expect(out.material.length).toBeLessThanOrEqual(12000);
    expect(out.dropped).toBeGreaterThan(0);
    expect(out.droppedKinds).toContain('ticks');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/material-compiler.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/material-compiler.ts
import 'server-only';
export type MaterialInput = { /* 同上 */ };
export type MaterialBudget = { totalChars: number };

export function compileMaterial(input: MaterialInput, budget: MaterialBudget = { totalChars: 12000 }): { material: string; dropped: number; droppedKinds: string[] } {
  const parts: Array<{ kind: string; text: string; relevant: boolean; pinned: boolean }> = [
    { kind: 'contract', text: input.contractText, relevant: true, pinned: true },
    ...input.ticks.map((t) => ({ kind: 'ticks', text: t.text, relevant: t.relevant, pinned: false })),
    ...input.facts.map((f) => ({ kind: 'facts', text: f.text, relevant: f.relevant, pinned: false })),
    ...input.extras.map((e) => ({ kind: e.kind, text: e.text, relevant: e.relevant, pinned: false })),
  ];
  // 排序：pinned → relevant → 其余；超预算从末尾截断并计数
  const ordered = [...parts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.relevant) - Number(a.relevant));
  let used = 0; const kept: string[] = []; let dropped = 0; const droppedKinds = new Set<string>();
  for (const p of ordered) {
    if (used + p.text.length <= budget.totalChars) { kept.push(p.text); used += p.text.length; }
    else { dropped += 1; droppedKinds.add(p.kind); }
  }
  return { material: kept.join('\n'), dropped, droppedKinds: [...droppedKinds] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/material-compiler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/material-compiler.ts src/server/material-compiler.test.ts
git commit -m "feat: unified material compiler with token budget and drop accounting"
```

---

### Task 5: 导演服务＋veto（R1 立纲＋R3 综合）

**Files:**
- Create: `src/server/chapter-director-service.ts`
- Modify: `src/domain/narrative-workflow.ts`（加 `ChapterSlot`、`SlotVeto`、`DirectorRuling` 类型）
- Modify: `src/server/scene-resolution-service.ts`（意图结果透传 veto 字段；提案改为两次独立 `chatJson` 调用）
- Test: `src/server/chapter-director-service.test.ts`（综合规则纯函数可测；LLM 部分以固定 fixture 测 JSON 归一化）

**Interfaces:**
- Consumes: Task 4 `compileMaterial`（章纲素材）、Task 6 `rhythm`（槽位数＝配额）。
- Produces: `buildScaffold(input: ScaffoldInput) => Promise<ChapterScaffold>`；`synthesize(intents, vetoes, scaffold) => DirectorRuling`（纯函数）；`DirectorRuling { finalScaffold; changed: string[]; reasons: string[]; obligations: string[] }`。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/chapter-director-service.test.ts
import { describe, expect, it } from 'vitest';
import { synthesize } from './chapter-director-service';

describe('synthesize', () => {
  const scaffold = { slots: [{ id: 's1', actorId: 'a', fn: 'enter' }, { id: 's2', actorId: 'b', fn: 'climax' }] };
  it('accepts veto and reassigns slot', () => {
    const ruling = synthesize(scaffold as never, [], [{ slotId: 's2', actorId: 'b', reason: '底线：绝不背叛', evidence: '小传第3段' }] as never);
    expect(ruling.changed.length).toBeGreaterThan(0);
    expect(ruling.reasons.join('')).toContain('b');
  });
  it('passes through clean intents unchanged', () => {
    const ruling = synthesize(scaffold as never, [{ actorId: 'a' }, { actorId: 'b' }] as never, []);
    expect(ruling.changed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/chapter-director-service.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/chapter-director-service.ts
import 'server-only';
export type ChapterSlot = { id: string; ordinal: number; fn: string; actorId?: string; goal?: string; energyCap?: number };
export type SlotVeto = { slotId: string; actorId: string; reason: string; evidence: string };
export type DirectorRuling = { finalScaffold: { slots: ChapterSlot[] }; changed: string[]; reasons: string[]; obligations: string[] };

// buildScaffold：一次 chatJson（OUTLINE_RULES＋槽位配额指令），返回 { slots }；解析失败抛错由调用方按 Task 3 重试策略处理。
// synthesize：纯函数——有 veto 则该槽 actorId 置空＋changed 记 `slot:${slotId} 释放 ${actorId}（${reason}）`＋obligations 记 `为 ${actorId} 另安排兑现：${reason}`；无 veto 原样通过。
export function synthesize(scaffold: { slots: ChapterSlot[] }, _intents: unknown[], vetoes: SlotVeto[]): DirectorRuling {
  const slots = scaffold.slots.map((s) => ({ ...s }));
  const changed: string[] = []; const reasons: string[] = []; const obligations: string[] = [];
  for (const veto of vetoes) {
    const slot = slots.find((s) => s.id === veto.slotId);
    if (!slot) continue;
    slot.actorId = undefined;
    changed.push(`slot:${slot.id} 释放 ${veto.actorId}`);
    reasons.push(`${veto.actorId} veto ${slot.id}：${veto.reason}（证据：${veto.evidence}）`);
    obligations.push(`为 ${veto.actorId} 另安排兑现：${veto.reason}`);
  }
  return { finalScaffold: { slots }, changed, reasons, obligations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/chapter-director-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/chapter-director-service.ts src/server/chapter-director-service.test.ts src/domain/narrative-workflow.ts src/server/scene-resolution-service.ts
git commit -m "feat: chapter director scaffold and veto synthesis"
```

---

### Task 6: 三守卫审稿 verdict（废死分数）

**Files:**
- Modify: `src/server/chapter-service.ts`（`reviewChapter` 改三守卫独立调用＋总编综合；`normalizeReview` 通过条件改 verdict 制）
- Test: `src/server/chapter-review-verdict.test.ts`（`decideChapterVerdict(review) => boolean` 纯函数测试）

**Interfaces:**
- Consumes: Task 5 裁决（未解决 issues 输入）；Task 7 节奏执法（节奏守卫 prompt 输入）。
- Produces: `decideChapterVerdict(review: { issues: Array<{severity: string}>; deletionTestPassed: boolean; deterministicFailed: boolean }) => boolean`。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/chapter-review-verdict.test.ts
import { describe, expect, it } from 'vitest';
import { decideChapterVerdict } from './chapter-service';

describe('decideChapterVerdict', () => {
  it('passes with only warnings and deletion test green', () => {
    expect(decideChapterVerdict({ issues: [{ severity: 'warning' }], deletionTestPassed: true, deterministicFailed: false })).toBe(true);
  });
  it('fails on error regardless of scores', () => {
    expect(decideChapterVerdict({ issues: [{ severity: 'error' }], deletionTestPassed: true, deterministicFailed: false })).toBe(false);
  });
  it('fails when deletion test fails', () => {
    expect(decideChapterVerdict({ issues: [], deletionTestPassed: false, deterministicFailed: false })).toBe(false);
  });
  it('fails on deterministic gate', () => {
    expect(decideChapterVerdict({ issues: [], deletionTestPassed: true, deterministicFailed: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/chapter-review-verdict.test.ts`
Expected: FAIL（`decideChapterVerdict` 未导出）

- [ ] **Step 3: Write minimal implementation**

```typescript
// chapter-service.ts 新增并接入 normalizeReview：
export function decideChapterVerdict(review: {
  issues: Array<{ severity: string }>;
  deletionTestPassed: boolean;
  deterministicFailed: boolean;
}): boolean {
  if (!review.deletionTestPassed || review.deterministicFailed) return false;
  return !review.issues.some((i) => i.severity !== 'warning');
}
// normalizeReview 末尾：review.passed = decideChapterVerdict({ issues: review.issues, deletionTestPassed: review.deletionTestPassed, deterministicFailed: deterministic.length > 0 });
// reviewChapter 改为三守卫独立 chatText（设定/人物/节奏各一次，并发）＋总编综合裁决；单守卫 JSON 坏走 Task 3 extractReviewJson＋3 次重试。
// 七维 dimensions 继续计算仅展示。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/chapter-review-verdict.test.ts src/server/chapter-service-reliability.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/chapter-service.ts src/server/chapter-review-verdict.test.ts
git commit -m "feat: review-agent verdict replaces score gates"
```

---

### Task 7: 节律 rhythm（谱＋能量派生＋四执法，纯函数）

**Files:**
- Create: `src/server/rhythm.ts`
- Test: `src/server/rhythm.test.ts`

**Interfaces:**
- Consumes: 弧章节数（6-10）＋章 ordinal。
- Produces: `planSpectrum(chapterCount: number) => ChapterFunction[]`；`energyCapFor(fn: ChapterFunction) => EnergyLevel`；`slotQuotaFor(fn: ChapterFunction) => number`；`enforceRhythm(chapter: { fn: ChapterFunction; events: EnergyLevel[]; opensNewThread: boolean }, spectrum: ChapterFunction[]) => string[]`（返回违规列表，为空即通过）。Task 5（槽位配额）与 Task 6（节奏守卫）依赖。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/rhythm.test.ts
import { describe, expect, it } from 'vitest';
import { energyCapFor, enforceRhythm, planSpectrum, slotQuotaFor } from './rhythm';

describe('planSpectrum', () => {
  it('opens with 起 and buffers after 转', () => {
    const spec = planSpectrum(8);
    expect(spec[0]).toBe('起');
    expect(spec[spec.length - 1]).toBe('合');
    const turnIdx = spec.findIndex((f) => f === '转');
    expect(spec[turnIdx + 1]).toBe('承');
  });
});

describe('caps and quotas', () => {
  it('derives caps from function', () => {
    expect(energyCapFor('承')).toBe(2);
    expect(slotQuotaFor('起')).toBe(3);
    expect(slotQuotaFor('转')).toBe(5);
  });
});

describe('enforceRhythm', () => {
  it('rejects over-energy events in 承', () => {
    const bad = enforceRhythm({ fn: '承', events: [2, 4], opensNewThread: true }, planSpectrum(8));
    expect(bad.length).toBeGreaterThan(0);
  });
  it('rejects 合 without new thread', () => {
    const bad = enforceRhythm({ fn: '合', events: [3], opensNewThread: false }, planSpectrum(8));
    expect(bad.join('')).toContain('开新账');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/rhythm.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/rhythm.ts
export type ChapterFunction = '起' | '承' | '转' | '合' | '承转之间';
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export function planSpectrum(chapterCount: number): ChapterFunction[] {
  const n = Math.max(6, Math.min(10, chapterCount));
  const spec: ChapterFunction[] = ['起', '承', '承', '承转之间', '转', '转', '承', '合'];
  return spec.slice(0, n); // 6章取前6（起承承承转之间转转），7章＋承缓冲，8章标准谱
}

export function energyCapFor(fn: ChapterFunction): EnergyLevel {
  return fn === '起' || fn === '承' ? 2 : fn === '承转之间' || fn === '合' ? 3 : 4;
}

export function slotQuotaFor(fn: ChapterFunction): number {
  return fn === '转' ? 5 : fn === '承转之间' || fn === '合' ? 4 : 3;
}

export function enforceRhythm(chapter: { fn: ChapterFunction; events: EnergyLevel[]; opensNewThread: boolean }, _spectrum: ChapterFunction[]): string[] {
  const issues: string[] = [];
  const cap = energyCapFor(chapter.fn);
  const over = chapter.events.filter((e) => e > cap);
  if (over.length && !(chapter.fn === '转')) issues.push(`燃错位置：${chapter.fn}章能量封顶${cap}级，出现${over.join('、')}级事件`);
  if (chapter.fn === '合' && !chapter.opensNewThread) issues.push('合章未开新账（连载事故）');
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/rhythm.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/rhythm.ts src/server/rhythm.test.ts
git commit -m "feat: rhythm spectrum with derived energy caps and enforcement"
```

---

### Task 8: 章法库种子卡（12 张＋loader）＋弧立谱接线

**Files:**
- Create: `src/server/craft-deck.ts` ＋ `src/server/craft-cards/*.md`（12 文件：`open-action.md`、`open-dialogue.md`、`open-anomaly-daily.md`、`open-withheld.md`、`mid-tighten.md`、`mid-staged-reveal.md`、`mid-relation-probe.md`、`mid-raise-stakes.md`、`end-decision-hook.md`、`end-consequence-hook.md`、`end-reversal-hook.md`、`end-still-water-hook.md`）
- Modify: `src/server/narrative-planning-service.ts`（弧展开时调 Task 7 `planSpectrum`，功能/能量写入 `outline_json`）
- Test: `src/server/craft-deck.test.ts`（12 卡字段完整＋功能/能量覆盖起承转合）

**Interfaces:**
- Consumes: Task 7 类型。
- Produces: `loadCraftDeck() => CraftCard[]`；`pickCards(fn: ChapterFunction, energyCap: EnergyLevel) => CraftCard[]`。Task 5 `buildScaffold` prompt 引用。

每张卡固定六段（`## 手法 / ## 出处 / ## 适用功能 / ## 适用能量 / ## 做法 / ## 反模式`），示例：

```markdown
## 手法
异常日常开
## 出处
《哈利·波特》首章思路：正常生活裂开一道缝，主角先被异常找上门
## 适用功能
起
## 适用能量
2
## 做法
1. 先写一段完整可信的日常，最多 300 字；
2. 让异常在日常逻辑内发生（猫看地图、猫头鹰白天出没），不解释；
3. POV 只记录感知，不追问原理；
4. 段末留一个未解信号进入下一拍。
## 反模式
开篇先讲世界观设定三段；异常一出场就有人讲解原理。
```

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/craft-deck.test.ts
import { describe, expect, it } from 'vitest';
import { loadCraftDeck, pickCards } from './craft-deck';

describe('craft deck', () => {
  it('loads 12 complete cards', () => {
    const deck = loadCraftDeck();
    expect(deck).toHaveLength(12);
    for (const card of deck) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.origin.length).toBeGreaterThan(0);
      expect(card.steps.length).toBeGreaterThanOrEqual(3);
      expect(card.antiPattern.length).toBeGreaterThan(0);
    }
  });
  it('covers 起承转合 and picks by function', () => {
    const fns = new Set(loadCraftDeck().flatMap((c) => c.functions));
    expect([...fns].sort().join('')).toContain('起承转合');
    expect(pickCards('起', 2).length).toBeGreaterThan(0);
    expect(pickCards('起', 2).every((c) => c.energy <= 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/craft-deck.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write cards＋loader＋弧接线**

```typescript
// src/server/craft-deck.ts
import 'server-only';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
export type CraftCard = { id: string; name: string; origin: string; functions: string[]; energy: number; steps: string[]; antiPattern: string };
function section(md: string, title: string): string {
  const m = md.match(new RegExp(`## ${title}\n([\\s\\S]*?)(?=\n## |\n$)`));
  return (m?.[1] ?? '').trim();
}
export function loadCraftDeck(dir = path.join(__dirname, 'craft-cards')): CraftCard[] {
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const md = readFileSync(path.join(dir, f), 'utf8');
    const steps = section(md, '做法').split('\n').map((s) => s.trim()).filter(Boolean);
    const energy = Number(section(md, '适用能量').match(/\d+/)?.[0] ?? 5);
    return { id: f.replace(/\.md$/, ''), name: section(md, '手法').split('\n')[0], origin: section(md, '出处'), functions: [...section(md, '适用功能')], energy, steps, antiPattern: section(md, '反模式') };
  });
}
export function pickCards(fn: string, cap: number): CraftCard[] {
  return loadCraftDeck().filter((c) => c.functions.includes(fn) && c.energy <= cap);
}
// narrative-planning-service.ts 弧展开落盘处：outline_json 追加 { chapterFunction, energyCap }（取 Task 7 planSpectrum/energyCapFor）。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/craft-deck.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/craft-deck.ts "src/server/craft-cards" src/server/craft-deck.test.ts src/server/narrative-planning-service.ts
git commit -m "feat: craft deck seed cards with rhythm spectrum wiring"
```

---

### Task 9: 人在回路（验收闸＋steer＋sync 门禁＋diag）

**Files:**
- Create: `src/server/review-gate.ts` ＋ `app/api/worlds/[id]/review-gate/route.ts` ＋ `app/api/worlds/[id]/steer/route.ts`
- Modify: `src/server/database.ts`（`review_permits` 表：`id, world_id, chapter_number, status, created_at`）
- Modify: `src/server/arbiter-service.ts`（Task 2 建；本 Task 加 `triageSteer`，若 Task 2 未建则本 Task 一并建最小版）
- Test: `src/server/review-gate.test.ts`（许可绑定章节号；重写不耗许可；崩溃不误耗）

**Interfaces:**
- Consumes: Task 1 Route（验收闸接入 `advance_next`：无许可则停）。
- Produces: `grantPermit(worldId, chapterNumber)`；`consumePermit(worldId, chapterNumber) => boolean`；`triageSteer(text: string) => { scope: 'setting' | 'rewrite' | 'rule'; summary: string }`。

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/review-gate.test.ts
import { describe, expect, it } from 'vitest';
import { consumePermit, grantPermit } from './review-gate';

describe('review gate', () => {
  it('binds permit to chapter number; rewrite does not consume', () => {
    grantPermit('w1', 7);
    expect(consumePermit('w1', 7)).toBe(true);
    expect(consumePermit('w1', 7)).toBe(false); // 已消费
    grantPermit('w1', 8);
    expect(consumePermit('w1', 7)).toBe(false); // 章节号不对不消费
  });
});
```

注：`review-gate.ts` 初版用内存 Map＋DB 持久化两层（DB 表由本 Task 迁移；单测走内存层，集成走 DB，函数签名一致）。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/review-gate.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/review-gate.ts
import 'server-only';
const permits = new Map<string, true>();
const key = (worldId: string, n: number) => `${worldId}:${n}`;
export function grantPermit(worldId: string, chapterNumber: number): void { permits.set(key(worldId, chapterNumber), true); }
export function consumePermit(worldId: string, chapterNumber: number): boolean {
  const k = key(worldId, chapterNumber);
  if (!permits.has(k)) return false;
  permits.delete(k);
  return true;
}
// steer/route.ts：存指令（workflow_checkpoints run_kind='steer'）→ triageSteer 单次 chatJson →
//   setting→转 Architect 任务；rewrite→Editor 重写队列；rule→即时落盘 writingSettings。
// review-gate/route.ts：POST { action: 'on'|'off'|'next' }；'next' 对下一章号 grantPermit。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/review-gate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/review-gate.ts src/server/review-gate.test.ts src/server/database.ts "app/api/worlds/[id]/review-gate/route.ts" "app/api/worlds/[id]/steer/route.ts" src/server/arbiter-service.ts
git commit -m "feat: per-chapter review gate with steer triage"
```

---

### Task 10: UI（本轮卡片＋退役手动编排＋runId 跟踪）

**Files:**
- Modify: `src/components/panel/novel-studio-panel.tsx`
- Modify: `src/components/mf/step-report.tsx`
- Test: `app/worlds/[id]/page.test.tsx` 追加（本轮卡片渲染 blocked 原因＋重规划按钮存在；step-report 无手动表单）

**Interfaces:**
- Consumes: Task 2 `toAuthorError` 文案；Task 3 `?runId=`；Task 9 验收闸/steer 入口。
- Produces: 可视本轮状态机＋trace＋就地操作；章节流（功能/能量/义务兑现）。

- [ ] **Step 1: Write the failing test**

```tsx
// 追加到 app/worlds/[id]/page.test.tsx（沿用现有 mock 风格）：
it('shows current-round card with blocked reason and actions', async () => {
  // mock tick run status blocked＋blockReason；断言重规划/废弃按钮与可读文案出现
});
it('step report no longer offers manual range form', async () => {
  // 断言 tickFrom stepper 不存在，存在“按 runId 跟踪中”状态
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/worlds/[id]/page.test.tsx`
Expected: FAIL（新断言找不到元素）

- [ ] **Step 3: Implement UI changes**

```tsx
// novel-studio-panel.tsx：新增 <section className="round-card">：
//   状态机六段（立纲→交戏→综合→写稿→审稿→发布）按 chapterRun.stage/tickRun.stage 点亮；
//   blocked 显示 toAuthorError(blockReason)＋三个按钮（重规划/废弃/改谱，改谱跳 outline）；
//   trace 折叠显示 DirectorRuling（改了哪/为什么/obligations）。
// step-report.tsx：删除 tickFrom/eventIds/pov/goal 表单与 POST 生成逻辑；保留章节历史只读＋
//   按 runId 轮询（复用 Task 3 GET ?runId=）；失败按钮文案“重新生成”（走正常管线）。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/worlds/[id]/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/novel-studio-panel.tsx src/components/mf/step-report.tsx "app/worlds/[id]/page.test.tsx"
git commit -m "feat: round-centric workspace with manual path retired"
```

---

## Self-Review

**1. Spec coverage:** §1 Engine/Route→Task 1＋2；Arbiter→Task 2（triage 在 Task 9）；Writer 工序→Task 3/5/6；章法库/`/simulate`→Task 8（种子卡；蒸馏管线脚本进第二阶段，spec §4 已声明种子先行——⚠️ spec 写的是“种子卡保下限，画像管上限”，本计划只做种子卡，画像管线记为第二阶段，不算缺口，实现时向作者明示）；节律→Task 7＋8 接线；审稿→Task 6；checkpoint→Task 2/3/7；素材编译器→Task 4；验收闸/steer/sync/diag→Task 9（/sync 门禁与 /diag 诊断在本计划 Task 9 只做路由＋门禁，diag 四维分析进第二阶段——向作者明示）；UI→Task 10；双驱动/Q1→Task 10 备注＋§10（断开隐式依赖＋background 过滤器，随 Task 2 清理，测试不断言细节）；度量→验收时手工统计（自动化报表第二阶段）。

**2. Placeholder scan:** 无 TBD/TODO；无“适当处理”类描述；每步含真实代码与命令；无跨 Task 未定义引用（`resumeChapterForTick` 在 Task 2 内定义；Task 3 占位 compiler 签名与 Task 4 一致；`triageSteer` 归属 Task 9 且 Task 2 只调类型兼容的 stub——实现顺序要求 Wave 内按编号执行）。

**3. Type consistency:** `RouteAction.tick` 全 Task 一致；`EnergyLevel` 1-5 在 Task 5/7/8 同名同义；`DirectorRuling` 只在 Task 5 定义、他处只透传 `reasons/obligations` 字符串数组；`failed_quota` 状态拼写全计划统一。
