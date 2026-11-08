import { schemaFrom } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  channel,
  createSocketClient,
  defineChannel,
  parseMessage,
  type SocketTransport,
  stableStringify,
  topicFor,
} from '../src'
import { createSocketServer } from '../src/server'

describe('protocol', () => {
  it('stableStringify ignores key order and handles nesting', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}',
    )
    expect(topicFor('rooms', { b: 2, a: 1 })).toBe(topicFor('rooms', { a: 1, b: 2 }))
    expect(topicFor('rooms', undefined)).toBe('rooms:null')
  })

  it('parseMessage accepts strings, buffers and objects and rejects junk', () => {
    expect(parseMessage('{"t":"pong"}')).toEqual({ t: 'pong' })
    expect(parseMessage(new TextEncoder().encode('{"t":"ok"}').buffer)).toEqual({ t: 'ok' })
    expect(parseMessage({ t: 'x' })).toEqual({ t: 'x' })
    expect(parseMessage('{oops')).toBeNull()
    expect(parseMessage(42)).toBeNull()
  })
})

const roomParams = schemaFrom((p: any) => {
  if (typeof p?.room !== 'string') return { issues: [{ message: 'room required', path: ['room'] }] }
  return { room: p.room.toLowerCase() }
})
const chat = defineChannel<{ room: string }>({
  name: 'chat',
  params: roomParams,
  events: {
    message: {
      schema: schemaFrom((d: any) =>
        typeof d?.text === 'string' ? d : { issues: [{ message: 'text required' }] },
      ),
      effects: (data: { text: string }, { room }) => ({
        set: [{ key: ['chat', room, 'last'], data: data.text }],
      }),
    },
    cleared: {},
  },
  authorize: (_params, ctx) => (ctx as { user: string }).user !== 'muted',
  onMessage: (event, data, params, ctx) => void inbox.push({ event, data, params, ctx }),
})
const inbox: unknown[] = []

describe('socket client ⇄ server', () => {
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  const sockets = createSocketServer({
    channels: [chat],
    authorize: (request) => {
      const user = new URL(request.url).searchParams.get('user')
      if (user === 'blocked') return false
      return { user: user ?? 'anon' }
    },
  })
  sockets.attach(server, '/live')
  let base = ''
  let close: () => Promise<void>
  const clients: SocketTransport[] = []
  const connect = (user = 'ann', onError?: (e: unknown) => void) => {
    const t = createSocketClient({
      url: `${base}/live?user=${user}`,
      reconnect: { maxRetries: 0 },
      onError: onError as any,
    })
    clients.push(t)
    return t
  }
  const opened = (t: SocketTransport) =>
    t.status === 'open'
      ? Promise.resolve()
      : new Promise<void>((r) => t.onStatus((s) => s === 'open' && r()))

  beforeAll(async () => {
    const l = await server.listen({ port: 0, host: '127.0.0.1' })
    base = l.url.replace(/^http/, 'ws')
    close = l.close
  })
  afterAll(async () => {
    for (const c of clients) c.close()
    await close()
  })

  it('delivers validated events to subscribers with effects, keyed by normalised params', async () => {
    const t = connect()
    const handle = channel(t, chat)
    const sub = handle.subscription()
    const events: unknown[] = []
    const unsubscribe = sub.subscribe({ room: 'Lobby' }, { next: (e) => events.push(e) })
    await opened(t)
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'lobby' }).size).toBe(1))

    sockets.use(chat, { room: 'lobby' }).emit('message', { text: 'hi' })
    await vi.waitFor(() => expect(events).toEqual([{ event: 'message', data: { text: 'hi' } }]))
    expect(
      sub.effects!({ event: 'message', data: { text: 'hi' } } as any, { room: 'lobby' }),
    ).toEqual({
      set: [{ key: ['chat', 'lobby', 'last'], data: 'hi' }],
    })
    expect(handle.key({ room: 'lobby' })).toEqual(['realtime', 'chat', { room: 'lobby' }])
    unsubscribe()
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'lobby' }).size).toBe(0))
  })

  it('reports payloads that fail the event schema instead of passing them on', async () => {
    const t = connect()
    const next = vi.fn()
    const error = vi.fn()
    channel(t, chat).subscription().subscribe({ room: 'bad' }, { next, error })
    await opened(t)
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'bad' }).size).toBe(1))
    sockets.use(chat, { room: 'bad' }).emit('message', { nope: true } as any)
    sockets.use(chat, { room: 'bad' }).emit('unknown-event' as any, {})
    sockets.use(chat, { room: 'bad' }).emit('cleared', null)
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith({ event: 'cleared', data: null }))
    expect(next).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('rejects invalid params and unauthorised subscriptions with the subscription error', async () => {
    const t = connect('muted')
    const errors: any[] = []
    t.subscribe(
      'chat',
      { room: 'x' },
      () => {},
      (e) => errors.push(e),
    )
    t.subscribe(
      'chat',
      { nope: 1 },
      () => {},
      (e) => errors.push(e),
    )
    await vi.waitFor(() => expect(errors).toHaveLength(2))
    expect(errors.map((e) => e.code).sort()).toEqual(['FORBIDDEN', 'VALIDATION'])
  })

  it('sends client messages up to onMessage with the connection context', async () => {
    const t = connect('bob')
    await opened(t)
    channel(t, chat).send({ room: 'General' }, 'typing', { on: true })
    await vi.waitFor(() =>
      expect(inbox).toContainEqual({
        event: 'typing',
        data: { on: true },
        params: { room: 'general' },
        ctx: { user: 'bob' },
      }),
    )
  })

  it('routes errors without a subscription to onError', async () => {
    const onError = vi.fn()
    const t = connect('carol', onError)
    await opened(t)
    t.send('missing-channel', null, 'x', null)
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' })),
    )
  })

  it('refuses upgrades the authorize hook rejects', async () => {
    const ws = new WebSocket(`${base}/live?user=blocked`)
    const outcome = await new Promise((resolve) => {
      ws.addEventListener('open', () => resolve('open'))
      ws.addEventListener('error', () => resolve('rejected'))
    })
    expect(outcome).toBe('rejected')
  })

  it('answers pings and ignores malformed frames', async () => {
    const ws = new WebSocket(`${base}/live?user=dan`)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    const replies: unknown[] = []
    ws.addEventListener('message', (e) => replies.push(JSON.parse(String(e.data))))
    ws.send('not json')
    ws.send(JSON.stringify({ t: 'ping' }))
    await vi.waitFor(() => expect(replies).toEqual([{ t: 'pong' }]))
    ws.close()
  })

  it('cleans up topics and connections when a client disconnects', async () => {
    const t = connect('erin')
    t.subscribe('chat', { room: 'temp' }, () => {})
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'temp' }).size).toBe(1))
    const before = sockets.connections
    t.close()
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'temp' }).size).toBe(0))
    await vi.waitFor(() => expect(sockets.connections).toBe(before - 1))
  })

  it('a re-used subscription id does not leak the old topic', async () => {
    const ws = new WebSocket(`${base}/live?user=fay`)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.send(JSON.stringify({ t: 'sub', id: 'same', ch: 'chat', p: { room: 'one' } }))
    ws.send(JSON.stringify({ t: 'sub', id: 'same', ch: 'chat', p: { room: 'two' } }))
    await vi.waitFor(() => expect(sockets.use(chat, { room: 'two' }).size).toBe(1))
    expect(sockets.use(chat, { room: 'one' }).size).toBe(0)
    ws.close()
  })
})
