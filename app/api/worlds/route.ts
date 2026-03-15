import { NextResponse } from 'next/server'
import { generateInitialWorld } from '@/server/llm/world-generator'

// In-memory storage for world snapshots (keyed by worldId)
const worldSnapshots = new Map<string, any>()

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

    console.log('Generating world with prompt:', worldPrompt)
    
    // Generate initial world
    const world = await generateInitialWorld({ worldPrompt })
    
    // Set the world_id if provided
    if (worldId) {
      world.world_id = worldId
      worldSnapshots.set(worldId, world)
    }
    
    console.log('World generated:', world.world_id)
    
    return NextResponse.json({
      success: true,
      world,
    })
  } catch (error) {
    console.error('Failed to generate world:', error)
    return NextResponse.json(
      { error: 'Failed to generate world: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
