import { NextResponse } from 'next/server'
import { generateInitialWorld } from '@/server/llm/world-generator'
import { generatePersonalAgents } from '@/server/llm/agent-generator'
import { createAnthropicClient, getModel, streamText } from '@/server/llm/anthropic'

/**
 * Full world initialization flow (emergent):
 * 1. Generate initial world state
 * 2. Create initial agents
 * 3. Generate opening narration (tick 0 prologue)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const worldPrompt = String(body?.worldPrompt ?? '')
    const worldId = String(body?.worldId ?? '')

    if (!worldPrompt.trim()) {
      return NextResponse.json(
        { error: 'worldPrompt is required' },
        { status: 400 }
      )
    }

    console.log('=== World initialization (emergent) ===')
    console.log('1. Generating world...')

    // 1. Generate world
    const world = await generateInitialWorld({ worldPrompt })
    if (worldId) {
      world.world_id = worldId
    }

    console.log('✓ World generated')
    console.log('2. Creating agents...')

    // 2. Create agents via LLM (3 agents for Vercel 10s timeout limit)
    const agentCount = 3
    console.log(`Generating ${agentCount} agents in batches...`)
    const newAgents = await generatePersonalAgents({
      prompt: `${world.environment.description}\n\nSocial context: ${JSON.stringify(world.social_context)}`,
      count: agentCount,
    })

    console.log(`✓ Created ${newAgents.length} agents`)

    world.agents.npcs = newAgents

    world.events.push({
      id: `init-complete-${Date.now()}`,
      type: 'world_initialized',
      timestamp: new Date().toISOString(),
      payload: {
        agent_count: newAgents.length,
        agent_names: newAgents.map(a => a.identity.name),
        initialization_type: 'emergent',
      },
    })

    // 3. Skip prologue generation to stay within Vercel timeout
    console.log('3. Skipping prologue generation (Vercel timeout limit)')
    world.tick_summary = `${world.environment.description}\n\n${newAgents.length} agents have entered this world.`

    console.log('=== World initialization complete ===')

    return NextResponse.json({
      success: true,
      world,
      summary: {
        agents_count: newAgents.length,
        agent_names: newAgents.map(a => a.identity.name),
        initialization_type: 'emergent',
        message: 'World created. Agents will interact freely and stories will emerge.',
      },
    })
  } catch (error) {
    console.error('Failed to initialize world:', error)
    return NextResponse.json(
      { error: 'Failed to initialize world: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * Generate a prologue narration introducing the world, its characters, and the undercurrents.
 */
async function generatePrologue(world: typeof import('@/domain/world').createInitialWorldSlice extends () => infer R ? R : never): Promise<string> {
  const client = createAnthropicClient()
  const model = getModel()

  const agents = world.agents.npcs
  const castList = agents.map((a: any) => {
    const relDescriptions = Object.entries(a.relations || {})
      .slice(0, 3)
      .map(([targetSeed, value]) => {
        const target = agents.find((t: any) => t.genetics.seed === targetSeed)
        if (!target) return null
        const label = (value as number) > 0.3 ? 'ally' : (value as number) < -0.3 ? 'rival' : 'acquaintance'
        return `${label} of ${(target as any).identity.name}`
      })
      .filter(Boolean)
    return `- ${a.identity.name} (${a.occupation || 'unknown'}): ${a.core_belief || 'no known belief'}. ${relDescriptions.length > 0 ? `Connections: ${relDescriptions.join(', ')}` : ''}`
  }).join('\n')

  const worldLang = world.config?.language || 'en'

  const prompt = `You are a narrator introducing a new world and its characters to the audience for the first time.

World setting:
${world.environment.description}

Social pressures: ${world.social_context.pressures?.join('; ') || 'none'}

Characters:
${castList}

Write an opening narration (prologue) for this world. This is tick 0 — nothing has happened yet, but tensions are simmering.

Requirements:
- Introduce the setting vividly — what does this place look, smell, feel like?
- Introduce each major character briefly — who they are, what they want, and what threatens them
- Hint at the conflicts and alliances that are about to unfold — the fault lines
- End with a sense of anticipation: something is about to begin
- Tone: atmospheric, cinematic, like the opening of a novel or TV series
- Length: 300-500 words
- Write in the same language as the world setting above (detected: ${worldLang})

Write the narration directly, no JSON.`

  return await streamText(client, {
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
}
