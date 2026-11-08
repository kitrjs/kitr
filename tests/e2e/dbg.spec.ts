import { test } from '@playwright/test'
for (const variant of ['big-handle', 'header-start']) test(`dbg ${variant}`, async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('.kitr-dt-trigger').tap()
  await page.evaluate((v) => {
    const host = document.querySelector('[data-kitr-devtools]')!.shadowRoot!
    if (v === 'big-handle') (host.querySelector('.kitr-dt-handle') as HTMLElement).style.height = '30px'
    
    for (const t of ['pointerdown','pointermove','pointerup','pointercancel'])
      window.addEventListener(t, (e: any) => console.log(t, Math.round(e.clientY)), true)
  }, variant)
  page.on('console', (m) => console.log(variant, m.text()))
  const h = (await page.locator('.kitr-dt-handle').boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const x = variant === 'header-start' ? 230 : h.x + h.width / 2, y = variant === 'header-start' ? h.y + 24 : h.y + h.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
  for (let dy = 20; dy <= 100; dy += 20) { await page.waitForTimeout(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy, id: 0 }] }) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
})
