import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

/**
 * kitr.dev, as built (CI serves site/dist/client the way nginx does) or live
 * (SITE_URL=https://kitr.dev, from the scheduled site-live workflow). Read-only checks.
 *
 * Crawls every page reachable from the home page, the nav and llms.txt, then checks each one
 * the way a visitor, a search engine and an agent would.
 */

const live = !!process.env.SITE_URL

/** Same-origin page paths linked from an HTML document (no hash, no query, no assets). */
function links(html: string): string[] {
  const out = new Set<string>()
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    if (!href || /^(https?:|mailto:|tel:|#|\/\/)/.test(href)) continue
    const path = href.split('#')[0]!.split('?')[0]!
    // Cloudflare rewrites mailto links to /cdn-cgi/l/email-protection on the live site.
    if (path && !path.startsWith('/cdn-cgi/')) out.add(path)
  }
  return [...out]
}

interface Crawled {
  path: string
  status: number
  type: string
  html: string
  linkedFrom: string
}

let crawled: Map<string, Crawled> | undefined

async function crawl(request: APIRequestContext, baseURL: string): Promise<Map<string, Crawled>> {
  if (crawled) return crawled
  const seen = new Map<string, Crawled>()
  const queue: Array<[string, string]> = [
    ['/', 'start'],
    ['/packages', 'start'],
    ['/about', 'start'],
  ]
  // Every page agents are pointed at must also exist as HTML.
  const llms = await (await request.get('/llms.txt')).text()
  for (const [, url] of llms.matchAll(/\]\((https:\/\/kitr\.dev[^)]*)\)/g)) {
    const path = new URL(url!).pathname.replace(/\.md$/, '')
    queue.push([path === '/index' ? '/' : path, '/llms.txt'])
  }
  while (queue.length) {
    const batch = queue.splice(0, 8).filter(([p]) => !seen.has(p))
    await Promise.all(
      batch.map(async ([path, from]) => {
        if (seen.has(path)) return
        const placeholder: Crawled = { path, status: 0, type: '', html: '', linkedFrom: from }
        seen.set(path, placeholder)
        const res = await request.get(new URL(path, baseURL).href, { maxRedirects: 3 })
        placeholder.status = res.status()
        placeholder.type = res.headers()['content-type'] ?? ''
        if (path.endsWith('.md') || !placeholder.type.includes('html')) return
        placeholder.html = await res.text()
        for (const next of links(placeholder.html)) if (!seen.has(next)) queue.push([next, path])
      }),
    )
  }
  crawled = seen
  return seen
}

const htmlPages = (all: Map<string, Crawled>) =>
  [...all.values()].filter((p) => !p.path.endsWith('.md') && p.type.includes('html'))

/** Keep the run hermetic when testing the build: third-party fonts get an empty stylesheet. */
async function isolate(page: Page) {
  if (live) return
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
}

function watchErrors(page: Page, origin: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(origin)) errors.push(`failed ${r.url()}: ${r.failure()?.errorText}`)
  })
  return errors
}

