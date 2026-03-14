import type { WorldSlice } from '@/domain/world'

export type WorldRecord = {
  id: string
  worldPrompt: string
  personaPrompt?: string
  worldSnapshot?: WorldSlice
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'worlds'

function readAll(): WorldRecord[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as WorldRecord[]
  } catch {
    return []
  }
}

function writeAll(worlds: WorldRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(worlds))
}

export function listWorlds(): WorldRecord[] {
  return readAll().sort((a, b) => {
    if (a.updatedAt === b.updatedAt) return 0
    return a.updatedAt < b.updatedAt ? 1 : -1
  })
}

export function getWorld(id: string): WorldRecord | null {
  return readAll().find((world) => world.id === id) ?? null
}

function generateUUID(): string {
  // Fallback for environments without crypto.randomUUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function createWorld(input: { worldPrompt: string }): WorldRecord {
  const now = new Date().toISOString()
  const record: WorldRecord = {
    id: generateUUID(),
    worldPrompt: input.worldPrompt,
    createdAt: now,
    updatedAt: now,
  }
  const worlds = readAll()
  writeAll([record, ...worlds])
  return record
}

export function updateWorld(id: string, patch: Partial<WorldRecord>): WorldRecord | null {
  const worlds = readAll()
  const index = worlds.findIndex((world) => world.id === id)
  if (index === -1) return null
  const next = { ...worlds[index], ...patch, updatedAt: new Date().toISOString() }
  worlds[index] = next
  writeAll(worlds)
  return next
}

export function saveWorldSnapshot(id: string, snapshot: WorldSlice): WorldRecord | null {
  return updateWorld(id, { worldSnapshot: snapshot })
}

export function deleteWorld(id: string): boolean {
  const worlds = readAll()
  const filtered = worlds.filter((w) => w.id !== id)
  if (filtered.length === worlds.length) return false
  writeAll(filtered)
  // 同时清理 world snapshot
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`world_${id}`)
  }
  return true
}

