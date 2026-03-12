import React from 'react'
import { it, expect } from 'vitest'
import React from 'react'
import { beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorldDetailPage from '../app/worlds/[id]/page'
import { useParams } from 'next/navigation'
import { vi } from 'vitest'
import { createWorld } from '@/store/worlds'

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
})

it('renders both chat and observability panel containers', () => {
  const world = createWorld({ worldPrompt: 'Test world' })
  vi.mocked(useParams).mockReturnValue({ id: world.id })
  
  render(<WorldDetailPage />)
  expect(screen.getByText(/world slice/i)).toBeInTheDocument()
  expect(screen.getByText(/agent observation desk/i)).toBeInTheDocument()
})
