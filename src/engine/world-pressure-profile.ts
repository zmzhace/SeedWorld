import type { WorldPressureProfileSnapshot, WorldSlice } from '@/domain/world'

type WorldPressureKind = 'resource_scarcity' | 'social_competition' | 'environmental_stress'
type PowerBasisKind = 'resource_control' | 'social_influence' | 'physical_force'
type DistributionPatternKind = 'gatekeeping' | 'open_access' | 'informal_exchange'
type LegitimacyBasisKind = 'tradition' | 'performance' | 'coercion'
type FaultLineKind = 'resource_access' | 'status_hierarchy' | 'territory'
type VolatileZoneKind = 'resource_site' | 'crowded_hub' | 'frontier'

type RankedSignal<T extends string> = {
  kind: T
  weight: number
  summary: string
  evidence: string[]
}

type WorldBiases = {
  scarcityBias: number
  statusRigidityBias: number
  gatedAccessBias: number
  violenceLegitimacyBias: number
  knowledgeControlBias: number
}

export function extractWorldBiases(description: string): WorldBiases {
  const normalized = description.toLowerCase()

  return {
    scarcityBias: /(scarce|shortage|ration|starvation)/.test(normalized) ? 1 : 0,
    statusRigidityBias: /(rigid|hierarchy|rank|caste|noble)/.test(normalized) ? 1 : 0,
    gatedAccessBias: /(gate|permit|controlled|guarded)/.test(normalized) ? 1 : 0,
    violenceLegitimacyBias: /(martial|violent|duel|might)/.test(normalized) ? 1 : 0,
    knowledgeControlBias: /(secret|forbidden|hidden|restricted)/.test(normalized) ? 1 : 0,
  }
}

export function buildWorldPressureProfile(world: WorldSlice, input: { wave: number }): WorldPressureProfileSnapshot {
  const biases = extractWorldBiases(world.environment.description)
  const evidenceTrace: string[] = []
  const dominantPressures = rankPressuresFromResources(world, biases, evidenceTrace)
  const powerBasis = rankPowerBasis(world, biases, evidenceTrace)
  const distributionPattern = rankDistributionPattern(world, biases, evidenceTrace)

  return {
    generated_at_tick: world.tick,
    wave: input.wave,
    dominantPressures,
    powerBasis,
    distributionPattern,
    legitimacyBasis: rankLegitimacyBasis(world, biases, evidenceTrace),
    faultLines: rankFaultLines(world, biases, evidenceTrace),
    volatileZones: rankVolatileZones(world, biases, evidenceTrace),
    evidenceTrace,
  }
}

