import { defineConfig } from 'vitest/config'

/**
 * The default test run: every package's unit tests (node and DOM), the
 * type-level tests, and each example's own suite. Slower suites live beside it:
 * `vitest.integration.config.ts` (CLI kits, servers, sockets) and Playwright (`tests/e2e`).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/**/src/**/*.test.ts', 'packages/**/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'dom',
          include: ['packages/**/src/**/*.test.tsx', 'packages/**/test/**/*.test.tsx'],
          environment: 'happy-dom',
          setupFiles: ['./tests/setup/dom.ts'],
        },
      },
      {
        test: {
          name: 'types',
          include: [],
          typecheck: {
            enabled: true,
            only: true,
            include: ['packages/**/test/**/*.test-d.ts', 'packages/**/test/**/*.test-d.tsx'],
            tsconfig: './tests/tsconfig.json',
          },
        },
      },
      'examples/*/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.test-d.{ts,tsx}',
        // Re-export shims: one line each, nothing to run.
        'packages/kitr/src/**',
        // Native shells and platform scaffolds: exercised by their platform, not by Node.
        'packages/desktop/src/main.ts',
        'packages/desktop/src/preload.ts',
        'packages/desktop/src/index.ts',
        'packages/tauri/src/index.ts',
        'packages/mobile/src/index.ts',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
    },
  },
})
