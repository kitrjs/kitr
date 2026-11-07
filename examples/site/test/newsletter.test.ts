// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#app/api/server'

describe('newsletter', () => {
  it('subscribes a valid email', async () => {
    const res = await server.fetch(
      new Request('http://app/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('rejects an invalid email', async () => {
    const res = await server.fetch(
      new Request('http://app/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nope' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
