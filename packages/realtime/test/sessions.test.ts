import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { H3 } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineChannel } from '../src'
import { createRealtimeServer, createSocketServer } from '../src/server'
import { createSseServer } from '../src/sse-server'

const feed = defineChannel<{ id: string }>({
  name: 'feed',
  events: { posted: {} },
})

describe('closeSessions over WebSocket', () => {
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  const sockets = createSocketServer({
    channels: [feed],
    authorize: (request) => {
      const userId = new URL(request.url).searchParams.get('user')
      return userId ? { userId } : false
    },
  })
  sockets.attach(server, '/live')
  let base = ''
  let close: () => Promise<void>
  beforeAll(async () => {
    const l = await server.listen({ port: 0, host: '127.0.0.1' })
    base = l.url.replace(/^http/, 'ws')
    close = l.close
  })
  afterAll(() => close())

  const open = async (user: string) => {
    const ws = new WebSocket(`${base}/live?user=${user}`)
    const received: unknown[] = []
    const closed = new Promise<{ code: number; reason: string }>((resolve) =>
      ws.addEventListener('close', (e) => resolve({ code: e.code, reason: e.reason })),
    )
    ws.addEventListener('message', (e) => received.push(JSON.parse(String(e.data))))
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.send(JSON.stringify({ t: 'sub', id: '1', ch: 'feed', p: { id: 'a' } }))
    await vi.waitFor(() => expect(received).toContainEqual({ t: 'ok', id: '1', p: { id: 'a' } }))
    return { ws, received, closed }
  }

  it('closes the sockets of one user, stops their events and leaves the others alone', async () => {
    const ann = await open('ann')
    const ann2 = await open('ann')
    const bob = await open('bob')
    expect(sockets.connections).toBe(3)

    expect(sockets.closeSessions('ann')).toBe(2)
    expect(await ann.closed).toEqual({ code: 4401, reason: 'Session revoked' })
    await ann2.closed
    expect(sockets.connections).toBe(1)

    sockets.use(feed, { id: 'a' }).emit('posted', { n: 1 })
    await vi.waitFor(() =>
      expect(bob.received).toContainEqual(expect.objectContaining({ t: 'ev', ev: 'posted' })),
    )
    expect(ann.received.filter((m) => (m as { t: string }).t === 'ev')).toEqual([])
    expect(sockets.closeSessions('ann')).toBe(0)
    bob.ws.close()
  })

  it('takes the owner from the context with `identify`', async () => {
    const custom = createSocketServer({
      channels: [feed],
      authorize: () => ({ account: { slug: 'acme' } }),
      identify: (ctx) => (ctx as { account: { slug: string } }).account.slug,
    })
    const app = createServer({ logger: silentLogger, server: { healthPath: false } })
    custom.attach(app, '/ws')
    const l = await app.listen({ port: 0, host: '127.0.0.1' })
    try {
      const ws = new WebSocket(`${l.url.replace(/^http/, 'ws')}/ws`)
      await new Promise((r) => ws.addEventListener('open', r, { once: true }))
      await vi.waitFor(() => expect(custom.connections).toBe(1))
      expect(custom.closeSessions('other')).toBe(0)
      expect(custom.closeSessions('acme')).toBe(1)
    } finally {
      await l.close()
    }
  })

  it('is on the transport-neutral server too', () => {
    const realtime = createRealtimeServer({ channels: [feed] })
    expect(realtime.closeSessions('nobody')).toBe(0)
  })
})

describe('closeSessions over SSE', () => {
  it('ends the stream of the revoked user', async () => {
    const sse = createSseServer({
      channels: [feed],
      authorize: (request) => ({ id: new URL(request.url).searchParams.get('user') }),
    })
    const app = new H3()
    app.get('/events', sse.handler)
    const open = async (user: string) => {
      const res = await app.fetch(new Request(`http://x/events?user=${user}`))
      const reader = res.body!.getReader()
      const done = reader.read().then(async function drain(chunk): Promise<void> {
        if (chunk.done) return
        return reader.read().then(drain)
      })
      return done
    }
    const ended = open('ann')
    const other = open('bob')
    await vi.waitFor(() => expect(sse.connections).toBe(2))

    expect(sse.closeSessions('ann')).toBe(1)
    await ended
    expect(sse.connections).toBe(1)
    expect(sse.closeSessions('ann')).toBe(0)
    expect(sse.closeSessions('bob')).toBe(1)
    await other
    expect(sse.connections).toBe(0)
  })
})
