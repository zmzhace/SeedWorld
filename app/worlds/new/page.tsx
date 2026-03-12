'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { createWorld } from '@/store/worlds'

export default function NewWorldPage() {
  const router = useRouter()
  const [prompt, setPrompt] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    console.log('Creating world with prompt:', prompt)
    setCreating(true)
    try {
      const world = createWorld({ worldPrompt: prompt })
      console.log('World created:', world)
      router.push(`/worlds/${world.id}`)
    } catch (error) {
      console.error('Failed to create world:', error)
      alert('Failed to create world: ' + (error as Error).message)
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">Create New World</h1>
        <p className="mt-2 text-sm text-slate-600">
          Describe the world you want to create. This will be used to initialize the world state.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium">
              World Prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
              placeholder="例如：一个平静的海边小镇，居民们过着简单的生活..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={creating || !prompt.trim()}
            >
              {creating ? 'Creating...' : 'Create World'}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm font-semibold"
              onClick={() => router.push('/worlds')}
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
