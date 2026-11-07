import { defineConfig } from 'vitest/config'

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
        },
      },
    ],
  },
})
