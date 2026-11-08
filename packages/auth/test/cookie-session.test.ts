import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCookieSession,
  createMemorySessionStore,
  createToken,
  fingerprint,
  readCookie,
  readToken,
  safeEqual,
  signValue,
  unsignValue,
} from '../src/server'

const SECRET = 'a-secret-that-is-at-least-32-characters-long'

const make = (options: Partial<Parameters<typeof createCookieSession>[0]> = {}) => {
  const store = createMemorySessionStore()
  const sessions = createCookieSession({ secret: SECRET, store, ...options })
  return { store, sessions }
}

/** The request a browser would send after receiving these Set-Cookie headers. */
const browser = (response: Headers) => {
  const jar = response
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return new Request('http://app/', { headers: { cookie: jar } })
}

describe('createCookieSession', () => {
  it('refuses a short secret', () => {
    expect(() => createCookieSession({ secret: 'short', store: createMemorySessionStore() })).toThrow(
      /at least 32/,
    )
    expect(() => createCookieSession({ secret: [], store: createMemorySessionStore() })).toThrow(
      /at least 32/,
    )
  })

  it('issues an HttpOnly, SameSite=Lax, signed cookie and resolves it back', async () => {
    const { sessions } = make()
    const res = new Headers()
    const record = await sessions.create('u1', res)
    const cookie = res.get('set-cookie')!
    expect(cookie).toMatch(/^kitr-session=[\w-]+\.[\w-]+;/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toMatch(/Max-Age=\d+/)
    expect(cookie).not.toContain('Secure')
    expect((await sessions.resolve(browser(res)))?.id).toBe(record.id)
  })

  it('adds Secure in production and honours cookie options', async () => {
    const { sessions } = make({
      cookie: { production: true, name: 'sid', domain: '.acme.com', path: '/app', sameSite: 'strict' },
    })
    const res = new Headers()
    await sessions.create('u1', res)
    const cookie = res.get('set-cookie')!
    expect(cookie).toMatch(/^sid=/)
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Domain=.acme.com')
    expect(cookie).toContain('Path=/app')
    expect(cookie).toContain('SameSite=Strict')
    expect(sessions.cookieName).toBe('sid')
  })

  it('takes Secure from the production mode when none is given', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const { sessions } = make()
      const res = new Headers()
      await sessions.create('u1', res)
      expect(res.get('set-cookie')).toContain('Secure')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects a tampered, unsigned or foreign cookie', async () => {
    const { sessions } = make()
    const res = new Headers()
    const record = await sessions.create('u1', res)
    const value = res.get('set-cookie')!.split(';')[0]!.split('=')[1]!
    const forged = [
      `kitr-session=${record.id}`,
      `kitr-session=${record.id}.AAAA`,
      `kitr-session=${value.slice(0, -2)}xx`,
      `kitr-session=${record.id}.!!!`,
      'kitr-session=.',
      'kitr-session=',
    ]
    for (const cookie of forged)
      expect(await sessions.resolve(new Request('http://app/', { headers: { cookie } }))).toBeNull()
    const other = make({ secret: 'another-secret-that-is-32-characters-ok' }).sessions
    expect(await other.resolve(browser(res))).toBeNull()
  })

  it('resolves null for no cookie and for a signed id the store does not know', async () => {
    const { sessions, store } = make()
    expect(await sessions.resolve(new Request('http://app/'))).toBeNull()
    const res = new Headers()
    const record = await sessions.create('u1', res)
    await store.delete(record.id)
    expect(await sessions.resolve(browser(res))).toBeNull()
  })

  it('accepts Headers as the request', async () => {
    const { sessions } = make()
    const res = new Headers()
    await sessions.create('u1', res)
    const headers = new Headers({ cookie: res.get('set-cookie')!.split(';')[0]! })
    expect((await sessions.resolve(headers))?.userId).toBe('u1')
  })

  it('rotates the id on every sign-in and destroys the one that came with the request', async () => {
    const { sessions, store } = make()
    const first = new Headers()
    const a = await sessions.create('u1', first)
    const second = new Headers()
    const b = await sessions.create('u1', second, { request: browser(first), data: { via: 'password' } })
    expect(b.id).not.toBe(a.id)
    expect(b.data).toEqual({ via: 'password' })
    expect(await store.get(a.id)).toBeNull()
    expect((await sessions.resolve(browser(second)))?.id).toBe(b.id)
    expect(await sessions.resolve(browser(first))).toBeNull()
  })

  it('rotates a live session in place, keeping the user and the absolute lifetime', async () => {
    const { sessions, store } = make()
    const first = new Headers()
    const a = await sessions.create('u1', first)
    const next = new Headers()
    const b = await sessions.rotate(browser(first), next)
    expect(b?.id).not.toBe(a.id)
    expect(b?.userId).toBe('u1')
    expect(b?.createdAt).toBe(a.createdAt)
    expect(await store.get(a.id)).toBeNull()
    expect((await sessions.resolve(browser(next)))?.id).toBe(b?.id)
    expect(await sessions.rotate(new Request('http://app/'), new Headers())).toBeNull()
  })

  it('destroys the session and expires the cookie', async () => {
    const { sessions } = make()
    const res = new Headers()
    await sessions.create('u1', res)
    const out = new Headers()
    await sessions.destroy(browser(res), out)
    expect(out.get('set-cookie')).toMatch(/Max-Age=0/)
    expect(out.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970')
    expect(await sessions.resolve(browser(res))).toBeNull()
    // Destroying with no session is fine and still expires the cookie.
    const none = new Headers()
    await sessions.destroy(new Request('http://app/'), none)
    expect(none.get('set-cookie')).toMatch(/Max-Age=0/)
  })

  it('revokes one session, or every session of a user', async () => {
    const { sessions } = make()
    const phone = new Headers()
    const laptop = new Headers()
    const other = new Headers()
    const p = await sessions.create('u1', phone)
    await sessions.create('u1', laptop)
    await sessions.create('u2', other)
    expect(await sessions.list('u1')).toHaveLength(2)
    await sessions.revoke(p.id)
    expect(await sessions.resolve(browser(phone))).toBeNull()
    expect(await sessions.resolve(browser(laptop))).not.toBeNull()
    expect(await sessions.revokeAll('u1')).toBe(1)
    expect(await sessions.resolve(browser(laptop))).toBeNull()
    expect(await sessions.resolve(browser(other))).not.toBeNull()
  })

  it('verifies cookies signed with an older secret after rotation and signs with the first', async () => {
    const store = createMemorySessionStore()
    const old = createCookieSession({ secret: SECRET, store })
    const res = new Headers()
    await old.create('u1', res)
    const rotated = createCookieSession({
      secret: ['brand-new-secret-with-32-characters!!', SECRET],
      store,
    })
    expect((await rotated.resolve(browser(res)))?.userId).toBe('u1')
    const fresh = new Headers()
    await rotated.create('u1', fresh)
    expect(await old.resolve(browser(fresh))).toBeNull()
    const [id, sig] = fresh.get('set-cookie')!.split(';')[0]!.split('=')[1]!.split('.')
    expect(await unsignValue(`${id}.${sig}`, ['brand-new-secret-with-32-characters!!'])).toBe(id)
  })
})

describe('sliding and absolute expiry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('extends the session and re-sends the cookie once a quarter of the idle time has passed', async () => {
    const { sessions } = make({ maxAge: 1000, absoluteMaxAge: 10_000 })
    const res = new Headers()
    const created = await sessions.create('u1', res)
    // Soon after: nothing to refresh.
    vi.advanceTimersByTime(100_000)
    const quiet = new Headers()
    const same = await sessions.resolve(browser(res), quiet)
    expect(same?.expiresAt).toBe(created.expiresAt)
    expect(quiet.getSetCookie()).toEqual([])
    // Past a quarter of the idle time: the expiry slides and a new cookie goes out.
    vi.advanceTimersByTime(400_000)
    const out = new Headers()
    const slid = await sessions.resolve(browser(res), out)
    expect(slid!.expiresAt).toBeGreaterThan(created.expiresAt)
    expect(out.get('set-cookie')).toMatch(/Max-Age=\d+/)
  })

  it('expires an idle session', async () => {
    const { sessions } = make({ maxAge: 60 })
    const res = new Headers()
    await sessions.create('u1', res)
    vi.advanceTimersByTime(61_000)
    expect(await sessions.resolve(browser(res))).toBeNull()
  })

  it('never slides past the absolute lifetime', async () => {
    const { sessions } = make({ maxAge: 100, absoluteMaxAge: 150 })
    const res = new Headers()
    const created = await sessions.create('u1', res)
    vi.advanceTimersByTime(60_000)
    const slid = await sessions.resolve(browser(res), new Headers())
    expect(slid!.expiresAt).toBe(created.createdAt + 150_000)
    vi.advanceTimersByTime(50_000)
    // Absolute end reached: no further extension, then gone.
    expect((await sessions.resolve(browser(res)))?.expiresAt).toBe(created.createdAt + 150_000)
    vi.advanceTimersByTime(60_000)
    expect(await sessions.resolve(browser(res))).toBeNull()
  })
})

