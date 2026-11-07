// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#app/api/server'

describe('messages', () => {
  it('stores a message and lists it for the room', async () => {
    const post = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: 'hello' }),
      }),
    )
    expect(post.status).toBe(201)
    const list = await server.fetch(new Request('http://app/api/messages?room=tests'))
    const messages = (await list.json()) as Array<{ text: string }>
    expect(messages.at(-1)?.text).toBe('hello')
  })

  it('rejects empty messages', async () => {
    const res = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: '  ' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
