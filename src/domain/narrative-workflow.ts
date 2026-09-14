export type FoundationStatus = 'draft' | 'confirmed' | 'needs_revision'
export type TickStatus = 'planning' | 'simulating' | 'awaiting_chapter' | 'reviewing' | 'blocked' | 'published'
export type HookType = 'crisis' | 'mystery' | 'desire' | 'emotion' | 'choice'
export type NarrativePurpose =
  | 'advance_mainline'
  | 'plant_foreshadow'
  | 'strengthen_foreshadow'
  | 'resolve_foreshadow'
  | 'answer_question'
  | 'change_relationship'
  | 'change_goal_or_belief'
  | 'show_consequence'
  | 'build_pressure'

export type BookFoundation = {
  id: string
  worldId: string
  version: number
  status: FoundationStatus
  corePromise: string
  centralConflict: string
  thematicQuestion: string
  protagonistPressure: string
  requiredLongTermQuestions: NarrativeQuestion[]
  /** Legacy ending fields are migrated into FutureTrajectory records. */
  endingTruth?: string
  finalChoice?: string
  characterEndings?: string[]
  immutableRules: string[]
  keyTurns?: string[]
  requiredForeshadows?: string[]
  forbiddenEndings?: string[]
  forbiddenDirections: string[]
  forbiddenContent: string[]
  audiencePromise: string
  createdAt: string
  confirmedAt?: string
}

export type NarrativeQuestion = {
  id: string
  question: string
  status: 'open' | 'planted' | 'noticed' | 'investigating' | 'partially_answered' | 'reframed' | 'answered' | 'paid_off' | 'abandoned'
  answerEventIds: string[]
  importance?: 'core' | 'arc' | 'local'
  lastAdvancedAtChapter?: number
  supportingClaimIds?: string[]
  contradictionClaimIds?: string[]
  promisedPayoff?: string
  dueArcId?: string
  parentQuestionId?: string
}

export type StoryEngineStatus = 'draft' | 'confirmed' | 'stale'
export type StoryEngine = {
  id: string
  worldId: string
  version: number
  foundationVersion: number
  status: StoryEngineStatus
  signatureExperience: string
  dramaticQuestion: string
  repeatableSituation: string
  protagonistMethod: string
  oppositionSources: string[]
  scarceResources: string[]
  failureCosts: string[]
  progressionRewards: string[]
  variationAxes: string[]
  escalationAxes: string[]
  resetMechanisms: string[]
  exhaustionSignals: string[]
  emotionalPromise: string
  forbiddenRepetitions: string[]
  evidenceClaimIds: string[]
  createdAt: string
  confirmedAt?: string
}

export type CharacterDecisionSignature = {
  id: string
  worldId: string
  actorId: string
  version: number
  protectedValue: string
  usualMethod: string
  fearedCost: string
  moralBoundary: string
  pressureFailureMode: string
  internalContradiction: string
  supportingEventIds: string[]
  contradictingEventIds: string[]
  authorLocked: boolean
  createdAt: string
}

export type StoryPressure = {
  id: string
  description: string
  sourceEventIds: string[]
  intensity: number
}

export type NarrativePhase = 'exploration' | 'development' | 'convergence' | 'finale'

export type NarrativeHorizon = {
  id: string
  worldId: string
  version: number
  currentVolumeId?: string
  currentArcId?: string
  phase: NarrativePhase
  stablePromises: string[]
  currentPressures: StoryPressure[]
  openQuestions: NarrativeQuestion[]
  activeObligationIds: string[]
  trajectoryIds: string[]
  ruledOutTrajectoryIds: string[]
  lastEvaluatedChapter: number
  createdAt: string
}

export type FutureTrajectory = {
  id: string
  worldId: string
  horizonVersion: number
  title: string
  premise: string
  possibleResolution: string
  requiredConditionIds: string[]
  supportingEventIds: string[]
  contradictingEventIds: string[]
  requiredObligationIds: string[]
  thematicAnswer: string
  characterConsequences: string[]
  viability: 'possible' | 'supported' | 'endangered' | 'ruled_out'
  confidence: number
  createdAt: string
  lastEvaluatedAt: string
}

export type StateDomain = 'claim' | 'knowledge' | 'actor' | 'relationship' | 'location' | 'story_thread' | 'obligation'
export type StateOperator = 'eq' | 'neq' | 'exists' | 'not_exists' | 'gte' | 'lte' | 'contains'
export type StateCondition = {
  id: string
  subjectId: string
  domain: StateDomain
  predicate: string
  operator: StateOperator
  value: unknown
}

export type StateDeltaOperation =
  | 'assert_claim' | 'expire_claim' | 'grant_knowledge' | 'change_actor_state'
  | 'change_relationship' | 'change_location_state' | 'advance_story_thread' | 'advance_obligation'

export type RequiredStateDelta = {
  id: string
  operation: StateDeltaOperation
  subjectId: string
  before: StateCondition[]
  after: Record<string, unknown>
  sourceEventIds: string[]
  evidenceBeatIds: string[]
  narrativeReason: string
  reversible: boolean
}

