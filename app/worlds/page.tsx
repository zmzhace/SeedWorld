'use client'

import React from 'react'
import Link from 'next/link'
import { listWorlds, deleteWorld } from '@/store/worlds'

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
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">世界列表</h1>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">世界列表</h1>
            <p className="mt-2 text-slate-600">探索和管理你的涌现式世界</p>
          </div>
          <Link
            href="/worlds/new"
            className="group flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <span className="text-xl">✨</span>
            <span>创建新世界</span>
          </Link>
        </div>

        {worlds.length === 0 ? (
          <div className="mt-12 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
              <span className="text-4xl">🌍</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">还没有世界</h2>
            <p className="mt-3 text-slate-600 max-w-md mx-auto">
              开始创建你的第一个涌现式世界，让 AI agents 自由互动，故事自然涌现
            </p>
            <Link
              href="/worlds/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
            >
              <span>开始创建</span>
              <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {worlds.map((world) => (
              <Link
                key={world.id}
                href={`/worlds/${world.id}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:scale-105 hover:border-blue-300"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md">
                      🌍
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        活跃
                      </span>
                      <button
                        onClick={(e) => handleDelete(world.id, e)}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="删除世界"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                    {world.worldPrompt}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>📅</span>
                    <time dateTime={world.createdAt}>
                      {new Date(world.createdAt).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                    <span className="text-slate-600">点击进入世界</span>
                    <span className="text-blue-600 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
