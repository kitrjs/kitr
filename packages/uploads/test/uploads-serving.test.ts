import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { describe, expect, it } from 'vitest'
import {
  createMemoryUploadsDriver,
  createUploads,
  resolveServedType,
  servedFileHeaders,
  signedUrl,
  sniffType,
  verifySignedUrl,
} from '../src/server'

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (s: string) => new TextEncoder().encode(s)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)
const SECRET = 'a-secret-of-at-least-16-chars'

function setup(config: Parameters<typeof createUploads>[0] = {}) {
  const uploads = createUploads({ driver: createMemoryUploadsDriver(), ...config })
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  uploads.mount(server)
  return { uploads, server }
}
const get = (server: { fetch(r: Request): Promise<Response> }, path: string) =>
  server.fetch(new Request(`http://x${path}`))

describe('sniffType', () => {
  it.each([
    ['image/png', PNG],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/gif', text('GIF89a....')],
    ['image/webp', text('RIFF\0\0\0\0WEBPVP8 ')],
    ['application/pdf', text('%PDF-1.7')],
    ['application/zip', bytes(0x50, 0x4b, 0x03, 0x04, 0)],
    ['application/gzip', bytes(0x1f, 0x8b, 8)],
    ['video/mp4', text('\0\0\0\x18ftypmp42')],
    ['image/avif', text('\0\0\0\x18ftypavif')],
    ['audio/wav', text('RIFF\0\0\0\0WAVEfmt ')],
  ])('recognises %s', (type, data) => {
    expect(sniffType(data)).toBe(type)
  })

  it('has no opinion on text, SVG and HTML', () => {
    expect(sniffType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeUndefined()
    expect(sniffType(text('<!doctype html><script>alert(1)</script>'))).toBeUndefined()
    expect(sniffType(text('a,b,c'))).toBeUndefined()
    expect(sniffType(new Uint8Array())).toBeUndefined()
  })
})

describe('what a stored file is served as', () => {
  it('trusts the bytes over the declared type', () => {
    // HTML declared as a PNG is not an image.
    expect(resolveServedType('image/png', text('<script>alert(1)</script>'))).toEqual({
      type: 'application/octet-stream',
      inline: false,
    })
    // A PNG declared as HTML is a PNG.
    expect(resolveServedType('text/html', PNG)).toEqual({ type: 'image/png', inline: true })
    // Archives are recognised but downloaded.
    expect(resolveServedType('image/png', bytes(0x50, 0x4b, 0x03, 0x04))).toEqual({
      type: 'application/zip',
      inline: false,
    })
  })

  it('serves allow-listed text types as themselves, and only plain text inline', () => {
    expect(resolveServedType('text/plain', text('hi'))).toEqual({
      type: 'text/plain',
      inline: true,
    })
    expect(resolveServedType('text/csv', text('a,b'))).toEqual({ type: 'text/csv', inline: false })
    expect(resolveServedType('text/html', text('<p>'))).toMatchObject({
      type: 'application/octet-stream',
    })
    expect(resolveServedType('text/markdown', text('# hi'), ['text/*'])).toEqual({
      type: 'text/markdown',
      inline: false,
    })
  })

  it('always sends nosniff, and a download for everything that is not safe inline', async () => {
    const { uploads, server } = setup()
    const cases: Array<[string, string, Uint8Array, string, RegExp]> = [
      ['pic.png', 'image/svg+xml', PNG, 'image/png', /^inline/],
      [
        'page.png',
        'image/png',
        text('<script>alert(1)</script>'),
        'application/octet-stream',
        /^attachment/,
      ],
      [
        'bundle.zip',
        'application/zip',
        bytes(0x50, 0x4b, 0x03, 0x04),
        'application/zip',
        /^attachment/,
      ],
      ['data.csv', 'text/csv', text('a,b'), 'text/csv', /^attachment/],
    ]
    for (const [name, declared, data, served, disposition] of cases) {
      const file = await uploads.store({ name, type: declared, data })
      const res = await get(server, `/api/uploads/${file.key}`)
      expect(res.headers.get('content-type')).toBe(served)
      expect(res.headers.get('content-disposition')).toMatch(disposition)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    }
  })

  it('allowTypes widens the allow-list for text formats', async () => {
    const { uploads, server } = setup({ allowTypes: ['text/markdown'] })
    const md = await uploads.store({ name: 'a.md', type: 'text/markdown', data: text('# hi') })
    expect((await get(server, `/api/uploads/${md.key}`)).headers.get('content-type')).toBe(
      'text/markdown',
    )
    const csv = await uploads.store({ name: 'a.csv', type: 'text/csv', data: text('a,b') })
    expect((await get(server, `/api/uploads/${csv.key}`)).headers.get('content-type')).toBe(
      'application/octet-stream',
    )
  })

  it('servedFileHeaders without bytes keeps taking the type as given', () => {
    expect(servedFileHeaders('image/png', 'a')['content-disposition']).toMatch(/^inline/)
    expect(servedFileHeaders('text/html', 'a')['content-disposition']).toMatch(/^attachment/)
  })
})

describe('signed links', () => {
  it('signs a path and verifies it until it expires', async () => {
    const now = Date.UTC(2030, 0, 1)
    const link = await signedUrl('/api/uploads/abc/report.pdf', {
      expiresIn: 60,
      secret: SECRET,
      now,
    })
    const url = new URL(`http://x${link}`)
    expect(url.pathname).toBe('/api/uploads/abc/report.pdf')
    expect(url.searchParams.get('expires')).toBe(String((now + 60_000) / 1000))
    expect(await verifySignedUrl(url, SECRET, now + 59_000)).toBe('ok')
    expect(await verifySignedUrl(url, SECRET, now + 61_000)).toBe('expired')
    expect(await verifySignedUrl(url, 'another-secret-of-16-chars', now)).toBe('invalid')
    expect(await verifySignedUrl(new URL('http://x/api/uploads/abc/report.pdf'), SECRET)).toBe(
      'unsigned',
    )
  })

  it('does not work for another file or a longer expiry', async () => {
    const link = await signedUrl('/api/uploads/abc/a.pdf', { expiresIn: 60, secret: SECRET })
    const other = new URL(`http://x${link}`)
    other.pathname = '/api/uploads/abc/b.pdf'
    expect(await verifySignedUrl(other, SECRET)).toBe('invalid')
    const longer = new URL(`http://x${link}`)
    longer.searchParams.set('expires', String(Number(longer.searchParams.get('expires')) + 3600))
    expect(await verifySignedUrl(longer, SECRET)).toBe('invalid')
  })

  it('refuses secrets that are too short', async () => {
    await expect(signedUrl('/a', { expiresIn: 1, secret: 'short' })).rejects.toThrow(
      /16 characters/,
    )
  })

  it('serves a file through its signed link and refuses a tampered, expired or unsigned one when signing is required', async () => {
    const { uploads, server } = setup({ secret: SECRET, requireSigned: true })
    const file = await uploads.store({ name: 'a.png', type: 'image/png', data: PNG })
    const link = await uploads.signedUrl(file.key, { expiresIn: 60 })
    const ok = await get(server, link)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/png')
    // A link is for one person: no shared caches.
    expect(ok.headers.get('cache-control')).toMatch(/^private/)

    expect((await get(server, `/api/uploads/${file.key}`)).status).toBe(403)
    expect((await get(server, `${link.replace(/signature=./, 'signature=_')}`)).status).toBe(403)
    const expired = await signedUrl(`/api/uploads/${file.key}`, {
      expiresIn: -10,
      secret: SECRET,
    })
    const res = await get(server, expired)
    expect(res.status).toBe(403)
    expect(((await res.json()) as { message: string }).message).toMatch(/expired/)
  })

  it('needs a secret to sign, and requireSigned needs one to be set', async () => {
    const { uploads } = setup()
    await expect(uploads.signedUrl('a/b.png', { expiresIn: 5 })).rejects.toThrow(/secret/)
    expect(() => createUploads({ requireSigned: true })).toThrow(/secret/)
  })

  it('signs a custom mount path', async () => {
    const uploads = createUploads({ driver: createMemoryUploadsDriver(), secret: SECRET })
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    uploads.mount(server, '/files')
    const file = await uploads.store({ name: 'a.png', type: 'image/png', data: PNG })
    const link = await uploads.signedUrl(file.key, { expiresIn: 60, path: '/files' })
    expect(link.startsWith(`/files/${file.key}?expires=`)).toBe(true)
    expect((await get(server, link)).status).toBe(200)
  })
})

describe('authorize', () => {
  it('asks for every unsigned request and can refuse it', async () => {
    const asked: Array<{ key: string; type: string; size: number }> = []
    const { uploads, server } = setup({
      authorize: ({ request }, file) => {
        asked.push({ key: file.key, type: file.type, size: file.size })
        return request.headers.get('x-user') === 'ada'
      },
    })
    const file = await uploads.store({ name: 'a.png', type: 'image/png', data: PNG })
    expect((await get(server, `/api/uploads/${file.key}`)).status).toBe(403)
    const ok = await server.fetch(
      new Request(`http://x/api/uploads/${file.key}`, { headers: { 'x-user': 'ada' } }),
    )
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toMatch(/^private/)
    expect(asked).toEqual([
      { key: file.key, type: 'image/png', size: PNG.byteLength },
      { key: file.key, type: 'image/png', size: PNG.byteLength },
    ])
  })

  it('is skipped by a valid signed link, and does not reveal missing files to the hook', async () => {
    let calls = 0
    const { uploads, server } = setup({
      secret: SECRET,
      authorize: () => {
        calls++
        return false
      },
    })
    const file = await uploads.store({ name: 'a.png', type: 'image/png', data: PNG })
    const link = await uploads.signedUrl(file.key, { expiresIn: 60 })
    expect((await get(server, link)).status).toBe(200)
    expect(calls).toBe(0)
    expect((await get(server, '/api/uploads/none/x.png')).status).toBe(404)
    expect(calls).toBe(0)
  })

  it('gets the request app, so it can read the session', async () => {
    let seen: unknown
    const { uploads, server } = setup({
      authorize: ({ app }) => {
        seen = app
        return true
      },
    })
    const file = await uploads.store({ name: 'a.png', type: 'image/png', data: PNG })
    await get(server, `/api/uploads/${file.key}`)
    expect(seen).toBeDefined()
  })
})
