export type SceneStatus = 'proposed' | 'active' | 'resolved' | 'abandoned'
export type StoryThreadStatus = 'dormant' | 'active' | 'escalating' | 'split' | 'merged' | 'resolved' | 'failed' | 'frozen'
export type ActorLifecycle = 'mentioned' | 'candidate' | 'active' | 'background' | 'dormant' | 'retired' | 'dead'
export type ChapterEventRole = 'core' | 'supporting' | 'reference'

export type Scene = {
  id: string
  worldId: string
  tick: number
  status: SceneStatus
  timeLabel: string
  locationEntityId?: string
  objective: string
  conflict: string
  entryCause?: string
  exitCondition?: string
  anchorEventIds: string[]
  createdAt: string
  updatedAt: string
}

export type StoryThread = {
  id: string
  worldId: string
  title: string
  kind: string
  status: StoryThreadStatus
  goal: string
  pressure: number
  ownerEntityIds: string[]
  parentThreadId?: string
  anchorEventIds: string[]
  lastAdvancedTick?: number
  createdAt: string
  updatedAt: string
}

export type ActorRuntime = {
  actorId: string
  worldId: string
  lifecycle: ActorLifecycle
  agencyScore: number
  locked: boolean
  currentSceneId?: string
  lastActiveTick?: number
  promotionReason?: string
  updatedAt: string
}

export type SceneParticipant = {
  sceneId: string
  actorId: string
  role?: string
  reason?: string
  joinedTick: number
  leftTick?: number
}
