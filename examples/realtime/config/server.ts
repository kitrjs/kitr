import { defineConfig } from 'kitr/server'

export default defineConfig({
  port: Number(process.env.PORT ?? 3000),
  host: '0.0.0.0',
  healthPath: '/healthz',
  bodyLimit: 1024 * 1024,
})
