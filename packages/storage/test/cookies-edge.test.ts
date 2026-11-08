import { describe, expect, it } from 'vitest'
import {
  defineCookie,
  parseCookies,
  serializeCookie,
  setCookieDefaults,
  setStoragePrefix,
} from '../src'
import { cookies } from '../src/server'

describe('cookie edge cases', () => {
  it('parseCookies tolerates junk and bad encodings', () => {
    expect(parseCookies('a=1; ; =x; b; c=%E0%A4%A; d = two words ')).toEqual({
      a: '1',
      c: '%E0%A4%A',
      d: 'two words',
    })
    expect(parseCookies(undefined)).toEqual({})
  })

  it('values with separators survive a round trip', () => {
    const c = defineCookie('tricky', { default: '' })
    const header = c.serialize('a=b; c, d').split(';')[0]
    expect(c.get(header)).toBe('a=b; c, d')
  })

  it('serializeCookie writes every attribute and SameSite=None implies Secure', () => {
    const v = serializeCookie('s', 'v', {
      maxAge: 10.9,
      expires: new Date(0),
      domain: 'kitr.dev',
      httpOnly: true,
      sameSite: 'none',
    })
    expect(v).toBe(
      's=v; Max-Age=10; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=kitr.dev; Path=/; Secure; HttpOnly; SameSite=None',
    )
    expect(serializeCookie('s', null)).toContain('Max-Age=0')
  })

  it('applies defaults and prefixes from config', () => {
    setCookieDefaults({ secure: true })
    setStoragePrefix('app:')
    try {
      const c = defineCookie('n', { default: 1 })
      expect(c.serialize(2)).toMatch(/^app%3An=2|^app:n=2/)
      expect(c.serialize(2)).toContain('Secure')
      expect(c.get('app:n=5')).toBe(5)
    } finally {
      setCookieDefaults({})
      setStoragePrefix('')
    }
  })

  it('invalid JSON or schema failures fall back to the default', () => {
    const c = defineCookie<{ a: number }>('j', { default: { a: 0 } })
    expect(c.get('j=%7Bnot-json')).toEqual({ a: 0 })
  })

  it('server cookies work from a Request and response Headers', () => {
    const c = defineCookie('sid', { default: '', httpOnly: true })
    const res = new Headers()
    const jar = cookies(new Request('http://x', { headers: { cookie: 'sid=abc' } }), res)
    expect(jar.header).toBe('sid=abc')
    expect(jar.get(c)).toBe('abc')
    jar.set(c, 'def')
    jar.remove(c)
    expect(res.getSetCookie()).toHaveLength(2)
    expect(res.getSetCookie()[0]).toContain('HttpOnly')
  })
})
