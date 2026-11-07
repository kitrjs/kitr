import { defineConfig } from 'kitr/socket'

export default defineConfig({
  path: '/api/ws',
  transport: 'websocket',
})
