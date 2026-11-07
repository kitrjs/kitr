import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { KitrError, schemaFrom } from '@kitr/core'
import { Server } from 'socket.io'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { channel, createSocketIoClient, defineChannel } from '../src/socket-io'
import { attachSocketIo } from '../src/socket-io-server'

const room = defineChannel<{ id: string }>({
  name: 'room',
  params: schemaFrom((p: any) =>
    typeof p?.id === 'string' ? { id: p.id.trim() } : { issues: [{ message: 'id', path: ['id'] }] },
  ),
  events: { said: {} },
  authorize: ({ id }, ctx) => id !== 'vip' || (ctx as any).role === 'admin',
  onMessage: (event, data, params, ctx) => void inbox.push({ event, data, params, ctx }),
})
const inbox: unknown[] = []

describe('socket.io transport', () => {
  let http: HttpServer
  let io: Server
  let url = ''
  let sockets: ReturnType<typeof attachSocketIo>
  const clients: Array<ReturnType<typeof createSocketIoClient>> = []
  const connect = (auth: Record<string, unknown> = {}) => {
    const c = createSocketIoClient({ url, auth, transports: ['websocket'], reconnection: false })
    clients.push(c)
    return c
  }

  beforeAll(async () => {
    http = createServer()
    io = new Server(http)
    sockets = attachSocketIo(io, {
      channels: [room],
      authorize: (socket) => {
        if (socket.handshake.auth.token === 'bad') throw KitrError.unauthorized()
        return { role: socket.handshake.auth.role ?? 'member' }
      },
    })
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    for (const c of clients) c.close()
    await new Promise((r) => io.close(r))
  })

  it('subscribes through channel() and receives events under normalised params', async () => {
    const client = connect()
    const events: unknown[] = []
    channel(client, room)
      .subscription()
      .subscribe({ id: ' a ' }, { next: (e) => events.push(e) })
    await vi.waitFor(async () =>
      expect((await io.in('room:{"id":"a"}').fetchSockets()).length).toBe(1),
    )
    sockets.use(room, { id: 'a' }).emit('said', 'hello')
    await vi.waitFor(() => expect(events).toEqual([{ event: 'said', data: 'hello' }]))
    expect(client.status).toBe('open')
  })

  it('checks channel authorize with the connection context', async () => {
    const member = connect()
    const admin = connect({ role: 'admin' })
    const errors: any[] = []
    member.subscribe(
      'room',
      { id: 'vip' },
      () => {},
      (e) => errors.push(e),
    )
    const adminEvents: unknown[] = []
    admin.subscribe('room', { id: 'vip' }, (ev, d) => adminEvents.push([ev, d]))
    await vi.waitFor(() => expect(errors[0]?.code).toBe('FORBIDDEN'))
    await vi.waitFor(async () =>
      expect((await io.in('room:{"id":"vip"}').fetchSockets()).length).toBe(1),
    )
    sockets.use(room, { id: 'vip' }).emit('said', 'secret')
    await vi.waitFor(() => expect(adminEvents).toEqual([['said', 'secret']]))
  })

  it('validates params, routes unknown channels to onError and forwards messages', async () => {
    const onError = vi.fn()
    const c = createSocketIoClient({ url, transports: ['websocket'], reconnection: false, onError })
    clients.push(c)
    const errors: any[] = []
    c.subscribe(
      'room',
      { nope: 1 },
      () => {},
      (e) => errors.push(e),
    )
    c.send('ghost', null, 'x', null)
    c.send('room', { id: 'b ' }, 'typing', true)
    await vi.waitFor(() => expect(errors[0]?.code).toBe('VALIDATION'))
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' })),
    )
    await vi.waitFor(() =>
      expect(inbox).toContainEqual({
        event: 'typing',
        data: true,
        params: { id: 'b' },
        ctx: { role: 'member' },
      }),
    )
  })

  it('unsubscribes and leaves the room', async () => {
    const c = connect()
    const off = c.subscribe('room', { id: 'leave-me' }, () => {})
    await vi.waitFor(async () =>
      expect((await io.in('room:{"id":"leave-me"}').fetchSockets()).length).toBe(1),
    )
    off()
    await vi.waitFor(async () =>
      expect((await io.in('room:{"id":"leave-me"}').fetchSockets()).length).toBe(0),
    )
  })

  it('rejects connections the authorize hook refuses', async () => {
    const c = connect({ token: 'bad' })
    const error = await new Promise<Error>((r) => c.socket.on('connect_error', r))
    expect(error.message).toBe('Authentication required')
    expect(c.status).toBe('closed')
  })
})
