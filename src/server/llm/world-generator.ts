import type { WorldSlice, SocialContext } from '@/domain/world'
import { createInitialWorldSlice } from '@/domain/world'
import { createAnthropicClient, getModel, streamText } from './anthropic'

type GenerateWorldOptions = {
  worldPrompt: string
}

type WorldSpec = {
  title: string
  summary: string
  environment: {
    description: string
    region: string
    climate: string
    terrain: string
  }
  social_context: SocialContext
  initial_time: string
  narrative_seed: string
  language?: string
}

export async function generateInitialWorld(
  options: GenerateWorldOptions
): Promise<WorldSlice> {
  const { worldPrompt } = options

  const client = createAnthropicClient()

  const model = getModel()

  console.log('WorldGenerator: Using model:', model)
  console.log('WorldGenerator: Base URL:', client.baseURL)

  const systemPrompt = `You are a world creation system. Based on the user's description, generate an initial world state.

User description: "${worldPrompt}"

Generate the following content in JSON format:
{
  "title": "A short, evocative title for this world (3-8 words, like a novel or movie title)",
  "summary": "A 1-2 sentence tagline capturing the essence of this world — its core conflict, atmosphere, or defining tension. Not a full narrative, just a condensed hook.",
  "environment": {
    "description": "Overall description of the environment",
    "region": "Geographic region",
    "climate": "Climate characteristics",
    "terrain": "Terrain features"
  },
  "social_context": {
    "macro_events": ["Major historical event 1", "Major historical event 2"],
    "narratives": ["Dominant narrative 1", "Dominant narrative 2"],
    "pressures": ["Social pressure 1", "Social pressure 2"],
    "institutions": ["Major institution 1", "Major institution 2"],
    "ambient_noise": ["Ambient atmosphere 1", "Ambient atmosphere 2"]
  },
  "initial_time": "Description of the world's starting time",
  "narrative_seed": "One sentence capturing the essence of this world",
  "language": "The primary language for this world's content (e.g. 'zh', 'en', 'ja')"
}

Requirements:
1. Create a coherent, deep world based on the user's description
2. Social context should reflect the world's history and culture
3. Environment description should be specific and vivid
4. Detect the language of the user's description and generate all content in that same language
5. Return the detected language code in the "language" field`

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

    console.log('WorldGenerator: Raw response received')

    if (!responseText) {
      throw new Error('No text content in response')
    }

    console.log('WorldGenerator response text:', responseText)

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse world specification from response: ' + responseText)
    }

    const spec: WorldSpec = JSON.parse(jsonMatch[0])

    const detectedLanguage = spec.language || 'en'

    // Create initial world with generated data
    const world = createInitialWorldSlice()

    return {
      ...world,
      title: spec.title || undefined,
      summary: spec.summary || undefined,
      config: {
        language: detectedLanguage,
        reborn_suffix: detectedLanguage === 'zh' ? '·转世' : ' Reborn',
        past_life_prefix: detectedLanguage === 'zh' ? '前世记忆：' : 'Past life: ',
      },
      environment: {
        description: spec.environment.description,
      },
      social_context: spec.social_context,
      events: [
        {
          id: 'world-genesis',
          type: 'world_created',
          timestamp: new Date().toISOString(),
          payload: {
            worldPrompt,
            narrative_seed: spec.narrative_seed,
            initial_time: spec.initial_time,
            region: spec.environment.region,
            climate: spec.environment.climate,
            terrain: spec.environment.terrain,
          },
        },
      ],
    }
  } catch (error) {
    console.error('WorldGenerator error:', error)
    throw error
  }
}
