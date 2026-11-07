import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against real builds of the examples (copied with fixtures by
 * tests/e2e/prepare.mjs, so the examples stay untouched kit output).
 *
 *   dashboard       SPA production build served by `kitr start site`
 *   dashboard-dev   the same app on the Vite dev server (`kitr dev site`) with devtools added (a preview package)
 *   fullstack       TanStack Start build served by `kitr start site` (SSR, API, WebSockets)
 *   site            kitr.dev: site/dist/client served the way site/nginx.conf serves it
 *
 * With SITE_URL set (the scheduled site-live workflow), only the site checks run, against it.
 */
const root = fileURLToPath(new URL('.', import.meta.url))
const apps = join(tmpdir(), 'kitr-e2e-apps')
const kitr = `node ${join(root, 'packages/kitr/bin/kitr.mjs')}`
const ports = { dashboard: 4410, dashboardDev: 4411, fullstack: 4412, site: 4413 }
const siteUrl = process.env.SITE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: { trace: 'off', ...devices['Desktop Chrome'] },
  projects: [
    {
      name: 'site',
      testMatch: 'site.spec.ts',
      use: { baseURL: siteUrl ?? `http://127.0.0.1:${ports.site}` },
    },
    {
      name: 'dashboard',
      testMatch: 'dashboard.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.dashboard}` },
    },
    {
      name: 'dashboard-dev',
      testMatch: 'devtools.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.dashboardDev}` },
    },
    {
      name: 'fullstack',
      testMatch: 'fullstack.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.fullstack}` },
    },
  ],
  webServer: siteUrl
    ? []
    : [
        {
          command: `pnpm -C site build && node tests/e2e/site-server.mjs ${ports.site}`,
          url: `http://127.0.0.1:${ports.site}/llms.txt`,
          timeout: 300_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node tests/e2e/prepare.mjs dashboard dashboard --build && cd ${apps}/dashboard && ${kitr} start site --host 127.0.0.1 --port ${ports.dashboard}`,
          url: `http://127.0.0.1:${ports.dashboard}`,
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node tests/e2e/prepare.mjs dashboard dashboard-dev --add devtools && cd ${apps}/dashboard-dev && ${kitr} dev site --host 127.0.0.1 --port ${ports.dashboardDev}`,
          url: `http://127.0.0.1:${ports.dashboardDev}`,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node tests/e2e/prepare.mjs fullstack fullstack --build && cd ${apps}/fullstack && ${kitr} start site --host 127.0.0.1 --port ${ports.fullstack}`,
          url: `http://127.0.0.1:${ports.fullstack}/api/health`,
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
})
