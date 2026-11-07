import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterAll, describe, expect, it } from 'vitest'
import { accepts, checkFile, formatBytes, upload } from '../src'
import uploadsProvider from '../src/provider'
import { createDiskUploadsDriver, createMemoryUploadsDriver, createUploads } from '../src/server'

const dir = mkdtempSync(join(tmpdir(), 'kitr-uploads-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function multipart(files: Array<{ name: string; type: string; body: string }>, field = 'file') {
  const form = new FormData()
  for (const f of files) form.append(field, new File([f.body], f.name, { type: f.type }))
  return form
}

describe('uploads', () => {
  it('matches accept patterns and checks files on the client', () => {
    expect(accepts('image/png', 'a.png', ['image/*'])).toBe(true)
    expect(accepts('application/pdf', 'a.pdf', ['.pdf'])).toBe(true)
    expect(accepts('text/plain', 'a.txt', ['image/*', '.pdf'])).toBe(false)
    expect(accepts('text/plain', 'a.txt')).toBe(true)
    expect(checkFile(new File(['x'.repeat(10)], 'a.txt'), { maxSize: 5 })).toMatch(/larger/)
    expect(
      checkFile(new File(['x'], 'a.txt', { type: 'text/plain' }), { accept: ['image/*'] }),
    ).toMatch(/type/)
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('receives, stores and serves files on disk with the rules enforced', async () => {
    const uploads = createUploads({
      driver: createDiskUploadsDriver({ dir }),
      maxSize: 100,
      accept: ['text/*'],
    })
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    uploads.mount(server)
    const ok = await server.fetch(
      new Request('http://x/api/uploads', {
        method: 'POST',
        body: multipart([{ name: 'hello world.txt', type: 'text/plain', body: 'hi there' }]),
      }),
    )
    expect(ok.status).toBe(200)
    const { files } = (await ok.json()) as { files: any[] }
    expect(files[0]).toMatchObject({ name: 'hello world.txt', size: 8, type: 'text/plain' })
    expect(files[0].key).toMatch(/\/hello-world.txt$/)
    const served = await server.fetch(new Request(`http://x/api/uploads/${files[0].key}`))
    expect(served.headers.get('content-type')).toBe('text/plain')
    expect(await served.text()).toBe('hi there')

    const tooBig = await server.fetch(
      new Request('http://x/api/uploads', {
        method: 'POST',
        body: multipart([{ name: 'big.txt', type: 'text/plain', body: 'x'.repeat(101) }]),
      }),
    )
    expect(tooBig.status).toBe(422)
    const wrongType = await server.fetch(
      new Request('http://x/api/uploads', {
        method: 'POST',
        body: multipart([{ name: 'a.png', type: 'image/png', body: 'png' }]),
      }),
    )
    expect(wrongType.status).toBe(422)
    const notMultipart = await server.fetch(
      new Request('http://x/api/uploads', { method: 'POST', body: 'plain' }),
    )
    expect(notMultipart.status).toBe(422)
    expect((await server.fetch(new Request('http://x/api/uploads/nope/x.txt'))).status).toBe(404)

    await uploads.remove(files[0].key)
    expect(await uploads.read(files[0].key)).toBeUndefined()
  })

  it('upload() falls back to fetch outside the browser', async () => {
    const uploads = createUploads({ driver: createMemoryUploadsDriver(), publicPath: '/files' })
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    uploads.mount(server, '/up')
    const original = globalThis.fetch
    globalThis.fetch = ((url: string, init: RequestInit) =>
      server.fetch(new Request(`http://x${url}`, init))) as any
    try {
      const [file] = await upload(new File(['abc'], 'a.txt', { type: 'text/plain' }), {
        url: '/up',
      })
      expect(file).toMatchObject({ name: 'a.txt', size: 3 })
      expect(file!.url).toMatch(/^\/files\//)
      await expect(
        upload(new File(['abc'], 'a.txt'), { url: '/up', field: 'other' }),
      ).rejects.toMatchObject({ status: 422 })
    } finally {
      globalThis.fetch = original
    }
  })

  it('binds uploads on the server only', async () => {
    const app = createApp({
      environment: 'server',
      providers: [uploadsProvider],
      config: { uploads: { driver: createMemoryUploadsDriver() } },
    })
    await app.boot()
    const stored = await app.container
      .use('uploads')
      .store({ name: 'n.txt', type: 'text/plain', data: new TextEncoder().encode('x') })
    expect(stored.size).toBe(1)
    const client = createApp({ environment: 'client', providers: [uploadsProvider] })
    await client.boot()
    expect(client.container.has('uploads')).toBe(false)
  })
})
