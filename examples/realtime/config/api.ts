import { defineConfig } from '@kitr/api'

export default defineConfig({
  prefix: '/api',
  openapi: { path: 'openapi.json', title: 'realtime API', version: '0.1.0' },
})
