import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  // websocket (default), socket.io or sse: the channels and hooks stay the same.
  transport: 'websocket',
  path: '/api/ws',
})
