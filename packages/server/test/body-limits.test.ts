import { silentLogger } from '@kitr/logger'
import { describe, expect, it } from 'vitest'
import { createServer } from '../src'

function post(
  server: ReturnType<typeof createServer>,
  path: string,
  bytes: number,
  declare = true,
) {
  const body = new Uint8Array(bytes)
  return server.fetch(
    new Request(`http://x${path}`, {
      method: 'POST',
      headers: declare ? { 'content-length': String(bytes) } : {},
      body,
    }),
  )
}

describe('per-path body limits', () => {
  const server = createServer({
    logger: silentLogger,
    server: {
      healthPath: false,
      bodyLimit: 100,
      bodyLimits: { '/api/uploads': 1000, '/api/uploads/small': 10 },
    },
  })
  server.h3.post('/**', async (event: any) => ({
    size: (await event.req.arrayBuffer()).byteLength,
  }))

  it('uses the default limit outside the listed prefixes', async () => {
    expect((await post(server, '/api/other', 100)).status).toBe(200)
    expect((await post(server, '/api/other', 101)).status).toBe(413)
    // A path that only starts with the same characters is not under the prefix.
    expect((await post(server, '/api/uploadsX', 500)).status).toBe(413)
  })

  it('applies the longest matching prefix, declared or streamed', async () => {
    expect((await post(server, '/api/uploads', 1000)).status).toBe(200)
    expect((await post(server, '/api/uploads/a/b', 1000)).status).toBe(200)
    expect((await post(server, '/api/uploads/a/b', 1001)).status).toBe(413)
    expect((await post(server, '/api/uploads/small', 11)).status).toBe(413)
    expect((await post(server, '/api/uploads', 1001, false)).status).toBe(413)
  })
})
