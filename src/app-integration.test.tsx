import React from 'react'
import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '../app/page'

it('renders both chat and observability panel containers', () => {
  render(<HomePage />)
  expect(screen.getByText(/world slice/i)).toBeInTheDocument()
  expect(screen.getByText(/agent observation desk/i)).toBeInTheDocument()
})
