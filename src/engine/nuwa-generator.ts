import { createNuwaConfig, type NuwaAgentConfig, type NuwaTraits } from '@/domain/nuwa'

type NuwaEnvInput = {
  region: string
  social_state: string
}

type NuwaGenInput = {
  seed: string
  environment: NuwaEnvInput
}

const seedToNumber = (seed: string) =>
  seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const deriveTraits = (seed: string): NuwaTraits => {
  const base = seedToNumber(seed) % 100
  return {
    openness: clamp01((base % 10) / 10),
    stability: clamp01(((base + 2) % 10) / 10),
    attachment: clamp01(((base + 4) % 10) / 10),
    agency: clamp01(((base + 6) % 10) / 10),
    empathy: clamp01(((base + 8) % 10) / 10),
  }
}

export const generateNuwaAgent = ({ seed, environment }: NuwaGenInput): NuwaAgentConfig => {
  return createNuwaConfig({
    race: environment.region === 'mountain' ? 'highland' : 'coastal',
    gender: seedToNumber(seed) % 2 === 0 ? 'female' : 'male',
    goals: ['survival'],
    genetics: { seed },
    environment_signature: environment,
    traits: deriveTraits(seed),
  })
}