function rankPressuresFromResources(
  world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<WorldPressureKind>> {
  let scarcityWeight = biases.scarcityBias
  let socialCompetitionWeight = 0
  let environmentalStressWeight = 0

  for (const resource of Object.values(world.systems.resources?.resources ?? {})) {
    const shortage = clamp01(resource.scarcity)
    const concentration = clamp01(resource.value)
    const depletion = resource.max_amount > 0 ? clamp01(1 - resource.amount / resource.max_amount) : 0
    const evidence = [`resources:${resource.id}`]

    scarcityWeight += shortage * 0.7 + depletion * 0.2 + concentration * 0.1
    socialCompetitionWeight += concentration * 0.2
    environmentalStressWeight += depletion * 0.1

    evidenceTrace.push(
      `resources:${resource.id}:scarcity=${shortage.toFixed(2)}:value=${concentration.toFixed(2)}:location=${resource.location ?? 'unknown'}`,
    )
  }

  return sortRankedSignals<WorldPressureKind>([
    {
      kind: 'resource_scarcity',
      weight: scarcityWeight,
      summary: 'Scarce resources are shaping what matters most right now.',
      evidence: evidenceTrace.filter(item => item.startsWith('resources:')),
    },
    {
      kind: 'social_competition',
      weight: socialCompetitionWeight,
      summary: 'Competition over who can secure value is intensifying.',
      evidence: evidenceTrace.filter(item => item.startsWith('resources:')),
    },
    {
      kind: 'environmental_stress',
      weight: environmentalStressWeight,
      summary: 'Depletion is adding strain to the environment.',
      evidence: evidenceTrace.filter(item => item.startsWith('resources:')),
    },
  ])
}

function rankPowerBasis(
  world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<PowerBasisKind>> {
  const resources = Object.values(world.systems.resources?.resources ?? {})
  const resourceControlWeight = resources.reduce(
    (sum, resource) => sum + clamp01(resource.value) * 0.6 + clamp01(resource.scarcity) * 0.4,
    0,
  ) + biases.gatedAccessBias

  if (resourceControlWeight > 0) {
    evidenceTrace.push(`power:resource_control=${resourceControlWeight.toFixed(2)}`)
  }

  return sortRankedSignals<PowerBasisKind>([
    {
      kind: 'resource_control',
      weight: resourceControlWeight,
      summary: 'Control over scarce resources is converting most reliably into leverage.',
      evidence: evidenceTrace.filter(item => item.startsWith('resources:') || item.startsWith('power:')),
    },
    {
      kind: 'social_influence',
      weight: biases.statusRigidityBias * 0.5,
      summary: 'Standing and recognition still matter, but less than control of access.',
      evidence: [],
    },
    {
      kind: 'physical_force',
      weight: biases.violenceLegitimacyBias * 0.3,
      summary: 'Force is present as a potential basis of leverage.',
      evidence: [],
    },
  ])
}

function rankDistributionPattern(
  world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<DistributionPatternKind>> {
  const resources = Object.values(world.systems.resources?.resources ?? {})
  const gatedResources = resources.filter(
    resource => !!resource.location && clamp01(resource.value) + clamp01(resource.scarcity) >= 1.2,
  ).length
  const gatekeepingWeight = biases.gatedAccessBias + gatedResources * 0.4

  if (gatekeepingWeight > 0) {
    evidenceTrace.push(`distribution:gatekeeping=${gatekeepingWeight.toFixed(2)}`)
  }

  return sortRankedSignals<DistributionPatternKind>([
    {
      kind: 'gatekeeping',
      weight: gatekeepingWeight,
      summary: 'Access is concentrating around controllable chokepoints.',
      evidence: evidenceTrace.filter(item => item.startsWith('resources:') || item.startsWith('distribution:')),
    },
    {
      kind: 'open_access',
      weight: Math.max(0, resources.length * 0.2 - gatekeepingWeight),
      summary: 'Access remains comparatively open.',
      evidence: [],
    },
    {
      kind: 'informal_exchange',
      weight: resources.length * 0.1,
      summary: 'Informal exchange still provides some distribution path.',
      evidence: [],
    },
  ])
}

function rankLegitimacyBasis(
  _world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<LegitimacyBasisKind>> {
  const coercionWeight = biases.gatedAccessBias + biases.statusRigidityBias * 0.5

  if (coercionWeight > 0) {
    evidenceTrace.push(`legitimacy:coercion=${coercionWeight.toFixed(2)}`)
  }

  return sortRankedSignals<LegitimacyBasisKind>([
    {
      kind: 'coercion',
      weight: coercionWeight,
      summary: 'Control and exclusion are helping determine what claims hold.',
      evidence: evidenceTrace.filter(item => item.startsWith('legitimacy:')),
    },
    {
      kind: 'tradition',
      weight: biases.statusRigidityBias * 0.4,
      summary: 'Hierarchy and inherited order still shape legitimacy.',
      evidence: [],
    },
    {
      kind: 'performance',
      weight: biases.scarcityBias * 0.2,
      summary: 'Practical performance contributes some legitimacy under scarcity.',
      evidence: [],
    },
  ])
}

function rankFaultLines(
  world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<FaultLineKind>> {
  const resourceCount = Object.keys(world.systems.resources?.resources ?? {}).length
  const resourceAccessWeight = resourceCount * 0.2 + biases.scarcityBias

  if (resourceAccessWeight > 0) {
    evidenceTrace.push(`fault_line:resource_access=${resourceAccessWeight.toFixed(2)}`)
  }

  return sortRankedSignals<FaultLineKind>([
    {
      kind: 'resource_access',
      weight: resourceAccessWeight,
      summary: 'Access to critical resources is becoming a fracture point.',
      evidence: evidenceTrace.filter(item => item.startsWith('fault_line:') || item.startsWith('resources:')),
    },
    {
      kind: 'status_hierarchy',
      weight: biases.statusRigidityBias,
      summary: 'Hierarchy is creating a parallel social fault line.',
      evidence: [],
    },
    {
      kind: 'territory',
      weight: resourceCount * 0.05,
      summary: 'Place-based control adds a weaker territorial fracture.',
      evidence: [],
    },
  ])
}

function rankVolatileZones(
  world: WorldSlice,
  biases: WorldBiases,
  evidenceTrace: string[]
): Array<RankedSignal<VolatileZoneKind>> {
  const resourceSites = Object.values(world.systems.resources?.resources ?? {}).filter(resource => !!resource.location).length
  const resourceSiteWeight = resourceSites * 0.3 + biases.gatedAccessBias * 0.5

  if (resourceSiteWeight > 0) {
    evidenceTrace.push(`volatile_zone:resource_site=${resourceSiteWeight.toFixed(2)}`)
  }

  return sortRankedSignals<VolatileZoneKind>([
    {
      kind: 'resource_site',
      weight: resourceSiteWeight,
      summary: 'Resource sites are the most likely places to intensify.',
      evidence: evidenceTrace.filter(item => item.startsWith('volatile_zone:') || item.startsWith('resources:')),
    },
    {
      kind: 'crowded_hub',
      weight: biases.statusRigidityBias * 0.2,
      summary: 'Dense social hubs carry some escalation potential.',
      evidence: [],
    },
    {
      kind: 'frontier',
      weight: biases.scarcityBias * 0.1,
      summary: 'Peripheral areas remain somewhat volatile under scarcity.',
      evidence: [],
    },
  ])
}

function sortRankedSignals<T extends string>(items: Array<RankedSignal<T>>): Array<RankedSignal<T>> {
  return [...items].sort((left, right) => right.weight - left.weight || left.kind.localeCompare(right.kind))
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
