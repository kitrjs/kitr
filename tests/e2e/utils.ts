import type { Page } from '@playwright/test'

/** Collect console errors, page errors and failed same-origin requests while a test runs. */
export function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('response', (r) => {
    const url = new URL(r.url())
    if (r.status() >= 400 && url.origin === new URL(page.url() || r.url()).origin)
      errors.push(`${r.status()} ${url.pathname}`)
  })
  return errors
}
