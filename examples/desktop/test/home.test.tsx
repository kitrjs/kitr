import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { app } from '#app/app'
import HomePage from '#app/pages/home'

it('renders the home page with its heading', async () => {
  await app.boot()
  const page = renderWithKitr(<HomePage />, { app })
  expect(page.getByRole('heading', { level: 1 }).textContent).toBeTruthy()
})
