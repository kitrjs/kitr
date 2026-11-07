import { defineConfig } from 'vitest/config'

/**
 * Integration suites: real servers on real ports, real WebSockets, and the CLI
 * scaffolding every kit into a temp directory. Run with `pnpm test:integration`
 * after `pnpm build`.
 */
export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    // The suites also cover the preview packages (desktop, tauri, mobile, jobs...), which the CLI
    // refuses without it. One test checks the refusal with it unset.
    env: { KITR_PREVIEW: '1' },
  },
})
