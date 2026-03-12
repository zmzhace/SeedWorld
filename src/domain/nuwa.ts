export type NuwaTraits = {
  openness: number
  stability: number
  attachment: number
  agency: number
  empathy: number
}

export type NuwaAgentConfig = {
  race: string
  gender: string
  goals: string[]
  genetics: Record<string, unknown>
  environment_signature: Record<string, unknown>
  traits: NuwaTraits
}

export const createNuwaConfig = (config: NuwaAgentConfig): NuwaAgentConfig => config
