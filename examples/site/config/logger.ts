import { defineConfig } from 'kitr/logger'

export default defineConfig({
  name: 'app',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
  // 'pretty' in dev, 'json' in production by default.
})
