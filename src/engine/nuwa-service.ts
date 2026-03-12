import { generateNuwaAgent } from './nuwa-generator'

type NuwaServiceDeps = {
  emit: (event: { type: 'new_agent'; payload: unknown }) => void
}

export const createNuwaService = (deps: NuwaServiceDeps) => {
  return {
    createAgent: (input: { seed: string; environment: { region: string; social_state: string } }) => {
      const config = generateNuwaAgent(input)
      deps.emit({ type: 'new_agent', payload: config })
      return config
    },
  }
}
