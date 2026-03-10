import React from 'react'
import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatShell } from './chat-shell'

it('submits a message and renders the returned reply summary', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(async () =>
    ({
      json: async () => ({ reply: 'ok', worldSummary: 'world summary test' }),
    }) as Response,
  ))

  render(<ChatShell />)

  await user.type(screen.getByRole('textbox'), '你好，世界')
  await user.click(screen.getByRole('button', { name: /send/i }))

  expect(await screen.findByText(/world summary/i)).toBeInTheDocument()

  vi.unstubAllGlobals()
})
