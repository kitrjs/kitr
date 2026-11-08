import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against real builds of the examples (copied with fixtures by
 * tests/e2e/prepare.mjs, so the examples stay untouched kit output).
 *
 *   dashboard       SPA production build served by `kitr start site`
 *   dashboard-dev   the same app on the Vite dev server (`kitr dev site`) with devtools added
 *   dashboard-dev-phone  that dev server again, driven as an iPhone 14
 *   fullstack       TanStack Start build served by `kitr start site` (SSR, API, WebSockets)
 *   saas            the saas kit (cookie sessions, server-rendered guards) behind `kitr start site`
 *   site            kitr.dev: site/dist/client served the way site/nginx.conf serves it
 *   kit-site        the site kit (prerendered pages, a cookie locale) behind `kitr start site`
 *   kit-realtime    the realtime kit, two browser pages chatting over its WebSocket channel
 *   kit-realtime-sse  the same kit switched to Server-Sent Events (fixtures/realtime/variant-sse.mjs)
 *
 * With SITE_URL set (the scheduled site-live workflow), only the site checks run, against it.
 */
const root = fileURLToPath(new URL('.', import.meta.url))
const apps = join(tmpdir(), 'kitr-e2e-apps')
const kitr = `node ${join(root, 'packages/kitr/bin/kitr.mjs')}`
const ports = {
  dashboard: 4410,
  dashboardDev: 4411,
  fullstack: 4412,
  site: 4413,
  saas: 4414,
  kitSite: 4415,
  kitRealtime: 4416,
  kitRealtimeSse: 4417,
}
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
      // The same dev server on an iPhone 14 (touch, the bottom sheet); the spec skips the desktop-only cases.
      name: 'dashboard-dev-phone',
      testMatch: 'devtools.spec.ts',
      use: {
        ...devices['iPhone 14'],
        // The device preset asks for WebKit; the CDP touch gestures and the suite's browser are Chromium.
        defaultBrowserType: 'chromium',
        baseURL: `http://127.0.0.1:${ports.dashboardDev}`,
      },
    },
    {
      name: 'fullstack',
      testMatch: 'fullstack.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.fullstack}` },
    },
    {
      name: 'saas',
      testMatch: 'saas.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.saas}` },
    },
    {
      name: 'kit-site',
      testMatch: 'kit-site.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.kitSite}` },
    },
    {
      name: 'kit-realtime',
      testMatch: 'kit-realtime.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.kitRealtime}` },
    },
    {
      name: 'kit-realtime-sse',
      testMatch: 'kit-realtime.spec.ts',
      use: { baseURL: `http://127.0.0.1:${ports.kitRealtimeSse}` },
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
        {
          command: `node tests/e2e/prepare.mjs saas saas --build && cd ${apps}/saas && ${kitr} start site --host 127.0.0.1 --port ${ports.saas}`,
          url: `http://127.0.0.1:${ports.saas}/api/health`,
          timeout: 300_000,
          reuseExistingServer: !process.env.CI,
          // Production boot wants a real secret and a mail transport; these are throwaway values.
          env: {
            SESSION_SECRET: 'e2e-session-secret-at-least-32-characters-long',
            RESEND_API_KEY: 'e2e-not-used',
            APP_URL: `http://127.0.0.1:${ports.saas}`,
          },
        },
        {
          command: `node tests/e2e/prepare.mjs site kit-site --build && cd ${apps}/kit-site && ${kitr} start site --host 127.0.0.1 --port ${ports.kitSite}`,
          url: `http://127.0.0.1:${ports.kitSite}/api/health`,
          timeout: 300_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node tests/e2e/prepare.mjs realtime kit-realtime --build && cd ${apps}/kit-realtime && ${kitr} start site --host 127.0.0.1 --port ${ports.kitRealtime}`,
          url: `http://127.0.0.1:${ports.kitRealtime}/api/health`,
          timeout: 300_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `node tests/e2e/prepare.mjs realtime kit-realtime-sse --build --variant sse && cd ${apps}/kit-realtime-sse && ${kitr} start site --host 127.0.0.1 --port ${ports.kitRealtimeSse}`,
          url: `http://127.0.0.1:${ports.kitRealtimeSse}/api/health`,
          timeout: 300_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
})
