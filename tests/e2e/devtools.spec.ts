import { expect, type Page, test } from '@playwright/test'

/**
 * This project runs against the Vite dev server, which is cold when the suite starts: the first
 * page load makes Vite discover and pre-bundle dependencies it had not seen, and when that finishes
 * it reloads every open page ("optimized dependencies changed"). A test that opened the overlay in
 * that window lost it to the reload and failed on a click that had worked a moment earlier. Load
 * the app once up front, until the page has settled, so the tests start on a warm server.
 *
 * The same spec runs twice: `dashboard-dev` drives the dock, the keyboard and the mouse, and
 * `dashboard-dev-phone` (an iPhone 14) drives the bottom sheet and touch gestures.
 *
 * The overlay lives in a shadow root; Playwright locators pierce it, so plain class selectors work.
 * The dashboard fetches nothing on load (its mocked `/me` is only requested after a sign-in), so the
 * Network tab has no request to show and is not asserted here.
 */
test.beforeAll(async ({ browser, baseURL }) => {
  const page = await (await browser.newContext({ baseURL })).newPage()
  for (let pass = 0; pass < 2; pass++) {
    await page.goto('/')
    await expect(page.locator('.kitr-dt-trigger')).toBeVisible({ timeout: 30_000 })
    await page.waitForLoadState('networkidle')
  }
  await page.context().close()
})

test.beforeEach(async ({ page }) => {
  // Start from a clean overlay once per test; reloads within the test keep what was persisted.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:cleared')) return
    sessionStorage.setItem('e2e:cleared', '1')
    localStorage.removeItem('kitr:devtools')
    localStorage.removeItem('kitr:devtools:log')
  })
})

const trigger = (page: Page) => page.locator('.kitr-dt-trigger')
const palette = (page: Page) => page.getByPlaceholder('Search actions')

/** The persisted shell state, as `shell/persist.ts` writes it. */
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('kitr:devtools') ?? '{}'))

/**
 * Logs through the app's devtools hub. The dashboard does not expose its app on `window`, so the
 * hub is found the way React DevTools finds props: through the fiber of the overlay's host element.
 */
