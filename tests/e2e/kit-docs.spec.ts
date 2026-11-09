import { expect, test } from '@playwright/test'
import { watchForErrors } from './utils'

/**
 * The docs kit (examples/docs) as a reader meets it: pages prerendered from markdown, the sidebar,
 * search from the header, and the llms.txt copies for coding agents.
 */

test('a docs page has its heading and the sidebar', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/docs/getting-started')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting started')
  const sidebar = page.getByRole('navigation', { name: 'Docs' })
  await sidebar.getByRole('link', { name: 'Writing pages' }).click()
  await expect(page).toHaveURL(/\/docs\/writing$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing pages')
  expect(errors).toEqual([])
})

test('the page is in the HTML the server sends', async ({ baseURL }) => {
  const res = await fetch(`${baseURL}/docs/getting-started`)
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<title>Getting started[^<]*<\/title>/)
  expect(html).toContain('<h1')
})

test('search finds a page from the header', async ({ page }) => {
  await page.goto('/docs/getting-started')
  await page.getByRole('button', { name: 'Search docs' }).click()
  await page.getByRole('searchbox', { name: 'Search docs' }).fill('callout')
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await dialog.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/docs\/writing/)
})

test('llms.txt lists every page for coding agents', async ({ baseURL }) => {
  const res = await fetch(`${baseURL}/llms.txt`)
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(text).toContain('/docs/getting-started.md')
  expect(text).toContain('/docs/writing.md')
})
