import React from 'react'
import type { WorldSlice } from '@/domain/world'
import { WorldInfoPanel } from './world-info-panel'

type PanelShellProps = {
  world: WorldSlice
}

export function PanelShell({ world }: PanelShellProps) {
  return (
    <section className="space-y-6">
      <WorldInfoPanel world={world} />
    </section>
  )
}
