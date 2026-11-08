import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Start from a clean overlay once per test; reloads within the test keep what was persisted.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:cleared')) return
    sessionStorage.setItem('e2e:cleared', '1')
    localStorage.removeItem('kitr:devtools')
  })
})

test('the overlay opens from the trigger and the shortcut, and lists panels', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.goto('/')
  const trigger = page.locator('.kitr-dt-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  const panel = page.locator('.kitr-dt-panel')
  await expect(panel).toBeVisible()
  const tabs = page.locator('.kitr-dt-tab')
  expect(await tabs.count()).toBeGreaterThan(2)
  // Every panel renders without crashing.
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click()
    await expect(page.locator('.kitr-dt-body')).not.toContainText('Panel crashed')
  }
  await page.keyboard.press('Control+Shift+K')
  await expect(panel).toBeHidden()
  await page.keyboard.press('Control+Shift+K')
  await expect(panel).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('open state and tab persist across reloads', async ({ page }) => {
  await page.goto('/')
  await page.locator('.kitr-dt-trigger').click()
  const second = page.locator('.kitr-dt-tab').nth(1)
  // The label alone: a tab's badge (the router's pending `…`) comes and goes with navigation.
  const label = await second.locator('.kitr-dt-tab-label').textContent()
  await second.click()
  await page.reload()
  await expect(page.locator('.kitr-dt-panel')).toBeVisible()
  await expect(page.locator('.kitr-dt-tab-active .kitr-dt-tab-label')).toHaveText(label!)
})

test('the command palette filters and runs actions', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.kitr-dt-trigger')).toBeVisible()
  await page.keyboard.press('Control+Shift+P')
  const input = page.getByPlaceholder('Type an action…')
  await expect(input).toBeFocused()
  await input.fill('open')
  const items = page.locator('.kitr-dt-palette-item')
  expect(await items.count()).toBeGreaterThan(0)
  await input.press('Enter')
  await expect(page.locator('.kitr-dt-palette')).toBeHidden()
  await expect(page.locator('.kitr-dt-panel')).toBeVisible()
  await page.keyboard.press('Control+Shift+P')
  await page.getByPlaceholder('Type an action…').fill('zzzz-no-match')
  await expect(page.getByText('No matches')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.kitr-dt-palette')).toBeHidden()
})
