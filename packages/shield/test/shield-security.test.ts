import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cors,
  createMemoryRateLimitStore,
  csrf,
  DEFAULT_CSP,
  rateLimit,
  securityHeaders,
  shieldMiddlewares,
} from '../src'

function app(...middlewares: Parameters<ReturnType<typeof createServer>['use']>[0][]) {
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  for (const m of middlewares) server.use(m)
  server.h3.get('/ping', () => 'pong')
  server.h3.post('/save', () => 'saved')
  server.h3.post('/webhooks/stripe', () => 'hooked')
  server.h3.post('/webhooksfake', () => 'not a webhook')
  server.h3.put('/save', () => 'put')
  server.h3.delete('/save', () => 'deleted')
  return server
}

const req = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request(`http://x${path}`, init)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('securityHeaders', () => {
  it('sends the full default set, and HSTS only in production', async () => {
    const dev = await app(securityHeaders()).fetch(req('/ping'))
    expect(dev.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(dev.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()')
    expect(dev.headers.get('content-security-policy')).toBe(DEFAULT_CSP)
    expect(dev.headers.get('strict-transport-security')).toBeNull()

    vi.stubEnv('NODE_ENV', 'production')
    const prod = await app(securityHeaders()).fetch(req('/ping'))
    expect(prod.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    )
  })

  it('the default CSP forbids framing, plugins from other origins and foreign form posts', () => {
    expect(DEFAULT_CSP).toContain("frame-ancestors 'none'")
    expect(DEFAULT_CSP).toContain("base-uri 'self'")
    expect(DEFAULT_CSP).toContain("form-action 'self'")
    expect(DEFAULT_CSP).not.toMatch(/script-src[^;]*\*/)
  })

  it('every header can be changed or turned off', async () => {
    const res = await app(
      securityHeaders({
        contentSecurityPolicy: false,
        frameOptions: 'SAMEORIGIN',
        referrerPolicy: false,
        permissionsPolicy: 'camera=(self)',
        hsts: 600,
      }),
    ).fetch(req('/ping'))
    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('referrer-policy')).toBeNull()
    expect(res.headers.get('permissions-policy')).toBe('camera=(self)')
    expect(res.headers.get('strict-transport-security')).toBe('max-age=600; includeSubDomains')
    // nosniff is not optional.
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('headers are on error responses too', async () => {
    const res = await app(securityHeaders()).fetch(req('/missing'))
    expect(res.status).toBe(404)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('cors', () => {
  it('sends no CORS headers by default (same-origin only)', async () => {
    const res = await app(cors()).fetch(req('/ping', { headers: { origin: 'https://a.test' } }))
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses a wildcard origin with credentials instead of reflecting every origin', () => {
    expect(() => cors({ origin: '*', credentials: true })).toThrow(/list the origins instead/)
  })

  it('a wildcard without credentials answers *', async () => {
    const res = await app(cors({ origin: '*' })).fetch(
      req('/ping', { headers: { origin: 'https://anyone.test' } }),
    )
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('a predicate decides per origin and the answer varies on Origin', async () => {
    const server = app(cors({ origin: (o) => o.endsWith('.acme.test') }))
    const ok = await server.fetch(req('/ping', { headers: { origin: 'https://app.acme.test' } }))
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.acme.test')
    expect(ok.headers.get('vary')).toMatch(/Origin/)
    const no = await server.fetch(req('/ping', { headers: { origin: 'https://acme.test.evil' } }))
    expect(no.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('an allow-list matches exactly, not by prefix', async () => {
    const server = app(cors({ origin: ['https://app.test'] }))
    for (const origin of ['https://app.test.evil.com', 'http://app.test', 'https://app.tes'])
      expect(
        (await server.fetch(req('/ping', { headers: { origin } }))).headers.get(
          'access-control-allow-origin',
        ),
        origin,
      ).toBeNull()
  })

  it('preflights list methods, headers and max-age; a refused origin gets no allow-origin', async () => {
    const server = app(cors({ origin: ['https://app.test'], maxAge: 60, methods: ['GET', 'POST'] }))
    const ok = await server.fetch(
      req('/save', { method: 'OPTIONS', headers: { origin: 'https://app.test' } }),
    )
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-methods')).toBe('GET, POST')
    expect(ok.headers.get('access-control-allow-headers')).toMatch(/X-CSRF-Token/)
    expect(ok.headers.get('access-control-max-age')).toBe('60')
    const no = await server.fetch(
      req('/save', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }),
    )
    expect(no.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('csrf', () => {
  const token = 'a'.repeat(48)
  const withToken = (method: string, path = '/save', header = token, cookie = token) =>
    req(path, { method, headers: { cookie: `kitr-csrf=${cookie}`, 'x-csrf-token': header } })

  it('protects POST, PUT, PATCH and DELETE, and not GET', async () => {
    const server = app(csrf())
    for (const method of ['POST', 'PUT', 'DELETE'])
      expect((await server.fetch(req('/save', { method }))).status, method).toBe(403)
    expect((await server.fetch(req('/ping'))).status).toBe(200)
    expect((await server.fetch(withToken('PUT'))).status).toBe(200)
  })

  it('rejects a header that does not match the cookie', async () => {
    const server = app(csrf())
    expect((await server.fetch(withToken('POST', '/save', 'b'.repeat(48)))).status).toBe(403)
    // A header alone, with no cookie, is not enough either.
    const headerOnly = req('/save', { method: 'POST', headers: { 'x-csrf-token': token } })
    expect((await server.fetch(headerOnly)).status).toBe(403)
  })

  it('answers 403 as kitr JSON', async () => {
    const res = await app(csrf()).fetch(req('/save', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('issues a fresh random token only when there is none, Secure in production', async () => {
    const server = app(csrf())
    const a = (await server.fetch(req('/ping'))).headers.get('set-cookie')!
    const b = (await server.fetch(req('/ping'))).headers.get('set-cookie')!
    const ta = a.match(/kitr-csrf=([^;]+)/)![1]!
    expect(ta).toMatch(/^[0-9a-f]{48}$/)
    expect(b).not.toContain(ta)
    expect(a).toMatch(/SameSite=Lax/)
    expect(a).not.toMatch(/Secure/)
    const again = await server.fetch(req('/ping', { headers: { cookie: `kitr-csrf=${ta}` } }))
    expect(again.headers.get('set-cookie')).toBeNull()

    vi.stubEnv('NODE_ENV', 'production')
    const prod = await app(csrf()).fetch(req('/ping'))
    expect(prod.headers.get('set-cookie')).toMatch(/; Secure/)
  })

  it('skips ignored paths by prefix, without matching look-alikes', async () => {
    const server = app(csrf({ ignore: ['/webhooks'] }))
    expect((await server.fetch(req('/webhooks/stripe', { method: 'POST' }))).status).toBe(200)
    expect((await server.fetch(req('/webhooksfake', { method: 'POST' }))).status).toBe(403)
  })

  it('uses a custom cookie and header name', async () => {
    const server = app(csrf({ cookie: 'xsrf', header: 'x-xsrf' }))
    const res = await server.fetch(
      req('/save', { method: 'POST', headers: { cookie: 'xsrf=t1', 'x-xsrf': 't1' } }),
    )
    expect(res.status).toBe(200)
  })
})

describe('rateLimit', () => {
  it('limits by the connection address by default, not by X-Forwarded-For', async () => {
    const server = app(rateLimit({ max: 1 }))
    // Without a proxy to trust, a client that rotates X-Forwarded-For is still one client.
    const first = await server.fetch(req('/ping', { headers: { 'x-forwarded-for': '1.1.1.1' } }))
    expect(first.status).toBe(200)
    const spoofed = await server.fetch(req('/ping', { headers: { 'x-forwarded-for': '2.2.2.2' } }))
    expect(spoofed.status).toBe(429)
  })

  it('reads X-Forwarded-For when the proxy is trusted', async () => {
    const server = app(rateLimit({ max: 1, trustProxy: true }))
    const a = await server.fetch(
      req('/ping', { headers: { 'x-forwarded-for': '1.1.1.1, 10.0.0.1' } }),
    )
    const b = await server.fetch(req('/ping', { headers: { 'x-forwarded-for': '2.2.2.2' } }))
    const a2 = await server.fetch(req('/ping', { headers: { 'x-forwarded-for': '1.1.1.1' } }))
    expect([a.status, b.status, a2.status]).toEqual([200, 200, 429])
  })

  it('answers 429 as kitr JSON with Retry-After and RateLimit headers', async () => {
    const server = app(rateLimit({ max: 1, windowMs: 30_000, key: () => 'k' }))
    await server.fetch(req('/ping'))
    const res = await server.fetch(req('/ping'))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(30)
    expect(res.headers.get('ratelimit-limit')).toBe('1')
    expect(res.headers.get('ratelimit-remaining')).toBe('0')
  })

  it('keeps separate counts per key and skips ignored paths', async () => {
    let who = 'a'
    const server = app(rateLimit({ max: 1, key: () => who, ignore: ['/webhooks'] }))
    expect((await server.fetch(req('/ping'))).status).toBe(200)
    who = 'b'
    expect((await server.fetch(req('/ping'))).status).toBe(200)
    for (let i = 0; i < 3; i++)
      expect((await server.fetch(req('/webhooks/stripe', { method: 'POST' }))).status).toBe(200)
  })

  it('the memory store resets after the window and prunes old keys', async () => {
    vi.useFakeTimers()
    const store = createMemoryRateLimitStore()
    expect((await store.hit('k', 1000)).count).toBe(1)
    expect((await store.hit('k', 1000)).count).toBe(2)
    vi.advanceTimersByTime(1001)
    expect((await store.hit('k', 1000)).count).toBe(1)
    for (let i = 0; i < 10_001; i++) await store.hit(`old-${i}`, 10)
    vi.advanceTimersByTime(20)
    // Inserting past the cap sweeps expired entries; a fresh key still starts at 1.
    expect((await store.hit('fresh', 1000)).count).toBe(1)
  })

  it('a custom store sees every hit', async () => {
    const hit = vi.fn(async () => ({ count: 1, resetAt: Date.now() + 1000 }))
    await app(rateLimit({ store: { hit }, key: () => 'k', windowMs: 5000 })).fetch(req('/ping'))
    expect(hit).toHaveBeenCalledWith('k', 5000)
  })
})

describe('shieldMiddlewares', () => {
  it('turns on headers, rate limit and csrf by default; cors only when configured', () => {
    expect(shieldMiddlewares({})).toHaveLength(3)
    expect(shieldMiddlewares({ cors: { origin: ['https://a.test'] } })).toHaveLength(4)
    expect(shieldMiddlewares({ headers: false, csrf: false, rateLimit: false })).toHaveLength(0)
  })

  it('applies rate limiting before CSRF, so floods are cut off before token checks', async () => {
    const server = app(...shieldMiddlewares({ rateLimit: { max: 1, key: () => 'k' } }))
    expect((await server.fetch(req('/save', { method: 'POST' }))).status).toBe(403)
    expect((await server.fetch(req('/save', { method: 'POST' }))).status).toBe(429)
  })
})
