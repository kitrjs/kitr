// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineCookie, defineStorage, parseCookies, serializeCookie } from '../src'
import { cookies } from '../src/server'

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('defineStorage', () => {
  it('stores typed values, keeps identity for unchanged raw, and notifies', () => {
    const item = defineStorage('sidebar', { default: { open: true } })
    expect(item.get()).toEqual({ open: true })
    const seen: unknown[] = []
    const off = item.subscribe((v) => seen.push(v))
    item.set({ open: false })
    expect(item.get()).toEqual({ open: false })
    expect(item.get()).toBe(item.get())
    item.set((s) => ({ open: !s.open }))
    expect(seen).toEqual([{ open: false }, { open: true }])
    off()
    item.remove()
    expect(item.get()).toEqual({ open: true })
    expect(localStorage.getItem('sidebar')).toBeNull()
  })

  it('validates with a schema, migrates versions and expires with ttl', () => {
    localStorage.setItem('n', JSON.stringify({ v: 1, d: 'not a number' }))
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (v: unknown) =>
          typeof v === 'number' ? { value: v } : { issues: [{ message: 'nope' }] },
      },
    }
    const n = defineStorage<number>('n', { default: 0, schema })
    expect(n.get()).toBe(0)
    n.set(5)
    expect(n.get()).toBe(5)

    localStorage.setItem('shape', JSON.stringify({ v: 1, d: { name: 'x' } }))
    const shape = defineStorage<{ fullName: string }>('shape', {
      default: { fullName: '' },
      version: 2,
      migrate: (raw) => ({ fullName: (raw as { name: string }).name }),
    })
    expect(shape.get()).toEqual({ fullName: 'x' })

    localStorage.setItem('old', JSON.stringify({ v: 1, d: 'stale', e: Date.now() - 1 }))
    expect(defineStorage('old', { default: 'fresh', ttl: 1000 }).get()).toBe('fresh')
  })

  it('uses sessionStorage when asked', () => {
    const item = defineStorage('tab', { default: 'a', area: 'session' })
    item.set('b')
    expect(sessionStorage.getItem('tab')).toContain('"b"')
    expect(localStorage.getItem('tab')).toBeNull()
  })
})

describe('cookies', () => {
  it('parses and serializes', () => {
    expect(parseCookies('a=1; b=hello%20world; bad')).toEqual({ a: '1', b: 'hello world' })
    expect(serializeCookie('a', 'x y', { maxAge: 60, httpOnly: true, sameSite: 'strict' })).toBe(
      'a=x%20y; Max-Age=60; Path=/; HttpOnly; SameSite=Strict',
    )
    expect(serializeCookie('a', null)).toContain('Max-Age=0')
  })

  it('reads typed cookies from any source and writes document.cookie', () => {
    const locale = defineCookie('locale', { default: 'en' })
    const prefs = defineCookie('prefs', { default: { dense: false } })
    expect(locale.get('locale=de')).toBe('de')
    expect(locale.get(new Headers({ cookie: 'locale=fr' }))).toBe('fr')
    expect(locale.get(null)).toBe('en')
    expect(prefs.get(`prefs=${encodeURIComponent(JSON.stringify({ dense: true }))}`)).toEqual({
      dense: true,
    })
    expect(prefs.get('prefs=garbage')).toEqual({ dense: false })
    locale.set('it')
    expect(document.cookie).toContain('locale=it')
    expect(locale.get()).toBe('it')
    locale.remove()
    expect(locale.get()).toBe('en')
  })

  it('server helper reads the request and appends Set-Cookie', () => {
    const locale = defineCookie('locale', { default: 'en', maxAge: 10 })
    const event = {
      req: { headers: new Headers({ cookie: 'locale=de' }) },
      res: { headers: new Headers() },
    }
    const jar = cookies(event)
    expect(jar.get(locale)).toBe('de')
    jar.set(locale, 'fr', { httpOnly: true })
    jar.remove(locale)
    const set = event.res.headers.getSetCookie()
    expect(set[0]).toBe('locale=fr; Max-Age=10; Path=/; HttpOnly; SameSite=Lax')
    expect(set[1]).toContain('Max-Age=0')
    const viaRequest = cookies(
      { headers: new Headers({ cookie: 'locale=es' }) } as Request,
      new Headers(),
    )
    expect(viaRequest.get(locale)).toBe('es')
  })
})
