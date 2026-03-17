import type { SituationSnapshot, WorldSlice } from '../domain/world'
import type { KnowledgeEdge, KnowledgeGraph } from './knowledge-graph'
import type { Meme } from './meme-propagation-system'
import type { Reputation } from './reputation-system'
import type { Resource } from './resource-competition-system'
import type { DramaticTension } from './dramatic-tension-system'

export type SituationConsequenceKind =
  | 'access_shift'
  | 'scarcity_shift'
  | 'distribution_shift'
  | 'legitimacy_shift'
  | 'status_shift'
  | 'dismissibility_shift'
  | 'influence_shift'
  | 'hotspot_shift'
  | 'escalation_shift'
  | 'norm_shift'
  | 'belief_shift'
  | 'expectation_shift'
  | 'dependency_shift'
  | 'alignment_shift'
  | 'challenge_shift'
  | 'blocked_by_shift'

export type SituationConsequence = {
  kind: SituationConsequenceKind
  summary: string
  strength: number
  sourceAgentId?: string
  targetAgentId?: string
  resourceId?: string
  targetLocation?: string
}

export type RoutedSituationConsequences = {
  resources: SituationConsequence[]
  reputation: SituationConsequence[]
  tension: SituationConsequence[]
  memes: SituationConsequence[]
  graph: SituationConsequence[]
}

const RESOURCE_KINDS: SituationConsequenceKind[] = ['access_shift', 'scarcity_shift', 'distribution_shift']
const REPUTATION_KINDS: SituationConsequenceKind[] = [
  'legitimacy_shift',
  'status_shift',
  'dismissibility_shift',
  'influence_shift',
]
const TENSION_KINDS: SituationConsequenceKind[] = ['hotspot_shift', 'escalation_shift']
const MEME_KINDS: SituationConsequenceKind[] = ['norm_shift', 'belief_shift', 'expectation_shift']
const GRAPH_KINDS: SituationConsequenceKind[] = [
  'dependency_shift',
  'alignment_shift',
  'challenge_shift',
  'blocked_by_shift',
]

export function routeSituationConsequences(
  consequences: SituationConsequence[],
): RoutedSituationConsequences {
  return {
    resources: consequences.filter((item) => RESOURCE_KINDS.includes(item.kind)),
    reputation: consequences.filter((item) => REPUTATION_KINDS.includes(item.kind)),
    tension: consequences.filter((item) => TENSION_KINDS.includes(item.kind)),
    memes: consequences.filter((item) => MEME_KINDS.includes(item.kind)),
    graph: consequences.filter((item) => GRAPH_KINDS.includes(item.kind)),
  }
}

export function applySituationConsequences(input: {
  world: WorldSlice
  consequences: SituationConsequence[]
  knowledgeGraph?: KnowledgeGraph
}): RoutedSituationConsequences {
  const routed = routeSituationConsequences(input.consequences)

  applyResourceConsequences(input.world, routed.resources)
  applyReputationConsequences(input.world, routed.reputation)
  applyTensionConsequences(input.world, routed.tension)
  applyMemeConsequences(input.world, routed.memes)
  applyGraphConsequences(input.world, routed.graph, input.knowledgeGraph)

  return routed
}

export function deriveSituationSnapshot(input: {
  tick: number
  wave: number
  consequences: SituationConsequence[]
}): SituationSnapshot {
  const summaryByAgent: Record<string, string[]> = {}

  for (const consequence of input.consequences) {
    const participants = new Set(
      [consequence.sourceAgentId, consequence.targetAgentId].filter(
        (agentId): agentId is string => Boolean(agentId),
      ),
    )

    for (const agentId of participants) {
      summaryByAgent[agentId] ??= []
      summaryByAgent[agentId].push(consequence.summary)
    }
  }

  return {
    generated_at_tick: input.tick,
    wave: input.wave,
    summaryByAgent,
  }
}

function applyResourceConsequences(world: WorldSlice, consequences: SituationConsequence[]): void {
  if (consequences.length === 0) return

  const resources = world.systems.resources?.resources
  if (!resources) return

  for (const consequence of consequences) {
    const resourceId = consequence.resourceId
    if (!resourceId) continue

    const resource = resources[resourceId] as (Resource & {
      kind?: string
      owners?: string[]
      competitors?: string[]
      regen_rate?: number
      properties?: Record<string, unknown>
    }) | undefined

    if (!resource) continue

    if (consequence.kind === 'access_shift' && consequence.sourceAgentId) {
      resource.owners = uniqueList([consequence.sourceAgentId, ...(resource.owners ?? [])])
    }

    if (consequence.kind === 'distribution_shift' && consequence.targetLocation) {
      resource.location = consequence.targetLocation
    }

    if (consequence.kind === 'scarcity_shift') {
      resource.scarcity = clamp01(Math.max(resource.scarcity, consequence.strength))
    }
  }
}

