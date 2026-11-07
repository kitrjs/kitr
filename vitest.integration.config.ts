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
  },
})
