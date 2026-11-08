import { describe, expect, it } from 'vitest'
import { KitrError } from '../src/errors'
import {
  applyRequestHeaders,
  bearerValue,
  failEnvelope,
  fromEnvelope,
  keyFor,
  linkSignals,
  okEnvelope,
  readCookie,
  serializeKey,
  timeoutSignal,
  toEnvelope,
  unwrapEnvelope,
  withTimeout,
} from '../src/request'

describe('error envelope', () => {
  it('round-trips a KitrError with code, status, message, data and field errors', () => {
    const error = new KitrError('VALIDATION', 'Bad input', {
      fieldErrors: { email: ['Required'], 'items.0.name': ['Too short'] },
      data: { hint: 1 },
    })
    const wire = JSON.parse(JSON.stringify(toEnvelope(error)))
    const back = fromEnvelope(wire, 200)
    expect(back).toBeInstanceOf(KitrError)
    expect(back.toJSON()).toEqual(error.toJSON())
  })

  it('prefers the status in the body and falls back to the response status', () => {
    expect(fromEnvelope({ code: 'CONFLICT', message: 'x', status: 409 }, 500).status).toBe(409)
    expect(fromEnvelope({ code: 'CONFLICT', message: 'x', status: 0 }, 409).status).toBe(409)
  })

  it('turns anything thrown into the wire shape', () => {
    expect(toEnvelope(new Error('boom'))).toMatchObject({ code: 'INTERNAL', message: 'boom' })
    expect(toEnvelope('text')).toMatchObject({ code: 'INTERNAL', message: 'text', status: 500 })
  })

  it('masks server errors only when asked', () => {
    const secret = new KitrError('INTERNAL', 'db password wrong', { data: { dsn: 'x' } })
    expect(toEnvelope(secret, { mask: true })).toEqual({
      code: 'INTERNAL',
      message: 'Internal server error',
      status: 500,
    })
    expect(toEnvelope(secret).message).toBe('db password wrong')
    expect(toEnvelope(KitrError.notFound('Project'), { mask: true }).message).toBe(
      'Project not found',
    )
  })

  it.each([
    [{ message: 'nope' }, 'nope'],
    [{ error: { message: 'deep' } }, 'deep'],
    [{ error: 'flat' }, 'flat'],
  ])('reads %j from other backends', (body, message) => {
    const e = fromEnvelope(body, 400)
    expect(e.code).toBe('BAD_REQUEST')
    expect(e.message).toBe(message)
    expect(e.data).toEqual(body)
  })

  it('groups an errors array into field errors', () => {
    const e = fromEnvelope(
      { errors: [{ field: 'a', message: 'one' }, { path: 'a', message: 'two' }, 'loose', null] },
      422,
    )
    expect(e.code).toBe('VALIDATION')
    expect(e.fieldErrors).toEqual({ a: ['one', 'two'], _root: ['loose', 'null'] })
  })

  it('handles empty and text bodies and keeps the cause', () => {
    const cause = new Error('http')
    const e = fromEnvelope(undefined, 503, { cause })
    expect(e.code).toBe('UNAVAILABLE')
    expect(e.cause).toBe(cause)
    expect(fromEnvelope('<html>', 502).message).toBeTruthy()
    expect(fromEnvelope(null).status).toBe(500)
  })

  it('wraps and unwraps results', () => {
    expect(unwrapEnvelope(okEnvelope(5))).toBe(5)
    const failed = failEnvelope(KitrError.forbidden())
    expect(failed).toEqual({ ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    expect(() => unwrapEnvelope(failed)).toThrow(KitrError)
    try {
      unwrapEnvelope(failEnvelope(KitrError.validation({ a: ['x'] })))
    } catch (e) {
      expect((e as KitrError).fieldErrors).toEqual({ a: ['x'] })
    }
  })
})

describe('keyFor', () => {
  it('builds [source, name, ...parts]', () => {
    expect(keyFor('action', 'projects.list')).toEqual(['action', 'projects.list'])
    expect(keyFor('api', 'p.show', { id: 1 }, {})).toEqual(['api', 'p.show', { id: 1 }, {}])
  })

  it('drops trailing undefined and keeps null', () => {
    expect(keyFor('a', 'n', undefined, undefined)).toEqual(['a', 'n'])
    expect(keyFor('a', 'n', null)).toEqual(['a', 'n', null])
    expect(keyFor('a', 'n', undefined, 1)).toEqual(['a', 'n', undefined, 1])
  })

  it('is stable regardless of property order', () => {
    const a = keyFor('a', 'n', { b: 1, a: { d: [1, { y: 1, x: undefined }], c: 2 } })
    const b = keyFor('a', 'n', { a: { c: 2, d: [1, { y: 1 }] }, b: 1 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(serializeKey(a)).toBe(serializeKey(b))
  })

  it('leaves non-plain values alone', () => {
    const d = new Date(0)
    expect(keyFor('a', 'n', d)[2]).toBe(d)
  })
})

describe('abort signals', () => {
  it('never aborts with no signals and passes a single one through', () => {
    expect(linkSignals().aborted).toBe(false)
    expect(linkSignals(undefined, null).aborted).toBe(false)
    const c = new AbortController()
    expect(linkSignals(c.signal)).toBe(c.signal)
  })

  it('aborts when any linked signal does, with its reason', () => {
    const a = new AbortController()
    const b = new AbortController()
    const linked = linkSignals(a.signal, b.signal)
    expect(linked.aborted).toBe(false)
    b.abort('stop')
    expect(linked.aborted).toBe(true)
    expect(linked.reason).toBe('stop')
  })

  it('is aborted at once when an input already is', () => {
    expect(linkSignals(AbortSignal.abort('gone'), new AbortController().signal).aborted).toBe(true)
  })

  it('falls back to listeners without AbortSignal.any', () => {
    const any = AbortSignal.any
    // @ts-expect-error simulate an older runtime
    AbortSignal.any = undefined
    try {
      const a = new AbortController()
      const b = new AbortController()
      const linked = linkSignals(a.signal, b.signal)
      a.abort('x')
      expect(linked.aborted).toBe(true)
      expect(linked.reason).toBe('x')
      expect(linkSignals(AbortSignal.abort('early'), b.signal).reason).toBe('early')
    } finally {
      AbortSignal.any = any
    }
  })

  it('times out with a TimeoutError', async () => {
    const s = timeoutSignal(20)
    expect(s.aborted).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(s.aborted).toBe(true)
    expect((s.reason as Error).name).toBe('TimeoutError')
  })

  it('withTimeout combines the caller signal and a timeout', () => {
    const c = new AbortController()
    expect(withTimeout(c.signal)).toBe(c.signal)
    expect(withTimeout(undefined, 0).aborted).toBe(false)
    const both = withTimeout(c.signal, 10_000)
    c.abort()
    expect(both.aborted).toBe(true)
  })
})

describe('headers', () => {
  const cookies = 'a=1; kitr-csrf=tok%20en; other=x'

  it('reads cookies, decoding values', () => {
    expect(readCookie('kitr-csrf', cookies)).toBe('tok en')
    expect(readCookie('missing', cookies)).toBeUndefined()
    expect(readCookie('x', '')).toBeUndefined()
    expect(readCookie('x', 'x=%E0%A4%A')).toBeUndefined()
    expect(readCookie('x')).toBeUndefined() // no document in node
  })

  it('sets a bearer token or a bare token on a custom header', () => {
    expect(bearerValue('t')).toBe('Bearer t')
    expect(bearerValue('t', 'x-api-key')).toBe('t')
    const h = applyRequestHeaders(new Headers(), { method: 'GET', token: 't' })
    expect(h.get('authorization')).toBe('Bearer t')
    const k = applyRequestHeaders(new Headers(), {
      method: 'GET',
      token: 't',
      authHeader: 'x-api-key',
    })
    expect(k.get('x-api-key')).toBe('t')
    expect(
      applyRequestHeaders(new Headers(), { method: 'GET', token: null }).has('authorization'),
    ).toBe(false)
  })

  it('echoes the CSRF cookie on writes only, and never over a caller header', () => {
    expect(
      applyRequestHeaders(new Headers(), { method: 'POST', cookies }).get('x-csrf-token'),
    ).toBe('tok en')
    for (const method of ['GET', 'head', 'OPTIONS'])
      expect(applyRequestHeaders(new Headers(), { method, cookies }).has('x-csrf-token')).toBe(
        false,
      )
    const own = new Headers({ 'x-csrf-token': 'mine' })
    expect(applyRequestHeaders(own, { method: 'PUT', cookies }).get('x-csrf-token')).toBe('mine')
    expect(
      applyRequestHeaders(new Headers(), { method: 'POST', cookies: 'a=1' }).has('x-csrf-token'),
    ).toBe(false)
  })

  it('can be switched off or renamed', () => {
    expect(
      applyRequestHeaders(new Headers(), { method: 'POST', cookies, csrf: false }).has(
        'x-csrf-token',
      ),
    ).toBe(false)
    const h = applyRequestHeaders(new Headers(), {
      method: 'POST',
      cookies: 'xsrf=v',
      csrf: { cookie: 'xsrf', header: 'x-xsrf' },
    })
    expect(h.get('x-xsrf')).toBe('v')
  })

  it('adds a request id when asked, without replacing one', () => {
    expect(applyRequestHeaders(new Headers(), { method: 'GET' }).has('x-request-id')).toBe(false)
    const generated = applyRequestHeaders(new Headers(), { method: 'GET', requestId: true })
    expect(generated.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(
      applyRequestHeaders(new Headers(), { method: 'GET', requestId: 'req-1' }).get('x-request-id'),
    ).toBe('req-1')
    const own = new Headers({ 'x-request-id': 'keep' })
    expect(applyRequestHeaders(own, { method: 'GET', requestId: true }).get('x-request-id')).toBe(
      'keep',
    )
  })
})
