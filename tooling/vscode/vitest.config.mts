import { defineConfig } from 'vitest/config'

/** Unit tests for the parts that never touch the VS Code API: parsers and the tree model. */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
