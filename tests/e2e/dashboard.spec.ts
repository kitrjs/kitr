import { expect, test } from '@playwright/test'
import { watchForErrors } from './utils'

test('renders the home page with no errors', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'dashboard' })).toBeVisible()
  expect(errors).toEqual([])
})

test('navigates client-side without a full reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => ((window as any).__marker = 1))
  await page.getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByText('About', { exact: true }).last()).toBeVisible()
  expect(await page.evaluate(() => (window as any).__marker)).toBe(1)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'dashboard' })).toBeVisible()
})

test('deep links load directly', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/about')
  await expect(page.locator('main')).toHaveText('About')
  expect(errors).toEqual([])
})

test('unknown routes show the not-found page, not a crash', async ({ page }) => {
  await page.goto('/definitely/not/here')
  await expect(page.locator('body')).toContainText(/not found/i)
})

test('production build ships no devtools', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'dashboard' })).toBeVisible()
  await expect(page.locator('[data-kitr-devtools]')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+K')
  await expect(page.locator('[data-kitr-devtools]')).toHaveCount(0)
})

test.describe('a mutation', () => {
  test('a note added on the page is still there after a reload', async ({ page }) => {
    const errors = watchForErrors(page)
    await page.goto('/e2e/notes')
    await page.evaluate(() => localStorage.removeItem('e2e:notes'))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(0)

    await page.getByLabel('Note').fill('buy milk')
    await page.getByRole('button', { name: 'Add note' }).click()
    await page.getByLabel('Note').fill('write the report')
    await page.getByRole('button', { name: 'Add note' }).click()
    await expect(page.getByRole('listitem')).toHaveText(['buy milk', 'write the report'])
    await expect(page.getByLabel('Note')).toHaveValue('')

    await page.reload()
    await expect(page.getByRole('listitem')).toHaveText(['buy milk', 'write the report'])
    // Another tab of the same browser reads the same record.
    const other = await page.context().newPage()
    await other.goto('/e2e/notes')
    await expect(other.getByRole('listitem')).toHaveText(['buy milk', 'write the report'])
    expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
  })

  test('an empty note is not added', async ({ page }) => {
    await page.goto('/e2e/notes')
    await page.evaluate(() => localStorage.removeItem('e2e:notes'))
    await page.reload()
    await page.getByRole('button', { name: 'Add note' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(0)
  })
})
