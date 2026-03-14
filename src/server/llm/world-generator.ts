import Anthropic from '@anthropic-ai/sdk'
import type { WorldSlice, SocialContext } from '@/domain/world'
import { createInitialWorldSlice } from '@/domain/world'
import { createAnthropicClient, getModel } from './anthropic'

type GenerateWorldOptions = {
  worldPrompt: string
}

type WorldSpec = {
  environment: {
    description: string
    region: string
    climate: string
    terrain: string
  }
  social_context: SocialContext
  initial_time: string
  narrative_seed: string
}

export async function generateInitialWorld(
  options: GenerateWorldOptions
): Promise<WorldSlice> {
  const { worldPrompt } = options

  const client = createAnthropicClient()

  const model = getModel()

  console.log('Pangu: Using model:', model)
  console.log('Pangu: Base URL:', client.baseURL)

  const systemPrompt = `你是盘古（Pangu），世界创造系统。根据用户的描述生成一个初始世界状态。

用户描述: "${worldPrompt}"

请生成以下内容（JSON格式）：
{
  "environment": {
    "description": "环境的整体描述",
    "region": "地理区域",
    "climate": "气候特征",
    "terrain": "地形特征"
  },
  "social_context": {
    "macro_events": ["重大历史事件1", "重大历史事件2"],
    "narratives": ["主流叙事1", "主流叙事2"],
    "pressures": ["社会压力1", "社会压力2"],
    "institutions": ["主要机构1", "主要机构2"],
    "ambient_noise": ["环境氛围1", "环境氛围2"]
  },
  "initial_time": "世界的起始时间描述",
  "narrative_seed": "世界的核心叙事种子，一句话概括这个世界的本质"
}

要求：
1. 基于用户描述创造一个连贯、有深度的世界
2. 社会背景要反映世界的历史和文化
3. 环境描述要具体、生动
4. 所有内容用中文`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    })

    console.log('Pangu: Raw response type:', typeof response)

    let responseText = ''
    
    // Handle SSE streaming format (when response is a string)
    if (typeof response === 'string') {
      console.log('Pangu: Parsing SSE format')
      const lines = (response as string).split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            if (data.type === 'content_block_delta' && data.delta?.text) {
              responseText += data.delta.text
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } 
    // Handle standard Anthropic format
    else if (response.content && response.content.length > 0) {
      console.log('Pangu: Parsing standard format')
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    } else {
      throw new Error('Empty response from Anthropic API')
    }

    if (!responseText) {
      throw new Error('No text content in response')
    }

    console.log('Pangu response text:', responseText)

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse world specification from response: ' + responseText)
    }

    const spec: WorldSpec = JSON.parse(jsonMatch[0])

    // Create initial world with generated data
    const world = createInitialWorldSlice()
    
    return {
      ...world,
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
    console.error('Pangu error:', error)
    throw error
  }
}