function logFromPage(page: Page, level: string, label: string) {
  return page.evaluate(
    ([lvl, text]) => {
      const host = document.querySelector('[data-kitr-devtools]') as Record<string, any> | null
      const key = host && Object.keys(host).find((k) => k.startsWith('__reactFiber'))
      for (let fiber = key ? host?.[key] : null; fiber; fiber = fiber.return) {
        const app = fiber.memoizedProps?.app
        if (app?.container) return app.container.use('devtools').log('e2e', text, undefined, lvl)
      }
      throw new Error('overlay app not found')
    },
    [level, label],
  )
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the dock, keyboard and mouse cases are desktop only')

  test('the overlay opens from the trigger and the shortcut, and lists panels', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))
    await page.goto('/')
    await expect(trigger(page)).toBeVisible()
    await trigger(page).click()
    const panel = page.locator('.kitr-dt-panel')
    await expect(panel).toBeVisible()
    const tabs = page.locator('.kitr-dt-tab[data-tab-id]')
    expect(await tabs.count()).toBeGreaterThan(2)
    // Every panel renders without its error boundary stepping in.
    const ids = await tabs.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.tabId))
    for (const id of ids) {
      const tab = page.locator(`.kitr-dt-tab[data-tab-id="${id}"]`)
      // A tab that does not fit sits behind "+N"; the palette reaches every panel.
      if (await tab.count()) await tab.click()
      else {
        await page.keyboard.press('Control+Shift+P')
        await palette(page).fill(id as string)
        await palette(page).press('Enter')
      }
      await expect(page.locator('.kitr-dt-body')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    }
    await page.keyboard.press('Control+Shift+K')
    await expect(panel).toBeHidden()
    await page.keyboard.press('Control+Shift+K')
    await expect(panel).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('open state and tab persist across reloads', async ({ page }) => {
    await page.goto('/')
    await trigger(page).click()
    const second = page.locator('.kitr-dt-tab[data-tab-id]').nth(1)
    // The label alone: a tab's badge (the router's pending `…`) comes and goes with navigation.
    const label = await second.locator('.kitr-dt-tab-label').textContent()
    await second.click()
    await page.reload()
    await expect(page.locator('.kitr-dt-panel')).toBeVisible()
    await expect(page.locator('.kitr-dt-tab-active .kitr-dt-tab-label')).toHaveText(label as string)
  })

  test('Escape closes the palette first, then the window', async ({ page }) => {
    await page.goto('/')
    await trigger(page).click()
    await page.keyboard.press('Control+Shift+P')
    await expect(palette(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.kitr-dt-palette')).toBeHidden()
    await expect(page.locator('.kitr-dt-panel')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.kitr-dt-panel')).toBeHidden()
    await expect(trigger(page)).toBeVisible()
  })

  test('the palette filters and runs an action that is logged under devtools', async ({ page }) => {
    await page.goto('/')
    await trigger(page).click()
    await page.keyboard.press('Control+Shift+P')
    await palette(page).fill('inv')
    const items = page.locator('.kitr-dt-palette-item')
    await expect(items.first()).toContainText('Invalidate')
    await palette(page).press('Enter')
    await expect(page.locator('.kitr-dt-palette')).toBeHidden()
    await page.locator('.kitr-dt-tab[data-tab-id="log"]').click()
    const body = page.locator('.kitr-dt-body')
    await expect(body).toContainText('ran Invalidate')
    await expect(body.locator('.kitr-dt-chip', { hasText: 'devtools' })).toBeVisible()
  })

  test('the trigger can be dragged to the other edge and stays there after a reload', async ({
    page,
  }) => {
    await page.goto('/')
    const box = await trigger(page).boundingBox()
    if (!box) throw new Error('trigger has no box')
    const width = page.viewportSize()?.width ?? 1280
    expect(box.x + box.width / 2).toBeLessThan(width / 2)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(width - 20, 200, { steps: 12 })
    await page.mouse.up()
    // A drag is not a click: the window stays closed.
    await expect(page.locator('.kitr-dt-panel')).toBeHidden()
    await expect.poll(async () => (await stored(page)).trigger?.edge).toBe('right')
    await page.reload()
    const moved = await trigger(page).boundingBox()
    expect((moved?.x ?? 0) + (moved?.width ?? 0) / 2).toBeGreaterThan(width / 2)
  })

  test('Dock right moves the window to the right edge', async ({ page }) => {
    await page.goto('/')
    await trigger(page).click()
    await expect(page.locator('.kitr-dt-panel[data-dock="bottom"]')).toBeVisible()
    await page.getByRole('button', { name: 'Dock right' }).click()
    await expect(page.locator('.kitr-dt-panel[data-dock="right"]')).toBeVisible()
    await expect.poll(async () => (await stored(page)).dock).toBe('right')
  })

  test('the Log level chips filter entries', async ({ page }) => {
    await page.goto('/')
    await trigger(page).click()
    await page.locator('.kitr-dt-tab[data-tab-id="log"]').click()
    await logFromPage(page, 'info', 'chip-probe')
    const body = page.locator('.kitr-dt-body')
    await expect(body).toContainText('chip-probe')
    await body.locator('.kitr-dt-chip', { hasText: /^info/ }).click()
    await expect(body).not.toContainText('chip-probe')
    await body.locator('.kitr-dt-chip', { hasText: /^info/ }).click()
    await expect(body).toContainText('chip-probe')
  })

  test('an error logged while closed puts a badge on the trigger', async ({ page }) => {
    await page.goto('/')
    await expect(trigger(page)).toBeVisible()
    await expect(page.locator('.kitr-dt-trigger-badge')).toHaveCount(0)
    await logFromPage(page, 'error', 'badge-probe')
    await expect(page.locator('.kitr-dt-trigger-badge')).toHaveText('1')
  })
})

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the sheet and touch cases need a touch device')

  const sheet = (page: Page) => page.locator('.kitr-dt-sheet')

  /** One synthetic touch sequence through the browser's own input pipeline. */
  async function touch(
    page: Page,
    steps: Array<{
      type: 'touchStart' | 'touchMove' | 'touchEnd'
      points: Array<[number, number]>
    }>,
    wait = 0,
  ) {
    const cdp = await page.context().newCDPSession(page)
    for (const [i, step] of steps.entries()) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: step.type,
        touchPoints: step.points.map(([x, y], id) => ({ x, y, id })),
      })
      // A finger moves at frame rate; events sent back to back would outrun React's renders.
      await page.waitForTimeout(i === 0 && wait ? wait : 16)
    }
  }

  test('the trigger is at least 44 by 44 and inside the viewport', async ({ page }) => {
    await page.goto('/')
    await expect(trigger(page)).toBeVisible()
    const box = await trigger(page).boundingBox()
    if (!box) throw new Error('trigger has no box')
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await expect(trigger(page)).toBeInViewport({ ratio: 1 })
  })

  test('tapping the trigger opens a sheet whose Close button is in view', async ({ page }) => {
    await page.goto('/')
    await trigger(page).tap()
    await expect(sheet(page)).toBeVisible()
    await expect(sheet(page).getByRole('button', { name: 'Close' })).toBeInViewport()
    await sheet(page).getByRole('button', { name: 'Close' }).tap()
    await expect(sheet(page)).toBeHidden()
  })

  test('the tab strip scrolls', async ({ page }) => {
    await page.goto('/')
    await trigger(page).tap()
    const strip = page.locator('.kitr-dt-tabs')
    await expect(strip).toBeVisible()
    const overflow = await strip.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeGreaterThan(0)
    // Selecting the last tab scrolls it into view.
    await page.locator('.kitr-dt-tab[data-tab-id]').last().tap()
    await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    await expect(page.locator('.kitr-dt-tab-active')).toBeInViewport()
  })

  test('the actions button opens a bottom menu', async ({ page }) => {
    await page.goto('/')
    await trigger(page).tap()
    await sheet(page).getByRole('button', { name: 'Actions' }).tap()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    const height = page.viewportSize()?.height ?? 0
    expect(box?.y ?? 0).toBeGreaterThan(height / 3)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(height - 24)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('dragging the handle down closes the sheet (touch input)', async ({ page }) => {
    await page.goto('/')
    await trigger(page).tap()
    await expect(sheet(page)).toBeVisible()
    const handle = await page.locator('.kitr-dt-handle').boundingBox()
    if (!handle) throw new Error('handle has no box')
    const x = handle.x + handle.width / 2
    const y = handle.y + handle.height / 2
    const path: Array<[number, number]> = []
    for (let dy = 0; dy <= 240; dy += 20) path.push([x, y + dy])
    await touch(page, [
      { type: 'touchStart', points: [path[0] as [number, number]] },
      ...path.slice(1).map((p) => ({ type: 'touchMove' as const, points: [p] })),
      { type: 'touchEnd', points: [] },
    ])
    await expect(sheet(page)).toBeHidden()
    await expect(trigger(page)).toBeVisible()
  })

  test('dragging the handle down closes the sheet (pointer events)', async ({ page }) => {
    await page.goto('/')
    await trigger(page).tap()
    await expect(sheet(page)).toBeVisible()
    // The same gesture as pointer events, which is what the sheet listens to.
    await page.locator('.kitr-dt-handle').evaluate(async (handle) => {
      const rect = handle.getBoundingClientRect()
      const x = rect.x + rect.width / 2
      const y = rect.y + rect.height / 2
      const fire = (type: string, dy: number) =>
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            composed: true,
            pointerId: 7,
            pointerType: 'touch',
            clientX: x,
            clientY: y + dy,
          }),
        )
      const frame = () => new Promise((resolve) => setTimeout(resolve, 16))
      fire('pointerdown', 0)
      for (let dy = 20; dy <= 240; dy += 20) {
        await frame()
        fire('pointermove', dy)
      }
      await frame()
      fire('pointerup', 240)
    })
    await expect(sheet(page)).toBeHidden()
    await expect(trigger(page)).toBeVisible()
  })

  test('a three-finger long press toggles the window', async ({ page }) => {
    await page.goto('/')
    await expect(trigger(page)).toBeVisible()
    const fingers: Array<[number, number]> = [
      [120, 300],
      [190, 300],
      [260, 300],
    ]
    const press = () =>
      touch(
        page,
        [
          { type: 'touchStart', points: fingers },
          { type: 'touchEnd', points: [] },
        ],
        800,
      )
    await press()
    await expect(sheet(page)).toBeVisible()
    await press()
    await expect(sheet(page)).toBeHidden()
  })
})
