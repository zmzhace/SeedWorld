'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChatShell } from '@/components/chat/chat-shell'
import { PanelShell } from '@/components/panel/panel-shell'
import { createInitialWorldSlice } from '@/domain/world'
import { getWorld } from '@/store/worlds'

export default function WorldDetailPage() {
  const params = useParams()
  const worldId = params.id as string
  
  const worldRecord = getWorld(worldId)
  const [world, setWorld] = React.useState(createInitialWorldSlice())

  React.useEffect(() => {
    if (worldRecord) {
      // Initialize world with the prompt
      const initialWorld = createInitialWorldSlice()
      initialWorld.world_id = worldId
      setWorld(initialWorld)
    }
  }, [worldId, worldRecord])

  if (!worldRecord) {
    return (
      <main className="min-h-screen p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">World not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The world you're looking for doesn't exist.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">World Slice</h1>
        <p className="mt-1 text-sm text-slate-600">{worldRecord.worldPrompt}</p>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ChatShell onWorldUpdate={setWorld} />
        <PanelShell world={world} />
      </div>
    </main>
  )
}
