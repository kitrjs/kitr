import { createApp, defineProvider, KitrError } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { H3, HTTPError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createServer,
  errorToResponse,
  normaliseServerError,
  runWithApp,
  tryUseRequest,
  useRequest,
  useRequestApp,
} from '../src'

const req = (path: string, init?: RequestInit) => new Request(`http://test${path}`, init)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createServer', () => {
  it('answers the health route and can disable or move it', async () => {
    const a = createServer({ logger: silentLogger })
    expect(await (await a.fetch(req('/healthz'))).json()).toEqual({ ok: true })
    const b = createServer({ logger: silentLogger, server: { healthPath: false } })
    expect((await b.fetch(req('/healthz'))).status).toBe(404)
    const c = createServer({ logger: silentLogger, server: { healthPath: '/up' } })
    expect((await c.fetch(req('/up'))).status).toBe(200)
  })

  it('echoes an incoming request id or makes one', async () => {
    const server = createServer({ logger: silentLogger })
    const echoed = await server.fetch(req('/healthz', { headers: { 'x-request-id': 'abc' } }))
    expect(echoed.headers.get('x-request-id')).toBe('abc')
    const fresh = await server.fetch(req('/healthz'))
    expect(fresh.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    const custom = createServer({ logger: silentLogger, server: { requestIdHeader: 'x-trace' } })
    expect((await custom.fetch(req('/healthz'))).headers.get('x-trace')).toBeTruthy()
  })

  it('gives each request its own context and container fork', async () => {
    const server = createServer({ logger: silentLogger })
    const seen: unknown[] = []
    server.h3.get('/ctx', async () => {
      const ctx = useRequest()
      ctx.app.container.value('perRequest', ctx.requestId)
      // Something deeper in the call stack sees the same request.
      await new Promise((r) => setTimeout(r, 5))
      seen.push(useRequestApp().container.use('perRequest'))
      return { id: ctx.requestId, sameApp: ctx.app !== server.app }
    })
    const [a, b] = await Promise.all([
      server.fetch(req('/ctx', { headers: { 'x-request-id': 'one' } })),
      server.fetch(req('/ctx', { headers: { 'x-request-id': 'two' } })),
    ])
    expect(await a.json()).toEqual({ id: 'one', sameApp: true })
    expect(await b.json()).toEqual({ id: 'two', sameApp: true })
    expect(seen.sort()).toEqual(['one', 'two'])
    expect(server.app.container.has('perRequest')).toBe(false)
  })

  it('request apps keep the server mode', async () => {
    const server = createServer({ logger: silentLogger, mode: 'development' })
    server.h3.get('/mode', () => ({ mode: useRequest().app.mode }))
    expect(await (await server.fetch(req('/mode'))).json()).toEqual({ mode: 'development' })
  })

  it('outside a request the context helpers say so', () => {
    expect(tryUseRequest()).toBeUndefined()
    expect(() => useRequest()).toThrow(/outside a request/)
    expect(() => useRequestApp()).toThrow(/no fallback/)
    const app = createApp()
    expect(useRequestApp(app)).toBe(app)
    expect(runWithApp(app, () => useRequestApp())).toBe(app)
  })

  it('turns thrown errors into the kitr wire shape', async () => {
    const server = createServer({ logger: silentLogger })
    server.h3.get('/missing', () => {
      throw KitrError.notFound('Project')
    })
    server.h3.get('/crash', () => {
      throw new Error('secret detail')
    })
    const missing = await server.fetch(req('/missing'))
    expect(missing.status).toBe(404)
    expect(missing.headers.get('content-type')).toContain('application/json')
    expect(await missing.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'Project not found',
      status: 404,
    })
    const crash = await server.fetch(req('/crash'))
    expect(crash.status).toBe(500)
    expect((await crash.json()).code).toBe('INTERNAL')
  })

  it('logs unhandled 5xx with the request id and leaves 4xx quiet', async () => {
    const { createLogger } = await import('@kitr/logger')
    const lines: string[] = []
    const logger = createLogger({
      level: 'error',
      format: 'json',
      write: (line) => lines.push(line),
    })
    const server = createServer({ logger, server: { healthPath: false } })
    server.h3.get('/crash', () => {
      throw new Error('boom')
    })
    server.h3.get('/missing', () => {
      throw KitrError.notFound()
    })
    await server.fetch(req('/missing'))
    expect(lines).toHaveLength(0)
    const res = await server.fetch(req('/crash'))
    expect(lines).toHaveLength(1)
    const record = JSON.parse(lines[0]!)
    expect(record).toMatchObject({ level: 'error', path: '/crash', status: 500 })
    expect(record.requestId).toBe(res.headers.get('x-request-id'))
  })

  it('hides 5xx details in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const server = createServer({ logger: silentLogger })
    server.h3.get('/crash', () => {
      throw new KitrError('INTERNAL', 'db password is hunter2', { data: { dsn: 'x' } })
    })
    server.h3.get('/client-error', () => {
      throw new KitrError('CONFLICT', 'Name taken')
    })
    const crash = await (await server.fetch(req('/crash'))).json()
    expect(crash).toEqual({ code: 'INTERNAL', message: 'Internal server error', status: 500 })
    expect((await (await server.fetch(req('/client-error'))).json()).message).toBe('Name taken')
  })

  it('hides 5xx details when the app mode is production, without NODE_ENV', async () => {
    const server = createServer({ logger: silentLogger, mode: 'production' })
    server.h3.get('/crash', () => {
      throw new KitrError('INTERNAL', 'db password is hunter2', { data: { dsn: 'x' } })
    })
    const crash = await (await server.fetch(req('/crash'))).json()
    expect(crash).toEqual({ code: 'INTERNAL', message: 'Internal server error', status: 500 })
  })

  it('rejects bodies over the limit', async () => {
    const server = createServer({ logger: silentLogger, server: { bodyLimit: 10 } })
    server.h3.post('/upload', async (event) => ({ size: (await event.req.text()).length }))
    const ok = await server.fetch(req('/upload', { method: 'POST', body: 'small' }))
    expect(await ok.json()).toEqual({ size: 5 })
    const big = await server.fetch(req('/upload', { method: 'POST', body: 'x'.repeat(100) }))
    expect(big.status).toBe(413)
  })

  it('mounts fetch handlers and h3 apps under a base path', async () => {
    const server = createServer({ logger: silentLogger })
    const sub = new H3().get('/hello', () => 'from h3')
    server.mount('/h3', sub)
    server.mount('/raw', { fetch: () => new Response('from fetch') })
    expect(await (await server.fetch(req('/h3/hello'))).text()).toBe('from h3')
    expect(await (await server.fetch(req('/raw/anything'))).text()).toBe('from fetch')
  })

  it('runs middleware added with use()', async () => {
    const server = createServer({ logger: silentLogger })
    server.use((event) => {
      event.res.headers.set('x-powered-by', 'kitr')
    })
    expect((await server.fetch(req('/healthz'))).headers.get('x-powered-by')).toBe('kitr')
  })

  it('boots lazily once and uses the container logger when bound', async () => {
    const register = vi.fn()
    const logger = { ...silentLogger, child: () => silentLogger }
    const server = createServer({
      providers: [
        defineProvider({
          name: 'log',
          register: (a) => void (register(), a.container.value('logger', logger)),
        }),
      ],
    })
    await Promise.all([server.fetch(req('/healthz')), server.fetch(req('/healthz'))])
    expect(register).toHaveBeenCalledTimes(1)
    expect(server.logger).toBe(logger)
  })

  it('reuses a given app and stores server config on it', () => {
    const app = createApp({ environment: 'server' })
    const server = createServer({ app, logger: silentLogger, server: { port: 4000 } })
    expect(server.app).toBe(app)
    expect(app.config.get('server')).toEqual({ port: 4000 })
    expect(server.config.port).toBe(4000)
    expect(server.config.host).toBe('0.0.0.0')
  })

  it('listens on a real port, runs ready, and shuts providers down on close', async () => {
    const log: string[] = []
    const server = createServer({
      logger: silentLogger,
      providers: [
        defineProvider({
          name: 'life',
          ready: () => void log.push('ready'),
          shutdown: () => void log.push('shutdown'),
        }),
      ],
    })
    const { url, close } = await server.listen({ port: 0, host: '127.0.0.1' })
    try {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
      const res = await fetch(`${url}/healthz`)
      expect(await res.json()).toEqual({ ok: true })
      expect(log).toEqual(['ready'])
    } finally {
      await close()
    }
    expect(log).toEqual(['ready', 'shutdown'])
  })
})