test.describe('every page', () => {
  test('is reachable: no broken internal links', async ({ request, baseURL }) => {
    test.setTimeout(120_000)
    const all = await crawl(request, baseURL!)
    const broken = [...all.values()]
      .filter((p) => p.status !== 200)
      .map((p) => `${p.status} ${p.path} (linked from ${p.linkedFrom})`)
    expect(broken).toEqual([])
    expect(htmlPages(all).length).toBeGreaterThan(20)
  })

  test('has one h1, a title, a description and a language', async ({ request, baseURL }) => {
    test.setTimeout(120_000)
    const problems: string[] = []
    for (const p of htmlPages(await crawl(request, baseURL!))) {
      // /play pages are iframed examples: they need a title, not a page heading.
      const h1 = p.html.match(/<h1\b/g)?.length ?? 0
      if (h1 !== 1 && !p.path.startsWith('/play/')) problems.push(`${p.path}: ${h1} h1 elements`)
      const title = p.html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()
      if (!title) problems.push(`${p.path}: no <title>`)
      if (!/<meta name="description" content="[^"]{20,}"/.test(p.html))
        problems.push(`${p.path}: no meta description`)
      if (!/<html[^>]*\blang="en"/.test(p.html)) problems.push(`${p.path}: no lang`)
      for (const [img] of p.html.matchAll(/<img\b[^>]*>/g))
        if (!/\balt="/.test(img)) problems.push(`${p.path}: <img> without alt`)
    }
    expect(problems).toEqual([])
  })

  test('has its own title', async ({ request, baseURL }) => {
    test.setTimeout(120_000)
    const byTitle = new Map<string, string[]>()
    for (const p of htmlPages(await crawl(request, baseURL!))) {
      // /play pages are iframed examples, not pages people land on.
      if (p.path.startsWith('/play/')) continue
      const title = p.html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
      byTitle.set(title, [...(byTitle.get(title) ?? []), p.path])
    }
    const dupes = [...byTitle].filter(([, paths]) => paths.length > 1)
    expect(dupes).toEqual([])
  })

  test('is server-rendered: the content is in the HTML, not only in JavaScript', async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    const thin = htmlPages(await crawl(request, baseURL!))
      .filter((p) => !p.path.startsWith('/play/'))
      .filter((p) => {
        const text = p.html
          .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
        return text.length < 400
      })
      .map((p) => p.path)
    expect(thin).toEqual([])
  })
})

test.describe('for agents', () => {
  test('llms.txt and every markdown page it lists are served as text', async ({ request }) => {
    const llms = await request.get('/llms.txt')
    expect(llms.status()).toBe(200)
    const body = await llms.text()
    expect(body).toMatch(/^# kitr/)
    const urls = [...body.matchAll(/\]\((https:\/\/kitr\.dev[^)]*\.md)\)/g)].map(
      ([, u]) => new URL(u!).pathname,
    )
    expect(urls.length).toBeGreaterThan(10)
    for (const path of urls) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
      expect(res.headers()['content-type'], path).toMatch(/text\/(markdown|plain)/)
      expect((await res.text()).length, path).toBeGreaterThan(100)
    }
    const full = await request.get('/llms-full.txt')
    expect(full.status()).toBe(200)
    expect((await full.text()).length).toBeGreaterThan(body.length)
  })
})

