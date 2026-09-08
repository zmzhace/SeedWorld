export type GraphLayer = 'source' | 'evolution'
export type ClaimScope = 'objective' | 'public_narrative' | 'character_belief'
export type ImportStatus = 'queued' | 'parsing' | 'ontology' | 'submitting' | 'processing' | 'syncing' | 'completed' | 'failed' | 'rolled_back'

export type OntologyField = {
  name: string
  type: 'text' | 'integer' | 'float' | 'boolean'
  description: string
}

export type OntologyEntityType = {
  name: string
  displayName: string
  description: string
  fields: OntologyField[]
  actionable?: boolean
}

export type OntologyRelationType = {
  name: string
  displayName: string
  description: string
  sourceTargets: Array<{ source: string; target: string }>
  fields: OntologyField[]
}

export type WorldOntology = {
  id: string
  worldId: string
  version: number
  entityTypes: OntologyEntityType[]
  relationTypes: OntologyRelationType[]
  rationale: string
  createdAt: string
}

export type GraphProvenance = {
  sourceId?: string
  chunkId?: string
  episodeId?: string
  importId?: string
  model?: string
  excerpt?: string
}

export type GraphEntity = {
  id: string
  worldId: string
  graphLayer: GraphLayer
  externalId?: string
  type: string
  name: string
  aliases: string[]
  properties: Record<string, unknown>
  status: 'active' | 'inactive' | 'deleted'
  actionable: boolean
  provenance: GraphProvenance
  createdAt: string
  updatedAt: string
}

export type GraphFact = {
  id: string
  worldId: string
  graphLayer: GraphLayer
  externalId?: string
  subjectId: string
  predicate: string
  objectId?: string
  value?: unknown
  scope: ClaimScope
  believerId?: string
  validFrom?: string
  validUntil?: string
  confidence: number
  provenance: GraphProvenance
  createdAt: string
}

export type VisibilityRule = {
  id: string
  worldId: string
  targetKind: 'entity' | 'fact'
  targetId: string
  effect: 'allow' | 'deny'
  subjectKind: 'everyone' | 'agent' | 'faction' | 'condition'
  subjectId?: string
  condition?: Record<string, unknown>
  priority: number
}

export type WorldRule = {
  id: string
  worldId: string
  name: string
  description: string
  condition: Record<string, unknown>
  effect: Record<string, unknown>
  priority: number
  scope: Record<string, unknown>
  enabled: boolean
}

export type WritingSettings = {
  genre: string
  audience: string
  language: string
  narration: 'first_person' | 'third_limited' | 'third_omniscient'
  defaultPov?: string
  targetWords: number
  pacing: 'slow' | 'balanced' | 'fast'
  rating: string
  forbiddenContent: string[]
  chapterMode: 'manual' | 'automatic'
}

export const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  genre: '',
  audience: '',
  language: 'zh',
  narration: 'third_limited',
  targetWords: 2500,
  pacing: 'balanced',
  rating: 'general',
  forbiddenContent: [],
  chapterMode: 'manual',
}

export type ImportJob = {
  id: string
  worldId: string
  importId: string
  status: ImportStatus
  stage: string
  progress: number
  message: string
  error?: string
  remoteBatchId?: string
  createdAt: string
  updatedAt: string
}
