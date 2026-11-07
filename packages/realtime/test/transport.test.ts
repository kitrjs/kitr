import { createApp } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { describe, expect, it } from 'vitest'
import { defineChannel } from '../src'
import { createRealtimeServer, realtimeProvider } from '../src/server'
import { sseProvider } from '../src/sse-server'

const ping = defineChannel({ name: 'ping', events: { pong: {} } })

const server = () => createServer({ logger: silentLogger, server: { healthPath: false } })

// Regression: `transport` in config/realtime.ts only changed the client. The server stayed a
// WebSocket server, so `transport: 'sse'` left the client posting to a route that did not exist.
describe('createRealtimeServer follows config/realtime.ts', () => {
  it('serves SSE at the configured path when transport is sse', async () => {
    const s = server()
    const realtime = createRealtimeServer({ transport: 'sse', path: '/rt', channels: [ping] })
    expect(realtime.transport).toBe('sse')
    realtime.attach(s)
    const abort = new AbortController()
    const res = await s.h3.fetch(new Request('http://x/rt', { signal: abort.signal }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    abort.abort()
    await res.body?.cancel().catch(() => {})
  })

  it('stays WebSocket by default, attached at the configured path', async () => {
    const s = server()
    const realtime = createRealtimeServer({ path: '/socket', channels: [ping] })
    expect(realtime.transport).toBe('websocket')
    realtime.attach(s)
    expect(s.config.websocket).toBe(true)
    // A plain GET (no upgrade) reaches the WebSocket route instead of a 404.
    const res = await s.h3.fetch(new Request('http://x/socket'))
    expect(res.status).not.toBe(404)
    expect((await s.h3.fetch(new Request('http://x/ws'))).status).toBe(404)
  })

  it('points socket.io users at attachSocketIo', () => {
    expect(() => createRealtimeServer({ transport: 'socket.io', channels: [ping] })).toThrow(
      /attachSocketIo/,
    )
  })

  it('emits through either transport with the same API', () => {
    for (const transport of ['websocket', 'sse'] as const) {
      const realtime = createRealtimeServer({ transport, channels: [ping] })
      expect(realtime.use(ping, undefined).size).toBe(0)
      expect(() => realtime.use(ping, undefined).emit('pong', null)).not.toThrow()
      expect(realtime.connections).toBe(0)
    }
  })
})

describe('realtimeProvider', () => {
  it('reads transport and path from config/realtime.ts', async () => {
    const app = createApp({
      environment: 'server',
      config: { realtime: { transport: 'sse', path: '/from-config' } },
      providers: [realtimeProvider({ channels: [ping] })],
    })
    await app.boot()
    const realtime = app.container.use('realtime')
    expect(realtime.transport).toBe('sse')
    const s = server()
    realtime.attach(s)
    const abort = new AbortController()
    const res = await s.h3.fetch(new Request('http://x/from-config', { signal: abort.signal }))
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    abort.abort()
    await res.body?.cancel().catch(() => {})
  })

  it('sseProvider binds an SSE server whatever the config says', async () => {
    const app = createApp({
      environment: 'server',
      config: { realtime: { transport: 'websocket' } },
      providers: [sseProvider({ channels: [ping] })],
    })
    await app.boot()
    expect(app.container.use('realtime').transport).toBe('sse')
  })
})
