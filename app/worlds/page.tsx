'use client'

import React from 'react'
import Link from 'next/link'
import { listWorlds } from '@/store/worlds'

export default function WorldsPage() {
  const worlds = listWorlds()

  return (
    <main className="min-h-screen p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Worlds</h1>
        <Link
          href="/worlds/new"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Create world
        </Link>
      </div>
      {worlds.length === 0 ? (
        <div className="mt-10 rounded border border-dashed p-8 text-center">
          <p className="text-lg font-medium">No worlds yet.</p>
          <p className="mt-2 text-sm text-slate-600">Start by creating your first world prompt.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {worlds.map((world) => (
            <li key={world.id} className="rounded border p-4 hover:border-slate-400 transition-colors">
              <Link href={`/worlds/${world.id}`} className="block">
                <div className="text-base font-semibold">{world.worldPrompt}</div>
                <div className="mt-2 text-sm text-slate-600">
                  Created <time dateTime={world.createdAt}>{world.createdAt}</time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
