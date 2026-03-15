import { createAgentRegistry } from '../engine/agent-registry'
import type { DirectorAgent } from '../domain/agents'
import { storylineDirector } from './storyline-agent'

const registry = createAgentRegistry()

// Register story director agent
registry.register(storylineDirector)

export const registerDirectorAgent = (agent: DirectorAgent) => {
  registry.register(agent)
}

export const getDirectorRegistry = () => registry
