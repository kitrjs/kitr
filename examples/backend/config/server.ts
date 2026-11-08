import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimit: 1024 * 1024,
})
