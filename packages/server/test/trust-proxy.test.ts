import { silentLogger } from '@kitr/logger'
import { describe, expect, it } from 'vitest'
import { createServer, tryUseRequest } from '../src'

const ipOf = async (trustProxy: boolean | number | undefined, forwarded?: string) => {
  const server = createServer({ logger: silentLogger, server: { healthPath: false, trustProxy } })
  server.h3.get('/ip', () => ({ ip: tryUseRequest()?.ip ?? null }))
  const res = await server.fetch(
    new Request('http://x/ip', { headers: forwarded ? { 'x-forwarded-for': forwarded } : {} }),
  )
  return ((await res.json()) as { ip: string | null }).ip
}

// Behind a load balancer, `trustProxy` gives each request the client's address, so rate limits
// tell users apart.
describe('trustProxy', () => {
  it('ignores X-Forwarded-For by default, so a client cannot pick its own IP', async () => {
    expect(await ipOf(undefined, '6.6.6.6')).not.toBe('6.6.6.6')
  })

  it('takes the address the trusted proxy appended, not one the client sent', async () => {
    expect(await ipOf(true, '6.6.6.6, 203.0.113.7')).toBe('203.0.113.7')
    expect(await ipOf(true, '203.0.113.7')).toBe('203.0.113.7')
  })

  it('counts several proxies', async () => {
    expect(await ipOf(2, '6.6.6.6, 203.0.113.7, 10.0.0.2')).toBe('203.0.113.7')
    // Fewer entries than proxies: the first one is the best there is.
    expect(await ipOf(3, '203.0.113.7')).toBe('203.0.113.7')
  })
})
