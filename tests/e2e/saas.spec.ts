import { expect, type Page, test } from '@playwright/test'
import { watchForErrors } from './utils'

const admin = { email: 'admin@example.com', password: 'password' }

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'))
}

test.describe('cookie sessions on the saas kit', () => {
  test('an anonymous visitor is sent to sign in, and the guard runs on the server', async ({
    baseURL,
  }) => {
    const res = await fetch(`${baseURL}/projects`, { redirect: 'manual' })
    expect([301, 302, 303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toMatch(/\/sign-in/)
  })

  test('signs in, renders user data on the server after a reload, signs out', async ({
    page,
    browser,
    baseURL,
  }) => {
    const errors = watchForErrors(page)
    await signIn(page)

    // The session is an HttpOnly cookie: JavaScript cannot read it, and no token is in localStorage.
    const cookies = await page.context().cookies()
    const session = cookies.find((c) => c.name === 'kitr-session')
    expect(session?.httpOnly).toBe(true)
    expect(session?.sameSite).toBe('Lax')
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toMatch(/token/i)

    await page.goto('/projects')
    await page.reload()
    await expect(page.getByText('Billing v2')).toBeVisible()

    // The first response already carries the signed-in user's data: no JavaScript involved.
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(`${baseURL}/projects`, {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain(admin.email)
    expect(html).toContain('Billing v2')
    expect(html).toContain('Onboarding revamp')

    const noScript = await browser.newContext({ javaScriptEnabled: false, baseURL })
    await noScript.addCookies(cookies)
    const plain = await noScript.newPage()
    await plain.goto('/projects')
    await expect(plain.getByText('Billing v2')).toBeVisible()
    await expect(plain.getByRole('banner').getByText(admin.email)).toBeVisible()
    await noScript.close()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/sign-in/)
    await page.goto('/projects')
    await page.waitForURL(/\/sign-in/)
    // The old cookie no longer opens the guarded page.
    const after = await fetch(`${baseURL}/projects`, {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    })
    expect(after.status).toBeGreaterThanOrEqual(300)
    expect(after.status).toBeLessThan(400)
    expect(errors.filter((e) => !/favicon|401/.test(e))).toEqual([])
  })

  test('a wrong password keeps the visitor on the sign-in page', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(admin.email)
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible()
  })
})

test.describe('content security policy', () => {
  const nonceOf = (csp: string, directive: string) =>
    new RegExp(`${directive} [^;]*'nonce-([^']+)'`).exec(csp)?.[1]

  test('every page carries a fresh nonce in the header and on each inline script and style', async ({
    baseURL,
  }) => {
    const seen = new Set<string>()
    for (const path of ['/sign-in', '/sign-in', '/']) {
      const res = await fetch(`${baseURL}${path}`, { redirect: 'manual' })
      const csp = res.headers.get('content-security-policy')!
      expect(csp).toBeTruthy()
      // No blanket inline permission for scripts or style elements.
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
      expect(csp).not.toMatch(/(^|; )style-src [^;]*'unsafe-inline'/)
      const nonce = nonceOf(csp, 'script-src')!
      expect(nonce).toBeTruthy()
      expect(nonceOf(csp, 'style-src')).toBe(nonce)
      seen.add(nonce)
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) continue
      const html = await res.text()
      const inline = [...html.matchAll(/<(script|style)\b([^>]*)>/g)].filter(
        (m) => m[1] === 'style' || !/\bsrc=/.test(m[2]!),
      )
      expect(inline.length).toBeGreaterThan(0)
      for (const m of inline) expect(m[2], `<${m[1]}> has the nonce`).toContain(`nonce="${nonce}"`)
    }
    // A nonce is never reused between requests.
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })

  test('the app hydrates and works under the policy with no violations', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (m) => {
      if (/content security policy|refused to/i.test(m.text())) violations.push(m.text())
    })
    const errors = watchForErrors(page)
    await signIn(page)
    await expect(page.getByRole('banner').getByText(admin.email)).toBeVisible()
    expect(violations).toEqual([])
    expect(errors.filter((e) => !/favicon|401/.test(e))).toEqual([])
  })
})
