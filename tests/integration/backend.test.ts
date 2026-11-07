import { request } from 'node:http'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePort, root, startProcess } from './helpers'

/** The server kit as users run it: `node --import tsx server/main.ts`, real sockets, real signals. */
describe('backend example over the network', () => {
  const dir = join(root, 'examples/backend')
  let base: string
  let ws: string
  let server: Awaited<ReturnType<typeof startProcess>>

  beforeAll(async () => {
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    ws = `ws://127.0.0.1:${port}/ws`
    server = await startProcess(
      dir,
      process.execPath,
      ['--import', 'tsx', 'server/main.ts'],
      `${base}/healthz`,
      { PORT: String(port), LOG_LEVEL: 'warn' },
    )
  }, 60_000)
  afterAll(() => server?.stop())

  it('serves the health route and the liveness probe', async () => {
    const api = await fetch(`${base}/api/health`)
    expect(api.status).toBe(200)
    expect(await api.json()).toMatchObject({ ok: true })
    expect((await fetch(`${base}/healthz`)).status).toBe(200)
  })

  it('answers unknown routes with a JSON 404, not a crash', async () => {
    const res = await fetch(`${base}/api/nope`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/json/)
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })

  it('does not open the api to other origins by default', async () => {
    // The generated routes used to put cors() (any origin) on /api, overriding shield.
    const res = await fetch(`${base}/api/health`, { headers: { origin: 'http://evil.example' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('rejects a body over the configured limit before reading it', async () => {
    // Announce a 2 MB body but send only the headers: the server must answer 413 from
    // content-length alone and close. (Streaming the whole body races that close: the
    // client can hit EPIPE before it reads the 413.)
    const { status, connection } = await new Promise<{ status?: number; connection?: string }>(
      (resolve, reject) => {
        const req = request(`${base}/api/health`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': 2 * 1024 * 1024 },
        })
        req.on('response', (res) => {
          res.resume()
          resolve({ status: res.statusCode, connection: res.headers.connection })
          req.destroy()
        })
        req.on('error', reject)
        req.flushHeaders()
      },
    )
    expect(status).toBe(413)
    expect(connection).toBe('close')
    // The server is still healthy afterwards.
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })

  it('accepts WebSocket subscriptions on /ws', async () => {
    const socket = new WebSocket(ws)
    const messages: any[] = []
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no answer on /ws')), 5000)
      socket.onerror = () => reject(new Error('websocket error'))
      socket.onopen = () =>
        socket.send(JSON.stringify({ t: 'sub', id: '1', ch: 'example', p: { room: 'a' } }))
      socket.onmessage = (e) => {
        messages.push(JSON.parse(String(e.data)))
        clearTimeout(timer)
        resolve()
      }
    })
    expect(messages[0]).toMatchObject({ t: 'ok', id: '1' })
    socket.send(JSON.stringify({ t: 'ping' }))
    const pong = await new Promise(
      (resolve) => (socket.onmessage = (e) => resolve(JSON.parse(String(e.data)))),
    )
    expect(pong).toEqual({ t: 'pong' })
    socket.send(JSON.stringify({ t: 'sub', id: '2', ch: 'missing', p: {} }))
    const err: any = await new Promise(
      (resolve) => (socket.onmessage = (e) => resolve(JSON.parse(String(e.data)))),
    )
    expect(err).toMatchObject({ t: 'err', id: '2' })
    socket.close()
  })

  it('shuts down cleanly on SIGTERM with a socket still open', { timeout: 15_000 }, async () => {
    const socket = new WebSocket(ws)
    await new Promise((resolve) => (socket.onopen = resolve))
    const closed = new Promise((resolve) => (socket.onclose = resolve))
    const started = Date.now()
    await server.stop()
    expect(server.proc.exitCode ?? server.proc.signalCode).not.toBeNull()
    expect(Date.now() - started).toBeLessThan(5000)
    await closed
  })
})
