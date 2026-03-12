import React from 'react'
import type { WorldSlice } from '@/domain/world'

type WorldSnapshotProps = {
  world: WorldSlice
  defaultOpen?: boolean
}

export function WorldSnapshot({ world, defaultOpen = true }: WorldSnapshotProps) {
  return (
    <details className="rounded border p-3 text-sm text-slate-600" open={defaultOpen}>
      <summary className="cursor-pointer font-medium hover:text-slate-900">
        World Snapshot
      </summary>
      <div className="mt-2 space-y-1 text-slate-600">
        <div className="flex justify-between">
          <span className="font-medium">Tick:</span>
          <span>{world.tick}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Time:</span>
          <span className="text-xs">{new Date(world.time).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">World ID:</span>
          <span className="text-xs font-mono">{world.world_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Environment:</span>
          <span>{world.environment.description}</span>
        </div>
        {world.events.length > 0 && (
          <div className="flex justify-between">
            <span className="font-medium">Events:</span>
            <span>{world.events.length}</span>
          </div>
        )}
      </div>
    </details>
  )
}
