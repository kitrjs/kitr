import { expect, type Page, test } from '@playwright/test'
import { watchForErrors } from './utils'

/**
 * The realtime kit (examples/realtime) with two visitors in one room. Runs twice: over the
 * WebSocket the kit ships and over Server-Sent Events (the `kit-realtime-sse` project, the same
 * kit switched in config/realtime.ts), so the same expectations hold for both transports.
 */

/** Open the chat as `name` and wait until its live connection is up. */
async function join(page: Page, name: string, path = '/') {
  await page.goto(path)
  await expect(page.getByText('live', { exact: true })).toBeVisible()
  await page.getByLabel('Your name').fill(name)
}

async function say(page: Page, text: string) {
  await page.getByLabel('Message').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('a message sent in one browser appears in the other, live', async ({ browser, baseURL }) => {
  const alice = await (await browser.newContext({ baseURL })).newPage()
  const bob = await (await browser.newContext({ baseURL })).newPage()
  const errors = [watchForErrors(alice), watchForErrors(bob)]
  await Promise.all([join(alice, 'Alice'), join(bob, 'Bob')])

  const text = `hello from alice ${Date.now()}`
  await say(alice, text)
  // The sender sees it (the event refreshes the list) and so does the other page, which never reloaded.
  await expect(alice.getByText(text)).toBeVisible()
  await expect(bob.getByText(text)).toBeVisible()
  await expect(bob.locator('li', { hasText: text })).toContainText('Alice')

  // And the other way round.
  const reply = `hello back ${Date.now()}`
  await say(bob, reply)
  await expect(alice.getByText(reply)).toBeVisible()
  await expect(alice.locator('li', { hasText: reply })).toContainText('Bob')

  for (const list of errors) expect(list.filter((e) => !/favicon/.test(e))).toEqual([])
  await alice.context().close()
  await bob.context().close()
})

test('rooms are separate: a message does not reach a visitor in another room', async ({
  browser,
  baseURL,
}) => {
  const general = await (await browser.newContext({ baseURL })).newPage()
  const random = await (await browser.newContext({ baseURL })).newPage()
  await Promise.all([join(general, 'Gus', '/?room=general'), join(random, 'Ray', '/?room=random')])

  const text = `general only ${Date.now()}`
  await say(general, text)
  await expect(general.getByText(text)).toBeVisible()
  await random.waitForTimeout(500)
  await expect(random.getByText(text)).toHaveCount(0)
  await general.context().close()
  await random.context().close()
})

test('history is there for a visitor who joins later', async ({ browser, baseURL }) => {
  const early = await (await browser.newContext({ baseURL })).newPage()
  await join(early, 'Early', '/?room=help')
  const text = `before you came ${Date.now()}`
  await say(early, text)
  await expect(early.getByText(text)).toBeVisible()

  const late = await (await browser.newContext({ baseURL })).newPage()
  await join(late, 'Late', '/?room=help')
  await expect(late.getByText(text)).toBeVisible()
  await early.context().close()
  await late.context().close()
})

test('the connection comes back after the page loses it', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  const sender = await (await browser.newContext({ baseURL })).newPage()
  await Promise.all([join(page, 'Pat'), join(sender, 'Sam')])

  await context.setOffline(true)
  await context.setOffline(false)
  // Whatever the transport does while offline, the page ends up receiving live events again.
  await expect(async () => {
    const text = `after the blip ${Date.now()}`
    await say(sender, text)
    await expect(page.getByText(text)).toBeVisible({ timeout: 1_500 })
  }).toPass({ timeout: 20_000 })
  await context.close()
  await sender.context().close()
})

test('the page uses the transport its project configures', async ({ page }, testInfo) => {
  const sse = testInfo.project.name.endsWith('sse')
  const sockets: string[] = []
  const streams: string[] = []
  page.on('websocket', (ws) => sockets.push(new URL(ws.url()).pathname))
  page.on('request', (request) => {
    if (request.url().includes('/api/events')) streams.push(new URL(request.url()).pathname)
  })
  await join(page, 'Tess')
  if (sse) {
    expect(streams).toContain('/api/events')
    expect(sockets).toEqual([])
  } else {
    expect(sockets).toEqual(['/api/ws'])
    expect(streams).toEqual([])
  }
})
