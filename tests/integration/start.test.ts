import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { copyExample, freePort, kitr, kitrBin, remove, startProcess } from './helpers'

/**
 * `pnpm build && pnpm start` on every web kit, the way a user deploys it: the production build
 * must boot and answer its first page and its API, with the environment a production start needs
 * (a cookie secret, a mail transport) and nothing else.
 */
const kits: Array<{ example: string; page: string; api?: string; env?: Record<string, string> }> = [
  { example: 'app', page: '/' },
  { example: 'dashboard', page: '/' },
  { example: 'fullstack', page: '/', api: '/api/health' },
  {
    example: 'saas',
    page: '/sign-in',
    api: '/api/health',
    env: { SESSION_SECRET: 'integration-test-secret-at-least-32-chars', MAIL_TRANSPORT: 'discard' },
  },
  { example: 'site', page: '/', api: '/api/health' },
  { example: 'realtime', page: '/', api: '/api/health' },
]

describe('production start', () => {
  const dirs: string[] = []
  beforeAll(() => {
    for (const kit of kits) dirs.push(copyExample(kit.example))
  }, 180_000)
  afterAll(() => {
    for (const dir of dirs) remove(dir)
  })

  it.each(kits.map((kit, i) => [kit.example, kit, i] as const))(
    '%s builds, then kitr start serves the first page and the API',
    async (_name, kit, i) => {
      const dir = dirs[i]!
      kitr(dir, 'build')
      const sitePort = await freePort()
      const apiPort = await freePort()
      const site = `http://127.0.0.1:${sitePort}`
      const server = await startProcess(
        dir,
        process.execPath,
        [kitrBin, 'start'],
        `${site}${kit.page}`,
        {
          LOG_LEVEL: 'warn',
          KITR_SITE_PORT: String(sitePort),
          KITR_SITE_HOST: '127.0.0.1',
          KITR_API_PORT: String(apiPort),
          KITR_API_HOST: '127.0.0.1',
          ...kit.env,
        },
        90_000,
      )
      try {
        const page = await fetch(`${site}${kit.page}`)
        expect(page.status, server.output()).toBe(200)
        expect(await page.text()).toContain('<html')
        if (kit.api) {
          // The two platforms boot side by side; the site may answer before the API listens.
          const api = await waitFor(`http://127.0.0.1:${apiPort}${kit.api}`)
          expect(api.status, server.output()).toBe(200)
        }
        expect(server.output()).not.toMatch(/error|✖/i)
      } finally {
        await server.stop()
      }
    },
    300_000,
  )
})

async function waitFor(url: string, timeoutMs = 30_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return await fetch(url)
    } catch (error) {
      if (Date.now() > deadline) throw error
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}
