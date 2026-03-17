import type { PersonalAgentState, WorldSlice } from '@/domain/world'

type PressureItem = {
  kind: string
  weight: number
  summary: string
  evidence: string[]
}

export type WorldPressureProfileSnapshot = {
  generated_at_tick: number
  wave: number
  dominantPressures: PressureItem[]
  powerBasis: PressureItem[]
  distributionPattern: PressureItem[]
  legitimacyBasis: PressureItem[]
  faultLines: PressureItem[]
  volatileZones: PressureItem[]
  evidenceTrace: string[]
}

export type AgentSituationItem = {
  kind: string
  weight: number
  summary: string
  evidence: string[]
}

export type AgentSituation = {
  needsPressure: AgentSituationItem[]
  dependencyPressure: AgentSituationItem[]
  statusPressure: AgentSituationItem[]
  obstruction: AgentSituationItem[]
  leverage: AgentSituationItem[]
  exposure: AgentSituationItem[]
  opportunityWindow: AgentSituationItem[]
  inactionCost: AgentSituationItem[]
  evidenceTrace: string[]
}

const MAX_ITEMS = 3

function selectTopSituationItems(situation: AgentSituation): AgentSituationItem[] {
  return rankItems([
    ...situation.needsPressure,
    ...situation.dependencyPressure,
    ...situation.statusPressure,
    ...situation.obstruction,
    ...situation.leverage,
    ...situation.exposure,
    ...situation.opportunityWindow,
    ...situation.inactionCost,
  ])
}

function impliesImperative(summary: string): boolean {
  return /\b(you should|you must|best move|obvious response|need to seize)\b/i.test(summary)
}

function impliesSinglePath(summary: string): boolean {
  return /\b(only one real path remains|only path|no alternative|must align|there is only one way)\b/i.test(summary)
}

function impliesUngroundedCertainty(summary: string): boolean {
  return /\b(everyone will permanently turn against you|will permanently|inevitably|certainly)\b/i.test(summary)
}

function assertOpenAffordance(item: AgentSituationItem) {
  if (item.evidence.length === 0) {
    throw new Error('Situation pressure requires evidence')
  }
  if (impliesImperative(item.summary) || impliesSinglePath(item.summary) || impliesUngroundedCertainty(item.summary)) {
    throw new Error('Situation pressure must preserve open affordances')
  }
}

function rankItems(items: AgentSituationItem[]): AgentSituationItem[] {
  return items
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_ITEMS)
}

function collectNeedItems(agent: PersonalAgentState, profile: WorldPressureProfileSnapshot): AgentSituationItem[] {
  const items: AgentSituationItem[] = []

  if (agent.vitals.energy <= 0.25) {
    items.push({
      kind: 'low_energy',
      weight: 1 - agent.vitals.energy,
      summary: 'Low energy makes immediate support and recovery more urgent.',
      evidence: [`vitals:energy:${agent.vitals.energy.toFixed(2)}`],
    })
  }

  for (const pressure of profile.dominantPressures) {
    if (pressure.kind === 'resource_scarcity') {
      items.push({
        kind: pressure.kind,
        weight: pressure.weight,
        summary: pressure.summary,
        evidence: pressure.evidence,
      })
    }
  }

  return rankItems(items)
}

function collectDependencyItems(
  agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  const items = profile.powerBasis
    .filter((item) => !agent.location || item.evidence.includes(`location:${agent.location}`))
    .map((item) => ({
      kind: item.kind,
      weight: item.weight,
      summary: item.summary,
      evidence: item.evidence,
    }))

  return rankItems(items)
}

function collectStatusItems(
  _agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  return rankItems(
    profile.legitimacyBasis.map((item) => ({
      kind: item.kind,
      weight: item.weight,
      summary: item.summary,
      evidence: item.evidence,
    })),
  )
}

function collectObstructionItems(
  _agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  return rankItems(
    profile.distributionPattern.map((item) => ({
      kind: item.kind,
      weight: item.weight,
      summary: item.summary,
      evidence: item.evidence,
    })),
  )
}

function collectLeverageItems(
  _agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  return rankItems(
    profile.powerBasis.map((item) => ({
      kind: item.kind,
      weight: Math.max(0, item.weight - 0.1),
      summary: item.summary,
      evidence: item.evidence,
    })),
  )
}

function collectExposureItems(
  _agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  return rankItems(
    profile.faultLines.map((item) => ({
      kind: item.kind,
      weight: item.weight,
      summary: item.summary,
      evidence: item.evidence,
    })),
  )
}

function collectOpportunityItems(
  _agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  return rankItems(
    profile.volatileZones.map((item) => ({
      kind: item.kind,
      weight: item.weight,
      summary: item.summary,
      evidence: item.evidence,
    })),
  )
}

function collectInactionItems(
  agent: PersonalAgentState,
  _world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituationItem[] {
  const items: AgentSituationItem[] = []

  if (agent.vitals.energy <= 0.25) {
    items.push({
      kind: 'depletion_risk',
      weight: 1 - agent.vitals.energy,
      summary: 'Doing nothing while depleted will worsen immediate vulnerability.',
      evidence: [`vitals:energy:${agent.vitals.energy.toFixed(2)}`],
    })
  }

  for (const pressure of profile.distributionPattern) {
    items.push({
      kind: `${pressure.kind}_inaction`,
      weight: pressure.weight,
      summary: `Delay increases the cost of acting under ${pressure.summary.toLowerCase()}.`,
      evidence: pressure.evidence,
    })
  }

  return rankItems(items)
}

export function compileAgentSituation(
  agent: PersonalAgentState,
  world: WorldSlice,
  profile: WorldPressureProfileSnapshot,
): AgentSituation {
  const evidenceTrace = Array.from(
    new Set([
      ...profile.evidenceTrace,
      ...profile.dominantPressures.flatMap((item) => item.evidence),
      ...profile.powerBasis.flatMap((item) => item.evidence),
      ...profile.distributionPattern.flatMap((item) => item.evidence),
    ]),
  ).slice(0, 12)

  return {
    needsPressure: collectNeedItems(agent, profile),
    dependencyPressure: collectDependencyItems(agent, world, profile),
    statusPressure: collectStatusItems(agent, world, profile),
    obstruction: collectObstructionItems(agent, world, profile),
    leverage: collectLeverageItems(agent, world, profile),
    exposure: collectExposureItems(agent, world, profile),
    opportunityWindow: collectOpportunityItems(agent, world, profile),
    inactionCost: collectInactionItems(agent, world, profile),
    evidenceTrace,
  }
}

export function renderSituationPressure(situation: AgentSituation): string[] {
  return selectTopSituationItems(situation)
    .filter((item) => {
      assertOpenAffordance(item)
      return true
    })
    .map((item) => item.summary)
}
