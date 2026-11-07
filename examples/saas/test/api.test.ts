// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('api', () => {
  it('signs in and lists projects', async () => {
    const signIn = await server.fetch(
      new Request('http://app/api/auth/sign-in', json({ email: 'me@example.com', password: 'password' })),
    )
    expect(signIn.status).toBe(201)
    const { token } = (await signIn.json()) as { token: string }

    const me = await server.fetch(
      new Request('http://app/api/auth/me', { headers: { authorization: 'Bearer ' + token } }),
    )
    expect(((await me.json()) as { email: string }).email).toBe('me@example.com')

    const list = await server.fetch(new Request('http://app/api/projects'))
    expect(list.status).toBe(200)
    expect(Array.isArray(await list.json())).toBe(true)
  })

  it('validates new projects', async () => {
    const res = await server.fetch(new Request('http://app/api/projects', json({ name: 'x' })))
    expect(res.status).toBe(422)
  })
})
