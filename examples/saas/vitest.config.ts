import { defineConfig } from 'vitest/config'
import { kitr } from 'kitr/vite'

export default defineConfig({
  plugins: [kitr({ react: true, tailwind: false })],
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
})
