// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

/** A browser talking to the server: keeps cookies and echoes the CSRF token, as the api client does. */
function browser() {
  const jar = new Map<string, string>()
  const send = async (method: string, path: string, body?: unknown) => {
    const headers = new Headers({ accept: 'application/json' })
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => k + '=' + v).join('; '))
    const csrf = jar.get('kitr-csrf')
    if (csrf && method !== 'GET') headers.set('x-csrf-token', csrf)
    if (body !== undefined) headers.set('content-type', 'application/json')
    const res = await server.fetch(
      new Request('http://app' + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    for (const cookie of res.headers.getSetCookie()) {
      const [pair = '', ...attrs] = cookie.split('; ')
      const i = pair.indexOf('=')
      if (attrs.includes('Max-Age=0')) jar.delete(pair.slice(0, i))
      else jar.set(pair.slice(0, i), pair.slice(i + 1))
    }
    return res
  }
  return { send, jar }
}

const admin = { email: 'admin@example.com', password: 'password' }
const sentTo = async (email: string) => {
  const mailer = server.app.container.use('mailer')
  const message = [...mailer.sent].reverse().find((m) => m.to.some((a) => a.email === email))
  return decodeURIComponent(/token=([^\s)"&<]+)/.exec(message?.text ?? '')?.[1] ?? '')
}

describe('auth', () => {
  it('answers anonymous visitors and hands out the CSRF cookie', async () => {
    const { send, jar } = browser()
    const res = await send('GET', '/api/auth/session')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { user: unknown }).user).toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(jar.has('kitr-csrf')).toBe(true)
  })

  it('signs in with an HttpOnly cookie, reads the session, and signs out', async () => {
    const { send, jar } = browser()
    await send('GET', '/api/auth/session')
    const signIn = await send('POST', '/api/auth/sign-in', admin)
    expect(signIn.status).toBe(200)
    expect(signIn.headers.get('set-cookie')).toMatch(/kitr-session=.*HttpOnly.*SameSite=Lax/)
    expect(jar.has('kitr-session')).toBe(true)

    const session = (await (await send('GET', '/api/auth/session')).json()) as { user: { email: string; role: string } }
    expect(session.user).toMatchObject({ email: 'admin@example.com', role: 'admin' })
    expect((await send('GET', '/api/projects')).status).toBe(200)

    expect((await send('POST', '/api/auth/sign-out')).status).toBe(204)
    expect(jar.has('kitr-session')).toBe(false)
    expect((await send('GET', '/api/projects')).status).toBe(401)
  })

  it('refuses a wrong password, a missing CSRF token and anonymous project reads', async () => {
    const { send } = browser()
    await send('GET', '/api/auth/session')
    expect((await send('POST', '/api/auth/sign-in', { ...admin, password: 'nope' })).status).toBe(401)
    expect((await send('GET', '/api/projects')).status).toBe(401)
    const noToken = await server.fetch(
      new Request('http://app/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(admin),
      }),
    )
    expect(noToken.status).toBe(403)
  })

  it('creates projects owned by the signed-in user and validates them', async () => {
    const { send } = browser()
    await send('GET', '/api/auth/session')
    await send('POST', '/api/auth/sign-in', { email: 'member@example.com', password: 'password' })
    const created = await send('POST', '/api/projects', { name: 'Launch plan' })
    expect(created.status).toBe(201)
    expect(((await created.json()) as { owner: string }).owner).toBe('member@example.com')
    expect((await send('POST', '/api/projects', { name: 'x' })).status).toBe(422)
  })

  it('signs up, emails a verification link and confirms the address', async () => {
    const { send } = browser()
    await send('GET', '/api/auth/session')
    const res = await send('POST', '/api/auth/sign-up', { email: 'new@example.com', password: 'a-long-password' })
    expect(res.status).toBe(201)
    const token = await sentTo('new@example.com')
    expect(token).not.toBe('')
    expect((await send('POST', '/api/auth/verify-email', { token })).status).toBe(204)
    expect((await send('POST', '/api/auth/verify-email', { token: 'forged' })).status).toBe(400)
  })

  it('resets a password once and signs out every device', async () => {
    const phone = browser()
    await phone.send('GET', '/api/auth/session')
    await phone.send('POST', '/api/auth/sign-in', admin)
    const laptop = browser()
    await laptop.send('GET', '/api/auth/session')
    await laptop.send('POST', '/api/auth/sign-up', { email: 'reset@example.com', password: 'old-password-1' })

    expect((await laptop.send('POST', '/api/auth/password/forgot', { email: 'reset@example.com' })).status).toBe(202)
    const token = await sentTo('reset@example.com')
    expect((await laptop.send('POST', '/api/auth/password/reset', { token, password: 'new-password-2' })).status).toBe(204)
    expect((await laptop.send('GET', '/api/projects')).status).toBe(401)
    // The link was good once.
    expect((await laptop.send('POST', '/api/auth/password/reset', { token, password: 'third-password-3' })).status).toBe(400)
    expect((await laptop.send('POST', '/api/auth/sign-in', { email: 'reset@example.com', password: 'new-password-2' })).status).toBe(200)
    // Another account's sessions are untouched.
    expect((await phone.send('GET', '/api/projects')).status).toBe(200)
  })
})
