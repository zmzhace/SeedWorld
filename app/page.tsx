import React from 'react'
import { ChatShell } from '@/components/chat/chat-shell'

export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">World Slice</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ChatShell />
        <section className="rounded border p-4 text-slate-500">Observability panel placeholder</section>
      </div>
    </main>
  )
}