export type ChapterRelevance =
  | { mode: 'advance'; targetArcConditionIds: string[] }
  | { mode: 'prepare'; futureArcConditionIds: string[]; createdAssetIds: string[]; payoffWindow: { earliestChapter: number; latestChapter: number } }
  | { mode: 'consequence'; sourceEventIds: string[]; irreversibleDeltaIds: string[] }

export type VolumePlan = {
  id: string
  worldId: string
  ordinal: number
  title: string
  goal: string
  centralQuestion?: string
  stageGoal?: string
  pressureChange?: string
  expectedCost?: string
  entryConditionIds?: string[]
  completionConditionIds?: string[]
  forbiddenResolutionIds?: string[]
  requiredArcFunctions?: string[]
  trajectoryEvaluationIds?: string[]
  conflict: string
  cost: string
  endingTurn: string
  status: 'planned' | 'active' | 'reviewing' | 'completed'
}

export type StoryArcPlan = {
  id: string
  worldId: string
  volumeId: string
  ordinal: number
  title: string
  goal: string
  objective?: string
  centralConflict?: string
  resistance: string
  escalation: string
  turn: string
  result: string
  cost: string
  startConditionIds?: string[]
  completionConditionIds?: string[]
  failureConditionIds?: string[]
  forbiddenConditionIds?: string[]
  requiredConflictModes?: string[]
  obligationIds?: string[]
  status: 'planned' | 'active' | 'reviewing' | 'completed' | 'failed' | 'blocked'
  localSettlement?: string
  longTailResidue?: string
  requiredQuestionIds?: string[]
  allowedEscalationAxes?: string[]
  usedConflictPatterns?: string[]
  engineVersion?: number
}

export type ChapterOutline = {
  id: string
  worldId: string
  arcId: string
  ordinal: number
  goal: string
  conflict: string
  requiredChange: string
  stateBefore?: StateCondition[]
  mainlineObjective?: string
  coreConflict?: string
  relevance?: ChapterRelevance
  requiredDeltas?: RequiredStateDelta[]
  forbiddenDeltas?: StateCondition[]
  causalPrerequisiteEventIds?: string[]
  narrativePurpose: NarrativePurpose
  hookType: HookType
  hookGoal: string
  /** The previous result that makes this chapter necessary. */
  causalPrerequisite?: string
  /** How this chapter moves toward or prepares the confirmed ending. */
  globalRelevance?: string
  /** The answer, success, reversal or emotional return delivered in this chapter. */
  readerPayoff?: string
  /** Truths and future turns that this chapter must not reveal or complete yet. */
  scopeBoundary?: string
  /** Concrete loss to the book if this chapter is deleted. */
  deletionLoss?: string
  /** Planning metadata used to keep early chapters readable and chronological. */
  timeWindow?: string
  conflictMode?: string
  newConcepts?: string[]
  allowedNewConceptIds?: string[]
  povCandidateIds?: string[]
  obligationIds?: string[]
  horizonVersion?: number
  maxNamedCharacters?: number
  status: 'planned' | 'active' | 'completed' | 'blocked' | 'stale'
  inheritedConsequenceEventIds?: string[]
  immediateGoal?: string
  centralObstacle?: string
  difficultChoice?: string
  irreversibleResult?: string
  concretePayoff?: string
  changedUnderstanding?: string
  nextPressure?: string
  advancedQuestionIds?: string[]
  answeredQuestionIds?: string[]
  createdQuestionIds?: string[]
  engineFunction?: string
}

export type ParticipantReason = {
  actorId: string
  reason: string
  goal: string
  risk: string
  /** What this person uniquely changes in this chapter. */
  sceneFunction?: string
  /** What breaks if this person is removed from the chapter. */
  necessity?: string
}

/** A character's constrained choice. It is planning data, not prose. */
export type AgentIntent = {
  id: string
  worldId: string
  tick: number
  actorId: string
  perceivedSituation: string
  immediateGoal: string
  goalId?: string
  intendedAction: string
  reason: string
  expectedResult: string
  acceptableCost: string
  hardBoundary: string
  knownClaimIds: string[]
  anchorEventIds?: string[]
  relationshipStateIds?: string[]
  applicableRuleIds?: string[]
  contributionDeltaIds?: string[]
  targetActorIds: string[]
  status: 'proposed' | 'accepted' | 'rejected'
}

/** Ordered dramatic causality produced by the scene director. */
export type SceneBeat = {
  id: string
  worldId: string
  tick: number
  ordinal: number
  dependsOnBeatIds?: string[]
  trigger: string
  actorId: string
  action: string
  targetActorIds: string[]
  reaction: string
  changedOption: string
  consequence: string
  claimIds: string[]
  worldRuleIds: string[]
  consumesConditions?: StateCondition[]
  producesDeltaIds?: string[]
  evidenceClaimIds?: string[]
}

export type SceneProposal = {
  id: string
  worldId: string
  tick: number
  premise: string
  causalAnchors: string[]
  beats: SceneBeat[]
  stateAfterEvidence: string[]
  readerPayoff: string
  hookResult: string
  risks: string[]
  status: 'proposed' | 'selected' | 'rejected'
}

