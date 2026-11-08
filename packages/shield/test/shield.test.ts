import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { describe, expect, it } from 'vitest'
import { cors, csrf, rateLimit, securityHeaders, shield } from '../src'
import shieldProvider from '../src/provider'

function app(...middlewares: Parameters<ReturnType<typeof createServer>['use']>[0][]) {
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  for (const m of middlewares) server.use(m)
  server.h3.get('/ping', () => 'pong')
  server.h3.post('/save', () => 'saved')
  return server
}

describe('shield', () => {
  it('sets security headers', async () => {
    const res = await app(securityHeaders()).fetch(new Request('http://x/ping'))
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
  })

  it('answers CORS preflights for allowed origins only', async () => {
    const server = app(cors({ origin: ['https://app.test'], credentials: true }))
    const ok = await server.fetch(
      new Request('http://x/ping', { method: 'OPTIONS', headers: { origin: 'https://app.test' } }),
    )
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.test')
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true')
    const no = await server.fetch(
      new Request('http://x/ping', { headers: { origin: 'https://evil.test' } }),
    )
    expect(no.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('issues a CSRF cookie and rejects writes without the matching header', async () => {
    const server = app(csrf())
    const first = await server.fetch(new Request('http://x/ping'))
    const token = first.headers.get('set-cookie')?.match(/kitr-csrf=([^;]+)/)?.[1]
    expect(token).toBeTruthy()
    const denied = await server.fetch(
      new Request('http://x/save', { method: 'POST', headers: { cookie: `kitr-csrf=${token}` } }),
    )
    expect(denied.status).toBe(403)
    const allowed = await server.fetch(
      new Request('http://x/save', {
        method: 'POST',
        headers: { cookie: `kitr-csrf=${token}`, 'x-csrf-token': token! },
      }),
    )
    expect(allowed.status).toBe(200)
  })

  it('rate limits per key with RateLimit headers', async () => {
    const server = app(rateLimit({ max: 2, key: () => 'k' }))
    expect((await server.fetch(new Request('http://x/ping'))).status).toBe(200)
    const second = await server.fetch(new Request('http://x/ping'))
    expect(second.headers.get('ratelimit-remaining')).toBe('0')
    const third = await server.fetch(new Request('http://x/ping'))
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBeTruthy()
  })

  it('shield(server) reads config/shield.ts and the provider rejects unsafe cors', async () => {
    const server = createServer({
      logger: silentLogger,
      providers: [shieldProvider],
      config: { shield: { csrf: false, rateLimit: false, cors: { origin: '*' } } },
    })
    shield(server)
    server.h3.get('/ping', () => 'pong')
    const res = await server.fetch(
      new Request('http://x/ping', { headers: { origin: 'http://a' } }),
    )
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')

    const bad = createServer({
      logger: silentLogger,
      providers: [shieldProvider],
      config: { shield: { cors: { origin: '*', credentials: true } } },
    })
    await expect(bad.boot()).rejects.toThrow(/credentials/)
  })
})
