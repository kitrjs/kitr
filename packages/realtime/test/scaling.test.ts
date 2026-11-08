import { createServer } from '@kitr/server'
import { H3 } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestRedis, uniquePrefix } from '../../../tests/setup/redis'
import { defineChannel } from '../src'
import { createMemoryRealtimeAdapter, createRedisRealtimeAdapter } from '../src/adapter'
import { createSocketServer } from '../src/server'
import { createSseServer } from '../src/sse-server'

const board = defineChannel<{ id: string }>({ name: 'board', events: { updated: {} } })

function silent() {
  const noop = () => {}
  const l: any = { level: 'silent', trace: noop, debug: noop, info: noop, warn: noop, error: noop }
  l.fatal = noop
  l.child = () => l
  return l
}

async function openSocket(url: string) {
  const ws = new WebSocket(url)
  const messages: any[] = []
  ws.addEventListener('message', (e) => messages.push(JSON.parse(String(e.data))))
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  return { ws, messages }
}

describe('memory adapter', () => {
  it('fans out to local handlers and counts them', () => {
    const adapter = createMemoryRealtimeAdapter()
    const seen: string[] = []
    const off = adapter.subscribe('t', (p) => seen.push(`a:${p}`)) as () => void
    adapter.subscribe('t', (p) => seen.push(`b:${p}`))
    expect(adapter.publish('t', 'x')).toBe(2)
    off()
    expect(adapter.publish('t', 'y')).toBe(1)
    expect(adapter.publish('nobody', 'z')).toBe(0)
    expect(seen).toEqual(['a:x', 'b:x', 'b:y'])
  })
})

describe('redis adapter', () => {
  it('waits for the subscriber connection to be ready before its first SUBSCRIBE', async () => {
    // ioredis refuses its own ready check once a SUBSCRIBE has gone out, and drops the subscription.
    const calls: string[] = []
    let ready: () => void = () => {}
    const subscriber: any = {
      status: 'connecting',
      once: (_: 'ready', l: () => void) => {
        ready = l
      },
      on: () => {},
      subscribe: async (channel: string) => calls.push(`subscribe ${channel}`),
      unsubscribe: async () => {},
      quit: async () => {},
    }
    const adapter = createRedisRealtimeAdapter(
      { ...subscriber, duplicate: () => subscriber },
      {
        subscriber,
        prefix: 'p:',
      },
    )
    const subscribed = adapter.subscribe('board', () => {})
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(calls).toEqual([])
    subscriber.status = 'ready'
    ready()
    await subscribed
    expect(calls).toEqual(['subscribe p:board'])
  })
})

describe('two WebSocket instances over Redis', () => {
  const prefix = uniquePrefix('rt')
  const adapters = [
    createRedisRealtimeAdapter(createTestRedis(), { prefix }),
    createRedisRealtimeAdapter(createTestRedis(), { prefix }),
  ]
  const instances = adapters.map((adapter) => {
    const server = createServer({ server: { healthPath: false }, logger: silent() })
    const sockets = createSocketServer({ channels: [board], adapter })
    sockets.attach(server, '/ws')
    return { server, sockets, url: '', close: async () => {} }
  })

  beforeAll(async () => {
    for (const i of instances) {
      const listening = await i.server.listen({ port: 0, host: '127.0.0.1' })
      i.url = `${listening.url.replace(/^http/, 'ws')}/ws`
      i.close = listening.close
    }
  })
  afterAll(async () => {
    for (const i of instances) await i.close()
    for (const a of adapters) await a.close?.()
  })

  it('delivers an emit on instance A to a client connected to instance B', async () => {
    const [a, b] = instances as [(typeof instances)[0], (typeof instances)[0]]
    const ada = await openSocket(a.url)
    const linus = await openSocket(b.url)
    ada.ws.send(JSON.stringify({ t: 'sub', id: 's1', ch: 'board', p: { id: 'prj_1' } }))
    linus.ws.send(JSON.stringify({ t: 'sub', id: 's1', ch: 'board', p: { id: 'prj_1' } }))
    await vi.waitFor(() => {
      expect(ada.messages).toEqual([{ t: 'ok', id: 's1', p: { id: 'prj_1' } }])
      expect(linus.messages).toEqual([{ t: 'ok', id: 's1', p: { id: 'prj_1' } }])
    })

    a.sockets.use(board, { id: 'prj_1' }).emit('updated', { name: 'Apollo' })
    const event = { t: 'ev', ch: 'board', p: { id: 'prj_1' }, ev: 'updated', d: { name: 'Apollo' } }
    await vi.waitFor(() => {
      expect(ada.messages).toContainEqual(event)
      expect(linus.messages).toContainEqual(event)
    })
    // Each instance counts only its own subscribers.
    expect(a.sockets.use(board, { id: 'prj_1' }).size).toBe(1)
    expect(b.sockets.use(board, { id: 'prj_1' }).size).toBe(1)

    // After Linus leaves, B no longer receives the topic; Ada still does, exactly once.
    linus.ws.send(JSON.stringify({ t: 'unsub', id: 's1' }))
    await vi.waitFor(() => expect(b.sockets.use(board, { id: 'prj_1' }).size).toBe(0))
    b.sockets.use(board, { id: 'prj_1' }).emit('updated', { name: 'Gemini' })
    await vi.waitFor(() =>
      expect(ada.messages.filter((m) => m.d?.name === 'Gemini')).toHaveLength(1),
    )
    expect(linus.messages.filter((m) => m.d?.name === 'Gemini')).toHaveLength(0)
    ada.ws.close()
    linus.ws.close()
  })
})

