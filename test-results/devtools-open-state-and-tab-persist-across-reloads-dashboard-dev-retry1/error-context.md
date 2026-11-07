# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: devtools.spec.ts >> open state and tab persist across reloads
- Location: tests/e2e/devtools.spec.ts:30:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.kitr-dt-panel')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.kitr-dt-panel') with timeout 5000ms
  - waiting for locator('.kitr-dt-panel')

```

```yaml
- navigation:
  - link "Home":
    - /url: /
  - link "About":
    - /url: /about
- main:
  - heading "dashboard" [level=1]
  - paragraph:
    - text: Edit
    - code: app/routes/index.tsx
    - text: . Add a page with
    - code: kitr make:route
    - text: .
- button "k"
- region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | 
  3  | test.beforeEach(async ({ page }) => {
  4  |   await page.addInitScript(() => localStorage.removeItem('kitr:devtools'))
  5  | })
  6  | 
  7  | test('the overlay opens from the trigger and the shortcut, and lists panels', async ({ page }) => {
  8  |   const pageErrors: string[] = []
  9  |   page.on('pageerror', (e) => pageErrors.push(e.message))
  10 |   await page.goto('/')
  11 |   const trigger = page.locator('.kitr-dt-trigger')
  12 |   await expect(trigger).toBeVisible()
  13 |   await trigger.click()
  14 |   const panel = page.locator('.kitr-dt-panel')
  15 |   await expect(panel).toBeVisible()
  16 |   const tabs = page.locator('.kitr-dt-tab')
  17 |   expect(await tabs.count()).toBeGreaterThan(2)
  18 |   // Every panel renders without crashing.
  19 |   for (let i = 0; i < (await tabs.count()); i++) {
  20 |     await tabs.nth(i).click()
  21 |     await expect(page.locator('.kitr-dt-body')).not.toContainText('Panel crashed')
  22 |   }
  23 |   await page.keyboard.press('Control+Shift+K')
  24 |   await expect(panel).toBeHidden()
  25 |   await page.keyboard.press('Control+Shift+K')
  26 |   await expect(panel).toBeVisible()
  27 |   expect(pageErrors).toEqual([])
  28 | })
  29 | 
  30 | test('open state and tab persist across reloads', async ({ page }) => {
  31 |   await page.goto('/')
  32 |   await page.locator('.kitr-dt-trigger').click()
  33 |   const second = page.locator('.kitr-dt-tab').nth(1)
  34 |   const label = await second.textContent()
  35 |   await second.click()
  36 |   await page.reload()
> 37 |   await expect(page.locator('.kitr-dt-panel')).toBeVisible()
     |                                                ^ Error: expect(locator).toBeVisible() failed
  38 |   await expect(page.locator('.kitr-dt-tab-active')).toHaveText(label!)
  39 | })
  40 | 
  41 | test('the command palette filters and runs actions', async ({ page }) => {
  42 |   await page.goto('/')
  43 |   await expect(page.locator('.kitr-dt-trigger')).toBeVisible()
  44 |   await page.keyboard.press('Control+Shift+P')
  45 |   const input = page.getByPlaceholder('Type an action…')
  46 |   await expect(input).toBeFocused()
  47 |   await input.fill('open')
  48 |   const items = page.locator('.kitr-dt-palette-item')
  49 |   expect(await items.count()).toBeGreaterThan(0)
  50 |   await input.press('Enter')
  51 |   await expect(page.locator('.kitr-dt-palette')).toBeHidden()
  52 |   await expect(page.locator('.kitr-dt-panel')).toBeVisible()
  53 |   await page.keyboard.press('Control+Shift+P')
  54 |   await page.getByPlaceholder('Type an action…').fill('zzzz-no-match')
  55 |   await expect(page.getByText('No matches')).toBeVisible()
  56 |   await page.keyboard.press('Escape')
  57 |   await expect(page.locator('.kitr-dt-palette')).toBeHidden()
  58 | })
  59 | 
```