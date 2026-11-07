import { expect, request, test } from '@playwright/test'
import { watchForErrors } from './utils'

test.describe('server rendering', () => {
  test('the HTML is rendered on the server', async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const html = await res.text()
    expect(html).toContain('<h1>fullstack</h1>')
    expect(html).toMatch(/<link[^>]+stylesheet/)
  })

  test('works with JavaScript disabled', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
    const page = await context.newPage()
    await page.goto('/about')
    await expect(page.locator('main')).toHaveText('About')
    await context.close()
  })

  test('hydrates: server HTML becomes interactive without errors', async ({ page }) => {
    const errors = watchForErrors(page)
    await page.goto('/e2e/counter')
    const button = page.getByRole('button', { name: /clicked/ })
    await expect(button).toHaveText('clicked 0')
    await expect(async () => {
      await button.click()
      await expect(button).not.toHaveText('clicked 0', { timeout: 500 })
    }).toPass()
    expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
  })

  test('unknown pages render the not-found component with a 404', async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/nope/nothing`)
    expect(res.status).toBe(404)
    expect(await res.text()).toMatch(/not found/i)
  })
})

test.describe('per-request isolation', () => {
  test('per-user query data never leaks between concurrent SSR requests', async ({ baseURL }) => {
    const users = Array.from({ length: 12 }, (_, i) => `user${i}`)
    const pages = await Promise.all(
      users.map((who) =>
        fetch(`${baseURL}/e2e/me`, { headers: { cookie: `who=${who}` } }).then((r) => r.text()),
      ),
    )
    pages.forEach((html, i) => {
      expect(html).toMatch(new RegExp(`user:(<!-- -->)?${users[i]}<`))
      for (const other of users) if (other !== users[i]) expect(html).not.toContain(`${other}<`)
    })
    // And sequentially: the second visitor must not get the first one's cached data.
    const anon = await (await fetch(`${baseURL}/e2e/me`)).text()
    expect(anon).toMatch(/user:(<!-- -->)?anonymous</)
  })
})

test.describe('api', () => {
  test('health and JSON errors go through the kitr server', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL })
    const health = await api.get('/api/health')
    expect(health.status()).toBe(200)
    expect(await health.json()).toMatchObject({ ok: true })
    const missing = await api.get('/api/does-not-exist')
    expect(missing.status()).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'NOT_FOUND' })
    await api.dispose()
  })
})

test.describe('websockets', () => {
  test('a browser subscription receives events emitted from an API route', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/e2e/socket')
    await expect(page.getByTestId('status')).toHaveText('open')
    // The subscription is confirmed asynchronously; retry the emit until it lands.
    await expect(async () => {
      await fetch(`${baseURL}/api/e2e/emit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'e2e', text: 'hello from the server' }),
      })
      await expect(page.getByText('hello from the server').first()).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 10_000 })
    // Another room's events don't arrive.
    await fetch(`${baseURL}/api/e2e/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'other', text: 'not for you' }),
    })
    await page.waitForTimeout(300)
    await expect(page.getByText('not for you')).toHaveCount(0)
  })
})
