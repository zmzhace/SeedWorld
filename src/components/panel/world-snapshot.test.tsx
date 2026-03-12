import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorldSnapshot } from './world-snapshot'
import { createInitialWorldSlice } from '@/domain/world'

describe('WorldSnapshot', () => {
  it('renders world metadata', () => {
    const world = createInitialWorldSlice()
    const { container } = render(<WorldSnapshot world={world} />)
    
    expect(container.textContent).toMatch(/world snapshot/i)
    expect(container.textContent).toMatch(/tick:/i)
    expect(container.textContent).toMatch(/time:/i)
    expect(container.textContent).toMatch(/world id:/i)
  })
  
  it('is expanded by default', () => {
    const world = createInitialWorldSlice()
    const { container } = render(<WorldSnapshot world={world} />)
    
    const details = container.querySelector('details')
    expect(details).toHaveAttribute('open')
  })
  
  it('can be collapsed', () => {
    const world = createInitialWorldSlice()
    const { container } = render(<WorldSnapshot world={world} defaultOpen={false} />)
    
    const details = container.querySelector('details')
    expect(details).not.toHaveAttribute('open')
  })
})
