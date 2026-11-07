# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fullstack.spec.ts >> websockets >> a browser subscription receives events emitted from an API route
- Location: tests/e2e/fullstack.spec.ts:73:3

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByTestId('status')
Expected: "open"
Received: "connecting"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" getByTestId('status') with timeout 5000ms
  - waiting for getByTestId('status')
    14 × locator resolved to <p data-testid="status">connecting</p>
       - unexpected value "connecting"

```

```yaml
- paragraph: connecting
```

# Test source

```ts
  1  | import { expect, request, test } from '@playwright/test'
  2  | import { watchForErrors } from './utils'
  3  | 
  4  | test.describe('server rendering', () => {
  5  |   test('the HTML is rendered on the server', async ({ baseURL }) => {
  6  |     const res = await fetch(`${baseURL}/`)
  7  |     expect(res.status).toBe(200)
  8  |     expect(res.headers.get('content-type')).toMatch(/text\/html/)
  9  |     const html = await res.text()
  10 |     expect(html).toContain('<h1>fullstack</h1>')
  11 |     expect(html).toMatch(/<link[^>]+stylesheet/)
  12 |   })
  13 | 
  14 |   test('works with JavaScript disabled', async ({ browser, baseURL }) => {
  15 |     const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  16 |     const page = await context.newPage()
  17 |     await page.goto('/about')
  18 |     await expect(page.locator('main')).toHaveText('About')
  19 |     await context.close()
  20 |   })
  21 | 
  22 |   test('hydrates: server HTML becomes interactive without errors', async ({ page }) => {
  23 |     const errors = watchForErrors(page)
  24 |     await page.goto('/e2e/counter')
  25 |     const button = page.getByRole('button', { name: /clicked/ })
  26 |     await expect(button).toHaveText('clicked 0')
  27 |     await expect(async () => {
  28 |       await button.click()
  29 |       await expect(button).not.toHaveText('clicked 0', { timeout: 500 })
  30 |     }).toPass()
  31 |     expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
  32 |   })
  33 | 
  34 |   test('unknown pages render the not-found component with a 404', async ({ baseURL }) => {
  35 |     const res = await fetch(`${baseURL}/nope/nothing`)
  36 |     expect(res.status).toBe(404)
  37 |     expect(await res.text()).toMatch(/not found/i)
  38 |   })
  39 | })
  40 | 
  41 | test.describe('per-request isolation', () => {
  42 |   test('per-user query data never leaks between concurrent SSR requests', async ({ baseURL }) => {
  43 |     const users = Array.from({ length: 12 }, (_, i) => `user${i}`)
  44 |     const pages = await Promise.all(
  45 |       users.map((who) =>
  46 |         fetch(`${baseURL}/e2e/me`, { headers: { cookie: `who=${who}` } }).then((r) => r.text()),
  47 |       ),
  48 |     )
  49 |     pages.forEach((html, i) => {
  50 |       expect(html).toMatch(new RegExp(`user:(<!-- -->)?${users[i]}<`))
  51 |       for (const other of users) if (other !== users[i]) expect(html).not.toContain(`${other}<`)
  52 |     })
  53 |     // And sequentially: the second visitor must not get the first one's cached data.
  54 |     const anon = await (await fetch(`${baseURL}/e2e/me`)).text()
  55 |     expect(anon).toMatch(/user:(<!-- -->)?anonymous</)
  56 |   })
  57 | })
  58 | 
  59 | test.describe('api', () => {
  60 |   test('health and JSON errors go through the kitr server', async ({ baseURL }) => {
  61 |     const api = await request.newContext({ baseURL })
  62 |     const health = await api.get('/api/health')
  63 |     expect(health.status()).toBe(200)
  64 |     expect(await health.json()).toMatchObject({ ok: true })
  65 |     const missing = await api.get('/api/does-not-exist')
  66 |     expect(missing.status()).toBe(404)
  67 |     expect(await missing.json()).toMatchObject({ code: 'NOT_FOUND' })
  68 |     await api.dispose()
  69 |   })
  70 | })
  71 | 
  72 | test.describe('websockets', () => {
  73 |   test('a browser subscription receives events emitted from an API route', async ({ page, baseURL }) => {
  74 |     await page.goto('/e2e/socket')
> 75 |     await expect(page.getByTestId('status')).toHaveText('open')
     |                                              ^ Error: expect(locator).toHaveText(expected) failed
  76 |     // The subscription is confirmed asynchronously; retry the emit until it lands.
  77 |     await expect(async () => {
  78 |       await fetch(`${baseURL}/api/e2e/emit`, {
  79 |         method: 'POST',
  80 |         headers: { 'content-type': 'application/json' },
  81 |         body: JSON.stringify({ room: 'e2e', text: 'hello from the server' }),
  82 |       })
  83 |       await expect(page.getByText('hello from the server').first()).toBeVisible({ timeout: 500 })
  84 |     }).toPass({ timeout: 10_000 })
  85 |     // Another room's events don't arrive.
  86 |     await fetch(`${baseURL}/api/e2e/emit`, {
  87 |       method: 'POST',
  88 |       headers: { 'content-type': 'application/json' },
  89 |       body: JSON.stringify({ room: 'other', text: 'not for you' }),
  90 |     })
  91 |     await page.waitForTimeout(300)
  92 |     await expect(page.getByText('not for you')).toHaveCount(0)
  93 |   })
  94 | })
  95 | 
```