function applyReputationConsequences(world: WorldSlice, consequences: SituationConsequence[]): void {
  if (consequences.length === 0) return

  const reputations = world.systems.reputation?.reputations
  if (!reputations) return

  for (const consequence of consequences) {
    const agentId = consequence.sourceAgentId ?? consequence.targetAgentId
    if (!agentId) continue

    const reputation = reputations[agentId] as Reputation | undefined
    if (!reputation) continue

    switch (consequence.kind) {
      case 'legitimacy_shift':
        reputation.trustworthiness = clamp01(reputation.trustworthiness + consequence.strength * 0.1)
        break
      case 'status_shift':
        reputation.status = clamp01(reputation.status + consequence.strength * 0.1)
        break
      case 'dismissibility_shift':
        reputation.status = clamp01(reputation.status - consequence.strength * 0.1)
        break
      case 'influence_shift':
        reputation.influence = clamp01(reputation.influence + consequence.strength * 0.1)
        break
    }
  }
}

function applyTensionConsequences(world: WorldSlice, consequences: SituationConsequence[]): void {
  if (consequences.length === 0) return

  const tensions = world.systems.tension?.tensions
  if (!tensions) return

  const tick = world.tick

  for (const consequence of consequences) {
    const id = `situation-${consequence.kind}-${consequence.sourceAgentId ?? 'world'}-${consequence.targetAgentId ?? consequence.targetLocation ?? 'world'}`
    const existing = tensions[id] as DramaticTension | undefined

    if (existing) {
      existing.level = clamp01(Math.max(existing.level, consequence.strength))
      existing.updated_at = tick as never
      continue
    }

    tensions[id] = {
      id,
      type: consequence.kind === 'hotspot_shift' ? 'conflict' : 'suspense',
      level: clamp01(consequence.strength),
      source: consequence.summary,
      target_agents: uniqueList([
        consequence.sourceAgentId,
        consequence.targetAgentId,
      ].filter((value): value is string => Boolean(value))),
      buildup_rate: 0.05,
      release_condition: 'Situation changes',
      created_at: tick,
      status: 'building',
    }
  }
}

function applyMemeConsequences(world: WorldSlice, consequences: SituationConsequence[]): void {
  if (consequences.length === 0) return

  const memes = world.systems.memes?.memes
  if (!memes) return

  for (const consequence of consequences) {
    const id = `situation-${consequence.kind}-${Object.keys(memes).length}`
    const carrier = consequence.sourceAgentId ?? consequence.targetAgentId
    memes[id] = {
      id,
      content: consequence.summary,
      category: consequence.kind === 'norm_shift' ? 'behavior' : consequence.kind === 'belief_shift' ? 'belief' : 'value',
      contagiousness: clamp01(0.4 + consequence.strength * 0.4),
      fidelity: 0.8,
      longevity: 12,
      fitness: clamp01(0.4 + consequence.strength * 0.4),
      carriers: carrier ? [carrier] : [],
      mutations: [],
      origin: carrier ?? 'world',
      created_at: world.tick,
      spread_count: 0,
    } satisfies Meme
  }
}

function applyGraphConsequences(
  world: WorldSlice,
  consequences: SituationConsequence[],
  knowledgeGraph?: KnowledgeGraph,
): void {
  if (consequences.length === 0) return

  const graph = knowledgeGraph
  if (!graph) return

  for (const consequence of consequences) {
    if (!consequence.sourceAgentId || !consequence.targetAgentId) continue

    const edgeId = `situation-${consequence.kind}-${consequence.sourceAgentId}-${consequence.targetAgentId}`
    const existing = graph.getEdge(edgeId)

    if (existing) {
      graph.updateEdge(
        edgeId,
        {
          weight: clamp01(Math.max(existing.weight, consequence.strength)),
          properties: {
            kind: consequence.kind,
            summary: consequence.summary,
          },
        },
        world.tick,
      )
      continue
    }

    graph.addEdge({
      id: edgeId,
      source: consequence.sourceAgentId,
      target: consequence.targetAgentId,
      relation: 'related_to',
      weight: clamp01(consequence.strength),
      properties: {
        kind: consequence.kind,
        summary: consequence.summary,
      },
      created_at: world.tick,
      updated_at: world.tick,
    })
  }
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
