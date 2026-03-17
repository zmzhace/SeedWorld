'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { createWorld } from '@/store/worlds'
import { ArrowLeft, Loader2, Mountain, Users, Swords, Pen } from 'lucide-react'

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

      // Call complete initialization: generate world + agents
      // Note: This can take 3-5 minutes due to LLM generation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minutes

      const response = await fetch('/api/worlds/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldPrompt: prompt,
          worldId: worldRecord.id
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initialize world')
      }

      const data = await response.json()
      console.log('World initialized:', data.summary)

      // Save generated world to localStorage
      localStorage.setItem(`world_${worldRecord.id}`, JSON.stringify(data.world))

      router.push(`/worlds/${worldRecord.id}`)
    } catch (error) {
      console.error('Failed to create world:', error)
      alert('创建世界失败: ' + (error as Error).message)
      setCreating(false)
    }
  }

  const tips = [
    {
      icon: Mountain,
      title: 'Environment',
      description: 'Geography, climate, terrain, and natural surroundings',
    },
    {
      icon: Users,
      title: 'Society',
      description: 'Culture, institutions, power dynamics, and social order',
    },
    {
      icon: Swords,
      title: 'Conflict',
      description: 'Core tensions, opposing forces, and sources of pressure',
    },
    {
      icon: Pen,
      title: 'Narrative Tone',
      description: 'Overall atmosphere, style, and thematic direction',
    },
  ]

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Back button */}
        <button
          onClick={() => router.push('/worlds')}
          className="mb-8 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to worlds</span>
        </button>

        {/* Form card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Create New World
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Describe the world you want to create. AI will generate the initial environment, social context, and personalized agents.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="prompt"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                World Description
              </label>
              <textarea
                id="prompt"
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="A quiet coastal town where residents live simple lives...&#10;&#10;Or: A cyberpunk megacity governed by rival AI factions..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={creating}
              />
              <p className="mt-2 text-xs text-slate-400">
                The more detail you provide, the richer the generated world will be.
              </p>
            </div>

            {/* Loading state */}
            {creating && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-blue-500" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-700">
                      Generating world...
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-blue-500">
                      <p>Creating world state and environment...</p>
                      <p>Generating personalized agents...</p>
                      <p>Preparing emergent narrative system...</p>
                      <p className="mt-2 text-blue-400">This may take 3-5 minutes. Please wait...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-600 disabled:active:scale-100"
              disabled={creating || !prompt.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create World</span>
              )}
            </button>
          </form>

          {/* Tips grid */}
          <div className="mt-8 border-t border-slate-100 pt-8">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">
              Tips for a great world
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {tips.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <tip.icon className="h-4 w-4 text-slate-400" />
                    <h4 className="text-xs font-medium text-slate-700">
                      {tip.title}
                    </h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {tip.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
