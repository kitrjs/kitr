import { expect, test } from '@playwright/test'
import { watchForErrors } from './utils'

/**
 * The site kit (examples/site) as a visitor meets it: prerendered pages, a language switch kept in
 * a cookie, and a `<html lang>` that follows the language.
 */

const english = 'Ship the whole product, not just the UI'
const german = 'Liefere das ganze Produkt, nicht nur die Oberfläche'

test.describe('prerendered pages', () => {
  for (const path of ['/', '/pricing', '/blog']) {
    test(`${path} is in the HTML the server sends`, async ({ baseURL }) => {
      const res = await fetch(`${baseURL}${path}`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toMatch(/<html[^>]+lang="en"/)
      expect(html).toContain('<h1')
      expect(html).toMatch(/<title>[^<]+<\/title>/)
    })
  }

  test('the home page reads without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(english)
    await expect(page.getByRole('link', { name: 'Pricing' }).first()).toBeVisible()
    // Links still navigate: each page is its own document.
    await page.getByRole('link', { name: 'Pricing' }).first().click()
    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await context.close()
  })

  test('a blog post found by the crawler is prerendered too', async ({ baseURL }) => {
    const index = await (await fetch(`${baseURL}/blog`)).text()
    const post = /href="(\/blog\/[^"/]+)"/.exec(index)?.[1]
    expect(post, 'the blog index links to a post').toBeTruthy()
    const res = await fetch(`${baseURL}${post}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<article')
  })
})

test.describe('language', () => {
  test('the switch changes the page, <html lang> and survives a reload', async ({ page }) => {
    const errors = watchForErrors(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(english)

    await page.getByRole('button', { name: 'Deutsch' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(german)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(german)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')

    // And back again.
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(english)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
  })

  test('the language follows the visitor to other pages', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Deutsch' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await page.getByRole('link', { name: 'Preise' }).first().click()
    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible()
  })

  test('a page rendered per request is in the visitor’s language from the first byte', async ({
    baseURL,
  }) => {
    // The 404 page is never prerendered, so the root loader reads the cookie on the server.
    const res = await fetch(`${baseURL}/no/such/page`, { headers: { cookie: 'site:locale=de' } })
    expect(res.status).toBe(404)
    expect(await res.text()).toMatch(/<html[^>]+lang="de"/)
    const fallback = await fetch(`${baseURL}/no/such/page`)
    expect(await fallback.text()).toMatch(/<html[^>]+lang="en"/)
  })

  test('one URL serves every language, so no hreflang alternates are declared', async ({
    baseURL,
  }) => {
    // The kit switches language with a cookie, not with a path, so there is nothing to alternate
    // between. If the kit grows locale-prefixed URLs, this is where hreflang belongs.
    const html = await (await fetch(`${baseURL}/`)).text()
    expect(html).not.toMatch(/hreflang=/)
  })
})

test('the newsletter form posts to the API and confirms', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('you@example.com').fill('reader@example.com')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await expect(page.getByText('Thanks, you are on the list.')).toBeVisible()
})