describe('two SSE instances over Redis', () => {
  it('forwards a control POST that lands on the other instance to the stream', async () => {
    const prefix = uniquePrefix('sse')
    const adapters = [
      createRedisRealtimeAdapter(createTestRedis(), { prefix }),
      createRedisRealtimeAdapter(createTestRedis(), { prefix }),
    ]
    const servers = adapters.map((adapter) => {
      const sse = createSseServer({ channels: [board], adapter, keepAlive: 60_000 })
      const h3 = new H3()
      h3.get('/events', sse.handler)
      h3.post('/events', sse.handler)
      return { sse, h3 }
    })
    const [a, b] = servers as [(typeof servers)[0], (typeof servers)[0]]

    // Open the stream on A and read frames as they arrive.
    const abort = new AbortController()
    const res = await a.h3.fetch(new Request('http://app.test/events', { signal: abort.signal }))
    const frames: Array<{ event?: string; data: string }> = []
    void (async () => {
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: '', done: true }))
        if (done) return
        buffer += value
        let end = buffer.indexOf('\n\n')
        while (end >= 0) {
          const block = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          const data = /^data: (.*)$/m.exec(block)?.[1]
          if (data !== undefined) frames.push({ event: /^event: (.*)$/m.exec(block)?.[1], data })
          end = buffer.indexOf('\n\n')
        }
      }
    })()
    await vi.waitFor(() => expect(frames[0]?.event).toBe('kitr:open'))
    const id = frames[0]!.data

    // The subscribe POST reaches B, which has no such stream, and forwards it to A.
    const post = (body: unknown, to = b) =>
      to.h3.fetch(
        new Request('http://app.test/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-kitr-connection': id },
          body: JSON.stringify(body),
        }),
      )
    expect((await post({ t: 'sub', id: 's1', ch: 'board', p: { id: 'prj_1' } })).status).toBe(204)
    await vi.waitFor(() => expect(a.sse.use(board, { id: 'prj_1' }).size).toBe(1))

    // An emit on B reaches the stream on A.
    b.sse.use(board, { id: 'prj_1' }).emit('updated', { name: 'Apollo' })
    await vi.waitFor(() =>
      expect(frames.map((f) => f.data)).toContain(
        JSON.stringify({
          t: 'ev',
          ch: 'board',
          p: { id: 'prj_1' },
          ev: 'updated',
          d: { name: 'Apollo' },
        }),
      ),
    )

    // A connection id no instance holds is still 410, so the client opens a new stream.
    const stale = await b.h3.fetch(
      new Request('http://app.test/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-kitr-connection': 'gone' },
        body: JSON.stringify({ t: 'ping' }),
      }),
    )
    expect(stale.status).toBe(410)

    abort.abort()
    for (const adapter of adapters) await adapter.close?.()
  })
})
