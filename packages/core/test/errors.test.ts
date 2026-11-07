import { describe, expect, it } from 'vitest'
import { isKitrError, isKitrErrorShape, KitrError, toKitrError } from '../src/errors'

describe('KitrError', () => {
  it.each([
    ['BAD_REQUEST', 400],
    ['VALIDATION', 422],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['RATE_LIMITED', 429],
    ['INTERNAL', 500],
    ['UNAVAILABLE', 503],
    ['NETWORK', 0],
    ['TIMEOUT', 408],
    ['SOMETHING_CUSTOM', 500],
  ])('%s defaults to status %i', (code, status) => {
    expect(new KitrError(code).status).toBe(status)
  })

  it('humanizes the code when no message is given', () => {
    expect(new KitrError('RATE_LIMITED').message).toBe('Rate limited')
  })

  it('keeps cause and serialises only wire fields', () => {
    const cause = new Error('root')
    const e = new KitrError('CONFLICT', 'Taken', { data: { id: 1 }, cause })
    expect(e.cause).toBe(cause)
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('KitrError')
    expect(JSON.parse(JSON.stringify(e))).toEqual({
      code: 'CONFLICT',
      message: 'Taken',
      status: 409,
      data: { id: 1 },
    })
  })

  it('has factories for the common cases', () => {
    expect(KitrError.notFound('Project').message).toBe('Project not found')
    expect(KitrError.unauthorized().status).toBe(401)
    expect(KitrError.forbidden().status).toBe(403)
    expect(KitrError.fromStatus(418).code).toBe('BAD_REQUEST')
    expect(KitrError.fromStatus(502).code).toBe('INTERNAL')
    expect(KitrError.fromStatus(502).status).toBe(502)
    expect(KitrError.fromStatus(404, 'gone', { x: 1 }).toJSON()).toEqual({
      code: 'NOT_FOUND',
      message: 'gone',
      status: 404,
      data: { x: 1 },
    })
  })
})

describe('guards', () => {
  it('recognises instances across realms by marker', () => {
    const foreign = { __kitrError: true, code: 'X', message: 'm', status: 400 }
    expect(isKitrError(new KitrError('X'))).toBe(true)
    expect(isKitrError(foreign)).toBe(true)
    expect(isKitrError(new Error('x'))).toBe(false)
    expect(isKitrError(null)).toBe(false)
  })

  it('recognises the wire shape', () => {
    expect(isKitrErrorShape({ code: 'A', message: 'b', status: 1 })).toBe(true)
    expect(isKitrErrorShape({ code: 'A', message: 'b' })).toBe(false)
    expect(isKitrErrorShape('nope')).toBe(false)
  })
})

describe('toKitrError', () => {
  it('passes KitrErrors through untouched', () => {
    const e = new KitrError('NOT_FOUND')
    expect(toKitrError(e)).toBe(e)
  })

  it('revives foreign-realm errors and wire shapes', () => {
    const revived = toKitrError({
      __kitrError: true,
      code: 'VALIDATION',
      message: 'bad',
      status: 422,
      fieldErrors: { a: ['x'] },
    })
    expect(revived).toBeInstanceOf(KitrError)
    expect(revived.fieldErrors).toEqual({ a: ['x'] })
    expect(toKitrError({ code: 'CONFLICT', message: 'dup', status: 409 }).code).toBe('CONFLICT')
  })

  it('maps errors that carry an HTTP status', () => {
    const err = Object.assign(new Error('nope'), { statusCode: 403 })
    expect(toKitrError(err).code).toBe('FORBIDDEN')
  })

  it('maps aborts to TIMEOUT and fetch failures to NETWORK', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(toKitrError(abort).code).toBe('TIMEOUT')
    expect(toKitrError(new TypeError('fetch failed')).code).toBe('NETWORK')
    expect(toKitrError(new TypeError('x is not a function')).code).toBe('INTERNAL')
  })

  it('wraps strings and other values with the fallback code', () => {
    expect(toKitrError('boom').message).toBe('boom')
    expect(toKitrError(42, 'NETWORK')).toMatchObject({ code: 'NETWORK', data: 42 })
    expect(toKitrError(undefined).code).toBe('INTERNAL')
  })
})
