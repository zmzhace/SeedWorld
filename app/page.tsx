'use client'

import React from 'react'
import { ChatShell } from '@/components/chat/chat-shell'
import { PanelShell } from '@/components/panel/panel-shell'
import { createInitialWorldSlice } from '@/domain/world'

export default function HomePage() {
  const [world, setWorld] = React.useState(createInitialWorldSlice())

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">World Slice</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ChatShell onWorldUpdate={setWorld} />
        <PanelShell world={world} />
      </div>
    </main>
  )
}
