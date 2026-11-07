import { createServer } from '@kitr/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defineChannel } from '../src'
import { createSocketServer } from '../src/server'

const projectChannel = defineChannel<{ id: string }>({
  name: 'projects',
  events: {
    updated: {
      effects: (data: { name: string }, { id }) => ({
        set: [{ key: ['projects', 'detail', id], data }],
      }),
    },
  },
  authorize: (params, ctx) =>
    (ctx as { userId?: string }).userId !== 'banned' && params.id !== 'secret',
  onMessage: (event, data, params) => {
    received.push({ event, data, params })
  },
})
const received: unknown[] = []

describe('socket server', () => {
  const server = createServer({ server: { healthPath: false }, logger: silent() })
  const sockets = createSocketServer({
    channels: [projectChannel],
    authorize: (request) => ({ userId: new URL(request.url).searchParams.get('user') ?? 'anon' }),
  })
  sockets.attach(server, '/ws')
  let url = ''
  let close: () => Promise<void>

  beforeAll(async () => {
    const listening = await server.listen({ port: 0, host: '127.0.0.1' })
    url = listening.url.replace(/^http/, 'ws')
    close = listening.close
  })
  afterAll(async () => {
    await close()
  })

  it('subscribes, receives server emits, and enforces authorize', async () => {
    const ws = new WebSocket(`${url}/ws?user=u1`)
    const messages: any[] = []
    const next = () =>
      new Promise<any>((resolve) =>
        ws.addEventListener('message', (e) => resolve(JSON.parse(String(e.data))), { once: true }),
      )
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
    ws.send(JSON.stringify({ t: 'sub', id: 's1', ch: 'projects', p: { id: '1' } }))
    messages.push(await next())
    expect(messages[0]).toEqual({ t: 'ok', id: 's1', p: { id: '1' } })
    expect(sockets.use(projectChannel, { id: '1' }).size).toBe(1)

    const pending = next()
    sockets.use(projectChannel, { id: '1' }).emit('updated', { name: 'Renamed' })
    expect(await pending).toEqual({
      t: 'ev',
      ch: 'projects',
      p: { id: '1' },
      ev: 'updated',
      d: { name: 'Renamed' },
    })

    ws.send(
      JSON.stringify({ t: 'msg', ch: 'projects', p: { id: '1' }, ev: 'typing', d: { on: true } }),
    )
    ws.send(JSON.stringify({ t: 'sub', id: 's2', ch: 'projects', p: { id: 'secret' } }))
    const err = await next()
    expect(err).toMatchObject({ t: 'err', id: 's2', e: { code: 'FORBIDDEN' } })
    expect(received).toEqual([{ event: 'typing', data: { on: true }, params: { id: '1' } }])

    ws.send(JSON.stringify({ t: 'sub', id: 's3', ch: 'nope', p: null }))
    expect(await next()).toMatchObject({ t: 'err', e: { code: 'NOT_FOUND' } })

    ws.close()
    await new Promise((r) => setTimeout(r, 50))
    expect(sockets.connections).toBe(0)
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