describe('signing helpers', () => {
  it('signs and verifies values, with constant-time comparison helpers', async () => {
    const signed = await signValue('hello', SECRET)
    expect(await unsignValue(signed, [SECRET])).toBe('hello')
    expect(await unsignValue(signed, ['x'.repeat(32)])).toBeNull()
    expect(await unsignValue('no-dot', [SECRET])).toBeNull()
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })

  it('reads one cookie out of a header, from Headers or a Request', () => {
    const headers = new Headers({ cookie: 'a=1; kitr-session=xyz; b=2' })
    expect(readCookie(headers, 'kitr-session')).toBe('xyz')
    expect(readCookie(new Request('http://app/', { headers }), 'b')).toBe('2')
    expect(readCookie(headers, 'missing')).toBeUndefined()
    expect(readCookie(new Headers(), 'a')).toBeUndefined()
  })
})

describe('email-link tokens', () => {
  const { sessions } = make()

  it('reads back the subject of a genuine token for the right purpose', async () => {
    const token = await createToken(sessions, 'verify-email', 'u1', 60)
    expect(await readToken(sessions, 'verify-email', token)).toBe('u1')
    expect(await readToken(sessions, 'reset-password', token)).toBeNull()
  })

  it('rejects an expired, tampered or garbage token', async () => {
    vi.useFakeTimers()
    try {
      const token = await createToken(sessions, 'reset-password', 'u1', 60)
      expect(await readToken(sessions, 'reset-password', `${token}x`)).toBeNull()
      expect(await readToken(sessions, 'reset-password', 'garbage')).toBeNull()
      expect(await readToken(sessions, 'reset-password', await sessions.sign('not-json'))).toBeNull()
      vi.advanceTimersByTime(61_000)
      expect(await readToken(sessions, 'reset-password', token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops working when what it was bound to changes', async () => {
    const token = await createToken(sessions, 'reset-password', 'u1', 60, await fingerprint('hash-1'))
    expect(await readToken(sessions, 'reset-password', token, async () => fingerprint('hash-1'))).toBe('u1')
    expect(await readToken(sessions, 'reset-password', token, async () => fingerprint('hash-2'))).toBeNull()
    expect(await fingerprint('a')).toBe(await fingerprint('a'))
    expect(await fingerprint('a')).not.toBe(await fingerprint('b'))
  })
})
