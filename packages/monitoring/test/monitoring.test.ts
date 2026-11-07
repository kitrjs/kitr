import { KitrError } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { createMonitoring, defaultShouldReport, memoryReporter } from '../src'
import { reportErrors } from '../src/server'

describe('monitoring', () => {
  it('reports to every reporter with merged tags and drops expected errors', () => {
    const r = memoryReporter()
    const m = createMonitoring({ reporters: [r], tags: { environment: 'test' } })
    m.captureException(new Error('boom'), { source: 'manual', tags: { feature: 'x' } })
    m.captureException(KitrError.notFound('nope'))
    m.captureException(new KitrError('INTERNAL', 'db down'))
    expect(r.exceptions).toHaveLength(2)
    expect(r.exceptions[0]?.context?.tags).toEqual({ environment: 'test', feature: 'x' })
    expect(r.exceptions[0]?.context?.source).toBe('manual')
    m.setUser({ id: 'u1' })
    expect(r.user).toEqual({ id: 'u1' })
  })

  it('defaultShouldReport skips kitr 4xx and aborted requests', () => {
    expect(defaultShouldReport(KitrError.unauthorized())).toBe(false)
    expect(defaultShouldReport(new KitrError('INTERNAL', 'x'))).toBe(true)
    expect(defaultShouldReport(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(false)
    expect(defaultShouldReport(new Error('x'))).toBe(true)
  })

  it('wrap() reports and rethrows, sync and async', async () => {
    const r = memoryReporter()
    const m = createMonitoring({ reporters: [r] })
    expect(() =>
      m.wrap(() => {
        throw new Error('sync')
      }),
    ).toThrow('sync')
    await expect(m.wrap(async () => Promise.reject(new Error('async')))).rejects.toThrow('async')
    expect(r.exceptions.map((e) => (e.error as Error).message)).toEqual(['sync', 'async'])
  })

  it('server middleware reports with request details and rethrows', async () => {
    const r = memoryReporter()
    const mw = reportErrors(createMonitoring({ reporters: [r] }))
    const event = {
      req: { method: 'GET', url: '/api/x' },
      context: { kitr: { requestId: 'req-1' } },
    }
    await expect(
      mw(event, async () => {
        throw new Error('handler failed')
      }),
    ).rejects.toThrow('handler failed')
    expect(r.exceptions[0]?.context).toMatchObject({
      source: 'server',
      extra: { method: 'GET', url: '/api/x', requestId: 'req-1' },
    })
    expect(await mw(event, async () => 'ok')).toBe('ok')
  })
})
