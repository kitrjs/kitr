import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '../server'

it('answers health', async () => {
  const client = createTestClient(server)
  const res = await client.get<{ ok: boolean }>('/api/health')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
