import type { PanguAgent, AgentPatch } from '../domain/agents'

type AgentResult = {
  agentId: string
  patch?: AgentPatch
  error?: string
}

export const createAgentRegistry = () => {
  const agents = new Map<string, PanguAgent>()

  return {
    register: (agent: PanguAgent) => {
      if (!agent.id || !agent.run) throw new Error('invalid agent')
      agents.set(agent.id, agent)
    },
    list: () => Array.from(agents.values()),
    runAll: async (world: unknown): Promise<AgentResult[]> => {
      const tasks = Array.from(agents.values()).map(async (agent) => {
        try {
          const patch = await agent.run(world)
          return { agentId: agent.id, patch }
        } catch (error) {
          return { agentId: agent.id, error: (error as Error).message }
        }
      })
      return Promise.all(tasks)
    },
  }
}
