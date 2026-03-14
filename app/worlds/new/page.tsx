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
      // Create world record first to get ID
      const worldRecord = createWorld({ worldPrompt: prompt })
      console.log('World record created:', worldRecord)

      // Call complete initialization: Pangu + Nuwa + Siming
      const response = await fetch('/api/worlds/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          worldPrompt: prompt,
          worldId: worldRecord.id 
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initialize world')
      }

      const data = await response.json()
      console.log('World initialized:', data.summary)
      
      // Save generated world to localStorage
      localStorage.setItem(`world_${worldRecord.id}`, JSON.stringify(data.world))
      
      alert(`世界创建成功！\n- 女娲创造了 ${data.summary.agents_count} 个 agents\n- 司命编织了剧情：${data.summary.plot_title}`)
      
      router.push(`/worlds/${worldRecord.id}`)
    } catch (error) {
      console.error('Failed to create world:', error)
      alert('创建世界失败: ' + (error as Error).message)
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
