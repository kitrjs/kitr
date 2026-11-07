import { defineRoutes } from '@kitr/core'
import { createServer } from '@kitr/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defineChannel } from '../src'
import { ws } from '../src/routes'

const chat = defineChannel<{ room: string }>({
  name: 'chat',
  events: { message: {} },
})

describe('realtime routes extension', () => {
  const routes = defineRoutes([ws], (r) =>
    r.group('/api', (api) =>
      api
        .ws('/ws', {
          channels: [chat],
          authorize: (request) => ({ user: new URL(request.url).searchParams.get('user') }),
        })
        .sse('/events', { channels: [chat], keepAlive: 1000 }),
    ),
  )
  const server = createServer({ server: { healthPath: false }, logger: silent(), routes })
  let url = ''
  let close: () => Promise<void>

  beforeAll(async () => {
    const listening = await server.listen({ port: 0, host: '127.0.0.1' })
    url = listening.url
    close = listening.close
  })
  afterAll(async () => {
    await close()
  })

  it('records sockets as entries with full paths and channel names', () => {
    expect(routes.toJSON()).toMatchObject([
      {
        kind: 'ws',
        transport: 'websocket',
        path: '/api/ws',
        name: 'WS /api/ws',
        channels: ['chat'],
      },
      {
        kind: 'ws',
        transport: 'sse',
        path: '/api/events',
        name: 'SSE /api/events',
        channels: ['chat'],
      },
    ])
  })

  it('mounts the websocket endpoint and binds the first server as `realtime`', async () => {
    expect(server.app.container.has('realtime')).toBe(true)
    const socket = new WebSocket(`${url.replace(/^http/, 'ws')}/api/ws?user=u1`)
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true })
      socket.addEventListener('error', () => reject(new Error('socket failed to open')), {
        once: true,
      })
    })
    const reply = new Promise<any>((resolve) =>
      socket.addEventListener('message', (e) => resolve(JSON.parse(String(e.data))), {
        once: true,
      }),
    )
    socket.send(JSON.stringify({ t: 'sub', id: 's1', ch: 'chat', p: { room: 'a' } }))
    expect(await reply).toEqual({ t: 'ok', id: 's1', p: { room: 'a' } })
    const realtime = server.app.container.use('realtime')
    expect(realtime.use(chat, { room: 'a' }).size).toBe(1)
    socket.close()
    await new Promise((r) => setTimeout(r, 50))
  })

  it('mounts the server-sent events stream', async () => {
    const controller = new AbortController()
    const response = await fetch(`${url}/api/events`, { signal: controller.signal })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    controller.abort()
  })
})

function silent() {
  const noop = () => {}
  const l: any = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    time: async (_: string, fn: () => any) => fn(),
  }
  l.child = () => l
  return l
}
