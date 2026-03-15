import type { WorldSlice } from '@/domain/world'
import type { AgentPatch } from '@/domain/agents'
import { createAnthropicClient, getModel, streamText } from './anthropic'

/**
 * Story Director - world-driving agent that pushes storylines forward
 */

type StoryEvent = {
  type: 'macro' | 'environmental' | 'social'
  summary: string
  impact: {
    environment_change?: string
    social_pressure_added?: string
    narrative_shift?: string
    agent_goals_affected?: string[]
  }
  conflict: boolean
}

/**
 * Analyze current world state and generate storyline events
 */
export async function generateStorylineEvent(world: WorldSlice): Promise<AgentPatch> {
  const client = createAnthropicClient()

  const model = getModel()

  const genesisEvent = world.events.find(e => e.type === 'world_created')
  const genesisPayload = genesisEvent?.payload as any

  const recentEvents = world.events.slice(-10)
  const agentActions = recentEvents
    .filter(e => e.type !== 'tick' && e.type !== 'world_created')
    .map(e => e.payload?.summary || e.type)

  const agentGoals = world.agents.npcs.map(npc => ({
    name: npc.identity.name,
    goals: npc.goals,
  }))

  const systemPrompt = `You are the Story Director for this world. Your role is to observe the world state and create events that drive the narrative forward.

World context:
- Core narrative: ${genesisPayload?.narrative_seed || ''}
- Environment: ${world.environment.description}
- Current tick: ${world.tick}

Social context:
- Major events: ${world.social_context.macro_events.join(', ')}
- Dominant narratives: ${world.social_context.narratives.join(', ')}
- Social pressures: ${world.social_context.pressures.join(', ')}

Current agents and their goals:
${agentGoals.map(a => `- ${a.name}: ${a.goals.join(', ')}`).join('\n')}

Recent events:
${agentActions.join('\n')}

Based on the above, generate an event that drives the story forward. Requirements:
1. The event should relate to the world's core narrative
2. The event should affect agents' goals or behavior
3. The event can change the environment or social context
4. The event should create conflict or opportunity to advance the plot
5. Generate a major event every 5-10 ticks; otherwise smaller events or environmental changes
6. Generate all content in the same language as the world description above

Return JSON:
{
  "type": "macro" | "environmental" | "social",
  "summary": "Brief description of the event",
  "impact": {
    "environment_change": "How the environment changes (optional)",
    "social_pressure_added": "New social pressure (optional)",
    "narrative_shift": "How the narrative shifts (optional)",
    "agent_goals_affected": ["Names of affected agents"]
  },
  "conflict": true/false
}`

  try {
    const responseText = await streamText(client, {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    })

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        timeDelta: 0,
        events: [],
        rulesDelta: [],
        notes: ['No storyline event generated this tick'],
        meta: {},
      }
    }

    const storyEvent: StoryEvent = JSON.parse(jsonMatch[0])

    return {
      timeDelta: storyEvent.type === 'macro' ? 1 : 0,
      events: [
        {
          id: `director-${world.tick}`,
          kind: storyEvent.type === 'macro' ? 'macro' : 'micro',
          summary: storyEvent.summary,
          conflict: storyEvent.conflict,
        },
      ],
      rulesDelta: [],
      notes: [
        storyEvent.impact.environment_change || '',
        storyEvent.impact.social_pressure_added || '',
        storyEvent.impact.narrative_shift || '',
      ].filter(Boolean),
      meta: {
        impact: storyEvent.impact,
        type: storyEvent.type,
      },
    }
  } catch (error) {
    console.error('Story director error:', error)
    return {
      timeDelta: 0,
      events: [],
      rulesDelta: [],
      notes: ['Story director failed this tick'],
      meta: { error: (error as Error).message },
    }
  }
}

/**
 * Apply story director event impact to the world
 */
export function applyDirectorImpact(world: WorldSlice, patch: AgentPatch): WorldSlice {
  const impact = patch.meta?.impact as StoryEvent['impact'] | undefined
  if (!impact) return world

  let updatedWorld = { ...world }

  if (impact.environment_change) {
    updatedWorld = {
      ...updatedWorld,
      environment: {
        description: impact.environment_change,
      },
    }
  }

  if (impact.social_pressure_added) {
    updatedWorld = {
      ...updatedWorld,
      social_context: {
        ...updatedWorld.social_context,
        pressures: [
          ...updatedWorld.social_context.pressures,
          impact.social_pressure_added,
        ],
      },
    }
  }

  if (impact.narrative_shift) {
    updatedWorld = {
      ...updatedWorld,
      social_context: {
        ...updatedWorld.social_context,
        narratives: [
          ...updatedWorld.social_context.narratives,
          impact.narrative_shift,
        ],
      },
    }
  }

  return updatedWorld
}
