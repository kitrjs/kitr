import { defineConfig } from '@kitr/realtime'

export default defineConfig({
  path: '/api/ws',
  transport: 'websocket',
})
