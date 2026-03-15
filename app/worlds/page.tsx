'use client'

import React from 'react'
import Link from 'next/link'
import { listWorlds, deleteWorld } from '@/store/worlds'
import { Plus, Trash2, Globe, Clock, ChevronRight } from 'lucide-react'

export default function WorldsPage() {
  const [worlds, setWorlds] = React.useState<ReturnType<typeof listWorlds>>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setWorlds(listWorlds())
    setMounted(true)
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定要删除这个世界吗？此操作不可撤销。')) return
    deleteWorld(id)
    setWorlds(listWorlds())
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-800">World Slice</h1>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              World Slice
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Explore and manage your emergent worlds
            </p>
          </div>
          <Link
            href="/worlds/new"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500 hover:shadow-md active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span>Create World</span>
          </Link>
        </div>

        {/* Content */}
        {worlds.length === 0 ? (
          /* Empty state */
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <Globe className="h-9 w-9 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">
              No worlds yet
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              Create your first world and let AI agents interact freely as stories emerge naturally.
            </p>
            <Link
              href="/worlds/new"
              className="mt-8 flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500 hover:shadow-md active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              <span>Create your first world</span>
            </Link>
          </div>
        ) : (
          /* World cards grid */
          <div className="mt-8 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {worlds.map((world) => (
              <Link
                key={world.id}
                href={`/worlds/${world.id}`}
                className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium leading-snug text-slate-700 line-clamp-2 group-hover:text-slate-900 transition-colors">
                      {world.worldSnapshot?.title || world.worldPrompt}
                    </h3>
                    {world.worldSnapshot?.title && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        {world.worldSnapshot?.summary || world.worldPrompt}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(world.id, e)}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Delete world"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <time dateTime={world.createdAt}>
                      {new Date(world.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </span>
                  {world.worldSnapshot && world.worldSnapshot.tick > 0 && (
                    <span className="text-slate-400">
                      Tick {world.worldSnapshot.tick}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
                    Enter world
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
