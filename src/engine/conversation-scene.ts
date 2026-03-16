import type { PersonalAgentState, WorldSlice } from '../domain/world'
import type {
  ConversationTrigger,
  ConversationTriggerType,
  ConversationScene,
  ConversationRound,
  ConversationResult,
} from '../domain/conversation'
import { DramaticTensionSystem } from './dramatic-tension-system'
import { MemePropagationSystem } from './meme-propagation-system'
import { ReputationSystem } from './reputation-system'
import { generateConversationTurn } from '../server/llm/agent-decision-llm'

type PressureSignal = { type: ConversationTriggerType; score: number; description: string }

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

  // 3. Shared narrative role
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

  // 4. Meme carrying
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

  // 5. Reputation shift
  if (world.systems?.reputation) {
    try {
      const rs = new ReputationSystem()
      rs.fromSnapshot(world.systems.reputation)
      const repA = rs.getAllReputations().get(seedA)
      const repB = rs.getAllReputations().get(seedB)
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

  // 6. Resource competition
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

export type ConversationPair = {
  participants: [string, string]
  agents: [PersonalAgentState, PersonalAgentState]
  trigger: ConversationTrigger
}

export function selectConversationPairs(
  agents: PersonalAgentState[],
  world: WorldSlice,
  threshold: number,
): ConversationPair[] {
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
  candidates.sort((a, b) => b.trigger.pressure_score - a.trigger.pressure_score)

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

const MAX_ROUNDS = 6
const LEAVE_ACTIONS = ['leave', 'withdraw', 'walk_away', 'depart']

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
  const order = Math.random() < 0.5 ? [0, 1] : [1, 0]
  let pendingFinalTurn = false
  let finalTurnForAgent: number | null = null // which agent index gets the final turn

  for (let roundNum = 0; roundNum < MAX_ROUNDS; roundNum++) {
    for (const idx of order) {
      const agent = agents[idx]

      // If we're in final-turn mode but this isn't the agent who gets the final turn, skip
      if (pendingFinalTurn && idx !== finalTurnForAgent) {
        continue
      }

      const result = await generateConversationTurn(
        agent, world, scene.rounds,
        { type: trigger.type, description: trigger.description },
      )

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

      if (LEAVE_ACTIONS.includes(round.action.type.toLowerCase())) {
        scene.status = 'concluded'
        return makeConcludedResult(scene, accumulated_feedback)
      }

      // If this was the final turn, we're done
      if (pendingFinalTurn && idx === finalTurnForAgent) {
        scene.status = 'concluded'
        return makeConcludedResult(scene, accumulated_feedback)
      }

      // Agent signals they want to stop — give the OTHER agent one final turn
      if (!round.continue_conversation) {
        pendingFinalTurn = true
        finalTurnForAgent = order.find(i => i !== idx)!
      }
    }
  }

  scene.status = 'concluded'
  return makeConcludedResult(scene, accumulated_feedback)
}

function makeConcludedResult(
  scene: ConversationScene,
  accumulated_feedback: ConversationResult['accumulated_feedback'],
): ConversationResult {
  const speakers = [...new Set(scene.rounds.map(r => r.speaker))]
  const tone = scene.trigger.type === 'tension' ? 'tensely'
    : scene.trigger.type === 'relationship' ? 'intensely'
    : 'earnestly'

  const bystander_summary = scene.rounds.length > 0
    ? `${speakers.join(' and ')} spoke ${tone} about ${scene.trigger.description.toLowerCase()}`
    : `${speakers.join(' and ')} had a brief encounter`

  return { scene, bystander_summary, accumulated_feedback }
}
