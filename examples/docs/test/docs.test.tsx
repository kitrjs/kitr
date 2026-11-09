import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@kitr/router'
import { renderWithKitr } from '@kitr/testing/react'
import { within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { app } from '#app/app'
import { loadPage, nav } from '#kitr/content'
import { DocLayout } from '#components/ui/doc-layout'

it('renders a docs page with its title, the sidebar and the next page', async () => {
  await app.boot()
  const page = await loadPage('docs', 'getting-started')
  if (!page) throw new Error('kitr generate has not rendered content/docs/getting-started.md')
  const root = createRootRoute({
    component: () => <DocLayout page={page} nav={nav.docs} base="/docs" slug="getting-started" />,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/docs/getting-started'] }),
  })
  const view = renderWithKitr(<RouterProvider router={router} />, { app })
  expect((await view.findByRole('heading', { level: 1 })).textContent).toBe('Getting started')
  expect(view.getByRole('navigation', { name: 'Docs' })).toBeTruthy()
  const pager = view.getByRole('navigation', { name: 'Previous and next' })
  expect(within(pager).getByRole('link').getAttribute('href')).toBe('/docs/writing')
})

it('has no page for an unknown slug', async () => {
  expect(await loadPage('docs', 'no-such-page')).toBeNull()
})
