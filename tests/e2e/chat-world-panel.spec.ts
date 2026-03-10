import { test, expect } from '@playwright/test'

test('chat updates world panel after a user turn', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.getByRole('textbox').fill('今天感觉有点累')
  await page.getByRole('button', { name: /send/i }).click()

  await expect(page.getByText(/world summary/i)).toBeVisible()
  await expect(page.getByText(/world overview/i)).toBeVisible()
})
