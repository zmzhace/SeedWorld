'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/worlds')
  }, [router])

  return (
    <main className="min-h-screen p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">World Slice</h1>
        <p className="mt-2 text-sm text-slate-600">Loading...</p>
      </div>
    </main>
  )
}
