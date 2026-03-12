import React from 'react'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import HomePage from '../app/page'
import { useRouter } from 'next/navigation'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

it('redirects to worlds page', () => {
  const push = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push } as any)
  
  render(<HomePage />)
  expect(screen.getByText(/world slice/i)).toBeInTheDocument()
  expect(push).toHaveBeenCalledWith('/worlds')
})