describe('error normalisation', () => {
  it('unwraps KitrError causes from h3 errors', () => {
    const wrapped = new HTTPError({ status: 500, cause: KitrError.forbidden() })
    expect(normaliseServerError(wrapped).code).toBe('FORBIDDEN')
  })

  it('maps plain h3 HTTP errors by status', () => {
    expect(normaliseServerError(new HTTPError({ status: 404 })).code).toBe('NOT_FOUND')
    expect(normaliseServerError(new HTTPError({ status: 405 })).status).toBe(405)
  })

  it('builds a JSON response', async () => {
    const res = errorToResponse(KitrError.validation({ a: ['bad'] }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ fieldErrors: { a: ['bad'] } })
  })
})

describe('body limit', () => {
  it('rejects a declared oversized body with 413 and closes the connection', async () => {
    const server = createServer({ logger: silentLogger, config: { server: { bodyLimit: 10 } } })
    server.h3.post('/echo', async (event) => event.req.text())
    const res = await server.fetch(
      new Request('http://x/echo', {
        method: 'POST',
        body: 'x'.repeat(100),
        headers: { 'content-length': '100' },
      }),
    )
    expect(res.status).toBe(413)
    expect(res.headers.get('connection')).toBe('close')
    expect(await res.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    const ok = await server.fetch(new Request('http://x/echo', { method: 'POST', body: 'small' }))
    expect(await ok.text()).toBe('small')
  })
})