test.describe('in the browser', () => {
  const pages = [
    '/',
    '/packages',
    '/about',
    '/docs/getting-started',
    '/packages/query',
    '/docs/cli',
    '/docs/platforms',
    '/platforms',
    '/platforms/desktop',
    '/packages/server',
  ]

  for (const path of pages) {
    test(`${path} loads with no errors and fits a phone screen`, async ({ page, baseURL }) => {
      await isolate(page)
      const errors = watchErrors(page, new URL(baseURL!).origin)
      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1')).toHaveCount(1)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, 'horizontal scroll on a 375px screen').toBeLessThanOrEqual(1)
      expect(errors).toEqual([])
    })
  }

  test('hydrates: links navigate client-side without a full reload', async ({ page }) => {
    await isolate(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      ;(window as any).__kitrMarker = 1
    })
    await page.locator('a[href="/packages"]').first().click()
    await expect(page).toHaveURL(/\/packages$/)
    await expect(page.locator('h1')).toHaveCount(1)
    expect(await page.evaluate(() => (window as any).__kitrMarker)).toBe(1)
  })

  test('package search on a phone shows matches right under the box', async ({ page, baseURL }) => {
    await isolate(page)
    const errors = watchErrors(page, new URL(baseURL!).origin)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/packages')
    await page.waitForLoadState('networkidle')
    const name = (await page.locator('a.dcard .dcard-name').last().textContent())!.trim()
    await page.getByRole('searchbox', { name: 'Filter packages' }).fill(name)
    await expect(page).toHaveURL(new RegExp(`[?&]q=${name}`))
    const first = page.locator('.dcard').first()
    await expect(first.locator('.dcard-name')).toHaveText(name)
    // With the keyboard up a phone shows roughly the top 350px: the match has to be there.
    await page.getByRole('searchbox', { name: 'Filter packages' }).focus()
    await page.waitForTimeout(600)
    const box = await first.boundingBox()
    expect(box!.y, 'first match sits under the search box').toBeLessThan(350)
    await page.getByRole('button', { name: 'Clear' }).first().click()
    await expect(page).toHaveURL(/\/packages$/)
    expect(errors).toEqual([])
  })

  test("a package's sidebar is its own guide, with a way back to every package", async ({
    page,
  }) => {
    await isolate(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/packages/mail')
    await page.waitForLoadState('networkidle')
    const sidebar = page.locator('#docs-sidebar')
    await expect(sidebar.locator('a[href="/packages"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/packages/query"]')).toHaveCount(0)
    await expect(sidebar.locator('a[href="#install"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/packages/mail/api"]')).toBeVisible()
    // On a wide screen the header shows its links, not the phone menu button.
    await expect(page.locator('.nav-links')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden()

    // On the API page only "API reference" is marked current, not the guide as well.
    await sidebar.locator('a[href="/packages/mail/api"]').click()
    await expect(page).toHaveURL(/\/packages\/mail\/api$/)
    await expect(sidebar.locator('[aria-current="page"]')).toHaveText(['API reference'])
  })

  test('on a phone, the docs bar opens the navigation and a section link closes it', async ({
    page,
  }) => {
    await isolate(page)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/packages/mail')
    await page.waitForLoadState('networkidle')
    const sidebar = page.locator('#docs-sidebar')
    await expect(sidebar).toBeHidden()
    await page.locator('.docs-bar-menu').click()
    await expect(sidebar).toBeVisible()
    await sidebar.locator('a[href="#configure"]').click()
    await expect(sidebar).toBeHidden()
    await expect(page.locator('.docs-bar-section')).toHaveText('Configure')

    // The section button drops down the page's sections to jump between.
    await page.locator('.docs-bar-toc').click()
    const sections = page.locator('#docs-sections')
    await expect(sections).toBeVisible()
    await sections.locator('a[href="#testing"]').click()
    await expect(sections).toBeHidden()
    await expect(page.locator('.docs-bar-section')).toHaveText('Testing')
  })

  test('on a phone, the header menu lists every header link', async ({ page }) => {
    await isolate(page)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/docs/getting-started')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.nav-links')).toBeHidden()
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.locator('#nav-menu')
    for (const label of ['Platforms', 'Packages', 'Docs', 'Guides', 'About', 'GitHub'])
      await expect(menu.getByRole('link', { name: label })).toBeVisible()
    await menu.getByRole('link', { name: 'Guides' }).click()
    await expect(page).toHaveURL(/\/guides$/)
    await expect(menu).toBeHidden()
  })

  test('an unknown page shows the not-found page', async ({ page }) => {
    await isolate(page)
    await page.goto('/this-page-does-not-exist')
    await expect(page.getByText(/not found/i).first()).toBeVisible()
  })

  test('/docs goes to the first guide', async ({ page }) => {
    await isolate(page)
    await page.goto('/docs')
    await expect(page).toHaveURL(/\/docs\/getting-started$/)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('assets are cached for a year and pages revalidate', async ({ request }) => {
    const home = await request.get('/')
    expect(home.headers()['cache-control']).toMatch(/must-revalidate|max-age=0|no-cache/)
    const asset = (await home.text()).match(/\/assets\/[^"]+\.js/)?.[0]
    expect(asset).toBeTruthy()
    const res = await request.get(asset!)
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toMatch(/immutable|max-age=31536000/)
  })
})
