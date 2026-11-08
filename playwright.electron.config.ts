import { defineConfig } from '@playwright/test'

/**
 * Electron smoke test: launches the packaged examples/desktop build (electron-builder --dir)
 * and exercises the secure-storage and notifications drivers through the real window.
 * Run it with `pnpm test:electron` after building (see the electron job in .github/workflows/ci.yml).
 */
export default defineConfig({
  testDir: 'tests/electron',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  workers: 1,
})
