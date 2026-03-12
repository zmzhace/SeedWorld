import { createAgentRegistry } from '../engine/agent-registry'
import type { PanguAgent } from '../domain/agents'

const registry = createAgentRegistry()

export const registerPanguAgent = (agent: PanguAgent) => {
  registry.register(agent)
}

export const getPanguRegistry = () => registry