export type WritersRoomIssue = {
  severity: 'critical' | 'error' | 'warning'
  category: string
  evidence: string
  violatedConstraint: string
  repairDirection: string
}

export type WritersRoomOpinion = {
  id: string
  sessionId: string
  round: number
  role: string
  actorId?: string
  proposalId: string
  verdict: 'support' | 'revise' | 'reject'
  issues: WritersRoomIssue[]
}

export type WritersRoomResolution = {
  selectedProposalId: string
  resolvedIssueIds: string[]
  unresolvedIssueIds: string[]
  finalBeats: SceneBeat[]
  stateAfterEvidence: string[]
}

export type NarrativeReference = {
  entityId: string
  purpose: string
}

export type EvolutionContract = {
  id: string
  worldId: string
  tick: number
  volumeId?: string
  arcId?: string
  chapterOutlineId?: string
  status: 'draft' | 'active' | 'fulfilled' | 'blocked'
  /** Approved outline objective. Simulation may choose the route, not replace it. */
  mainlineObjective?: string
  causalPrerequisite?: string
  globalRelevance?: string
  readerPayoff?: string
  scopeBoundary?: string
  coreEvent: string
  povEntityId?: string
  sceneId?: string
  participants: ParticipantReason[]
  /** Off-stage names that may be mentioned. They are not scene participants. */
  referenceEntities?: NarrativeReference[]
  /** The reader-facing entry strategy, especially important for an opening chapter. */
  readerEntry?: {
    chapterNumber: number
    knownAtOpening: string[]
    allowedNewConcepts: string[]
    withheldInformation: string[]
  }
  requiredStateChanges: string[]
  stateBefore?: StateCondition[]
  requiredDeltas?: RequiredStateDelta[]
  forbiddenDeltas?: StateCondition[]
  relevance?: ChapterRelevance
  horizonVersion?: number
  foreshadowActions: string[]
  allowedAnswers: string[]
  forbiddenMoves: string[]
  emotionTarget: string
  climaxForm: string
  hookType: HookType
  hookGoal: string
  requiredBeats: string[]
  continuityChecks: string[]
  evaluationFocus: string[]
  causalAnchorEventIds: string[]
  narrativePurpose: NarrativePurpose
  createdAt: string
}

export type MainlineHealthReport = {
  id: string
  worldId: string
  tick: number
  healthy: boolean
  arcProgress: { completedConditionIds: string[]; missingConditionIds: string[]; blockedConditionIds: string[] }
  volumeProgress: { completedConditionIds: string[]; unresolvedConditionIds: string[] }
  promiseHealth: Array<{ promiseId: string; status: 'active' | 'neglected' | 'contradicted' | 'fulfilled'; evidenceIds: string[] }>
  trajectoryHealth: Array<{ trajectoryId: string; viability: FutureTrajectory['viability']; evidenceIds: string[] }>
  overdueObligationIds: string[]
  orphanThreadIds: string[]
  contradictions: string[]
  createdAt: string
}

export type PendingTransition = {
  id: string
  worldId: string
  tick: number
  contractId: string
  baseStateHash: string
  beatIds: string[]
  deltas: RequiredStateDelta[]
  mainlineHealthReportId: string
  validationReport: Record<string, unknown>
  status: 'proposed' | 'validated' | 'publishing' | 'published' | 'discarded'
  createdAt: string
  updatedAt: string
}

export type FinaleContract = {
  id: string
  worldId: string
  horizonVersion: number
  selectedTrajectoryId: string
  endingTruth: string
  finalChoice: string
  requiredMilestones: Array<{ id: string; description: string; prerequisiteConditionIds: string[] }>
  requiredPayoffs: string[]
  prohibitedShortcuts: string[]
  unresolvedThreads: string[]
  status: 'draft' | 'active' | 'completed'
}

export type ReviewSeverity = 'critical' | 'error' | 'warning'
export type ReviewDimensionKey =
  | 'world_consistency'
  | 'character_consistency'
  | 'pacing_density'
  | 'causal_coherence'
  | 'foreshadow_health'
  | 'hook_quality'
  | 'aesthetic_quality'

export type ReviewDimension = { key: ReviewDimensionKey; score: number; evidence: string }
export type ReviewIssue = { severity: ReviewSeverity; quote: string; contractField: string; message: string; instruction: string }
export type ChapterReview = {
  id: string
  worldId: string
  chapterId?: string
  runId: string
  revision: number
  dimensions: ReviewDimension[]
  issues: ReviewIssue[]
  deletionTestPassed: boolean
  deletionLoss: string
  averageScore: number
  passed: boolean
  createdAt: string
}

export type ReaderComprehensionReview = {
  id: string
  worldId: string
  runId: string
  pov: string
  immediateGoal: string
  obstacle: string
  choice: string
  consequence: string
  localPayoff: string
  reasonToContinue: string
  unexplainedNames: string[]
  unexplainedConcepts: string[]
  unsupportedConclusions: string[]
  passed: boolean
  createdAt: string
}
