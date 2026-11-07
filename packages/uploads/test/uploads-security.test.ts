import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterAll, describe, expect, it } from 'vitest'
import { accepts, checkFile, formatBytes, UploadError, upload } from '../src'
import {
  createDiskUploadsDriver,
  createMemoryUploadsDriver,
  createUploads,
  servedFileHeaders,
} from '../src/server'

const base = mkdtempSync(join(tmpdir(), 'kitr-uploads-sec-'))
afterAll(() => rmSync(base, { recursive: true, force: true }))

const bytes = (s: string) => new TextEncoder().encode(s)

function post(
  server: { fetch(r: Request): Promise<Response> },
  form: FormData,
  path = '/api/uploads',
) {
  return server.fetch(new Request(`http://x${path}`, { method: 'POST', body: form }))
}

function form(files: Array<{ name: string; type?: string; body?: string }>, field = 'file') {
  const f = new FormData()
  for (const file of files)
    f.append(field, new File([file.body ?? 'x'], file.name, { type: file.type ?? 'text/plain' }))
  return f
}

function setup(config: Parameters<typeof createUploads>[0] = {}) {
  const uploads = createUploads({ driver: createMemoryUploadsDriver(), ...config })
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  uploads.mount(server)
  return { uploads, server }
}

describe('disk driver keeps keys inside its directory', () => {
  const dir = join(base, 'uploads')
  const sibling = join(base, 'uploads-evil')
  mkdirSync(dir, { recursive: true })
  mkdirSync(sibling, { recursive: true })
  writeFileSync(join(base, 'secret.txt'), 'top secret')
  writeFileSync(join(sibling, 'x'), 'sibling secret')
  const driver = createDiskUploadsDriver({ dir })

  it.each([
    '../secret.txt',
    '../../etc/passwd',
    '/etc/passwd',
    '../uploads-evil/x',
    'a/../../secret.txt',
    '',
    '.',
  ])('refuses %j for get, put and delete', async (key) => {
    await expect(driver.get(key)).rejects.toMatchObject({ status: 403 })
    await expect(
      driver.put(key, bytes('pwned'), { type: 'text/plain', name: 'x' }),
    ).rejects.toMatchObject({
      status: 403,
    })
    await expect(driver.delete(key)).rejects.toMatchObject({ status: 403 })
  })

  it('never writes outside the directory', () => {
    expect(readdirSync(sibling)).toEqual(['x'])
    expect(existsSync(join(base, 'pwned'))).toBe(false)
  })

  it('does not expose its own metadata sidecars', async () => {
    await driver.put('id1/a.txt', bytes('hello'), { type: 'text/plain', name: 'a.txt' })
    expect(existsSync(join(dir, 'id1/a.txt.meta.json'))).toBe(true)
    await expect(driver.get('id1/a.txt.meta.json')).rejects.toMatchObject({ status: 403 })
    const got = await driver.get('id1/a.txt')
    expect(new TextDecoder().decode(got!.data)).toBe('hello')
    expect(got!.type).toBe('text/plain')
  })

  it('reads a file without metadata as octet-stream and misses as undefined', async () => {
    mkdirSync(join(dir, 'id2'), { recursive: true })
    writeFileSync(join(dir, 'id2/raw.bin'), 'raw')
    expect((await driver.get('id2/raw.bin'))!.type).toBe('application/octet-stream')
    expect(await driver.get('id2/missing')).toBeUndefined()
  })

  it('delete removes the file and its metadata, and tolerates missing files', async () => {
    await driver.put('id3/b.txt', bytes('b'), { type: 'text/plain', name: 'b.txt' })
    await driver.delete('id3/b.txt')
    expect(existsSync(join(dir, 'id3/b.txt'))).toBe(false)
    expect(existsSync(join(dir, 'id3/b.txt.meta.json'))).toBe(false)
    await expect(driver.delete('id3/b.txt')).resolves.toBeUndefined()
  })

  it('builds public URLs from publicPath', () => {
    const withUrl = createDiskUploadsDriver({ dir, publicPath: '/files/' })
    expect(withUrl.url?.('k/a.txt')).toBe('/files/k/a.txt')
    expect(createDiskUploadsDriver({ dir }).url).toBeUndefined()
  })
})

describe('serving uploaded files', () => {
  it('serves risky types as sandboxed downloads, never as pages', async () => {
    const { uploads, server } = setup()
    for (const type of ['text/html', 'image/svg+xml', 'application/xml', 'text/javascript', '']) {
      const file = await uploads.store({
        name: 'evil.html',
        type,
        data: bytes('<script>alert(1)</script>'),
      })
      const res = await server.fetch(new Request(`http://x/api/uploads/${file.key}`))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/octet-stream')
      expect(res.headers.get('content-disposition')).toMatch(/^attachment/)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toContain('sandbox')
    }
  })

  it('serves images, media, PDFs and plain text inline', () => {
    for (const type of [
      'image/png',
      'image/jpeg',
      'video/mp4',
      'audio/mpeg',
      'application/pdf',
      'text/plain',
      'text/plain; charset=utf-8',
    ]) {
      const h = servedFileHeaders(type, 'a')
      expect(h['content-type']).toBe(type)
      expect(h['content-disposition']).toMatch(/^inline/)
    }
  })

  it('escapes the filename in content-disposition', () => {
    const h = servedFileHeaders('text/html', 'a"b\r\nSet-Cookie: x=1')
    expect(h['content-disposition']).not.toMatch(/[\r\n]/)
    expect(h['content-disposition']).toBe('attachment; filename="a_b__Set-Cookie: x=1"')
  })

  it('answers 404 for unknown keys and 403 for traversal on disk', async () => {
    const dir = join(base, 'served')
    const uploads = createUploads({ driver: createDiskUploadsDriver({ dir }) })
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    uploads.mount(server)
    writeFileSync(join(base, 'outside.txt'), 'nope')
    expect((await server.fetch(new Request('http://x/api/uploads/none/x.txt'))).status).toBe(404)
    const traversal = await server.fetch(new Request('http://x/api/uploads/..%2Foutside.txt'))
    expect(traversal.status).toBe(403)
    expect(await traversal.text()).not.toContain('nope')
    const stored = await uploads.store({ name: 'a.txt', type: 'text/plain', data: bytes('a') })
    const meta = await server.fetch(new Request(`http://x/api/uploads/${stored.key}.meta.json`))
    expect(meta.status).toBe(403)
  })
})

describe('receiving uploads', () => {
  it('turns hostile file names into safe keys', async () => {
    const { uploads } = setup()
    const cases = ['../../etc/passwd', '..\\..\\win.ini', '<script>.html', 'a'.repeat(300), '']
    for (const name of cases) {
      const f = await uploads.store({ name, type: 'text/plain', data: bytes('x') })
      const [id, stored, ...rest] = f.key.split('/')
      expect(rest).toEqual([])
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
      expect(stored).toMatch(/^[\w.-]+$/)
      expect(stored!.length).toBeLessThanOrEqual(120)
      expect(f.name).toBe(name)
    }
  })

  it('gives every stored file its own key, even with the same name', async () => {
    const { uploads } = setup()
    const a = await uploads.store({ name: 'same.txt', type: 'text/plain', data: bytes('1') })
    const b = await uploads.store({ name: 'same.txt', type: 'text/plain', data: bytes('2') })
    expect(a.key).not.toBe(b.key)
    expect(new TextDecoder().decode((await uploads.read(a.key))!.data)).toBe('1')
  })

  it('enforces maxFiles, and one file by default', async () => {
    const one = setup()
    const two = form([{ name: 'a.txt' }, { name: 'b.txt' }])
    const res = await post(one.server, two)
    expect(res.status).toBe(422)
    expect(JSON.stringify(await res.json())).toContain('At most 1 file')
    const many = setup({ maxFiles: 2 })
    const ok = await post(many.server, form([{ name: 'a.txt' }, { name: 'b.txt' }]))
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as any).files).toHaveLength(2)
  })

  it('stores nothing when any file in the batch breaks the size rule first', async () => {
    const { server, uploads } = setup({ maxFiles: 2, maxSize: 3 })
    const keys: string[] = []
    const original = uploads.driver.put
    uploads.driver.put = async (key, data, meta) => {
      keys.push(key)
      return original(key, data, meta)
    }
    const res = await post(
      server,
      form([
        { name: 'big.txt', body: 'toolong' },
        { name: 'ok.txt', body: 'ok' },
      ]),
    )
    expect(res.status).toBe(422)
    expect(keys).toEqual([])
  })

  it('rejects requests with no file, text fields only or the wrong field', async () => {
    const { server } = setup()
    const empty = new FormData()
    empty.append('file', 'just text')
    expect((await post(server, empty)).status).toBe(422)
    expect((await post(server, form([{ name: 'a.txt' }], 'other'))).status).toBe(422)
    expect((await post(server, new FormData())).status).toBe(422)
  })

  it('checks type by MIME pattern and by extension', async () => {
    const { server } = setup({ accept: ['image/*', '.pdf'] })
    expect((await post(server, form([{ name: 'a.png', type: 'image/png' }]))).status).toBe(200)
    expect(
      (await post(server, form([{ name: 'doc.PDF', type: 'application/octet-stream' }]))).status,
    ).toBe(200)
    expect((await post(server, form([{ name: 'a.html', type: 'text/html' }]))).status).toBe(422)
  })

  it('lets per-call rules override config', async () => {
    const { uploads } = setup({ maxSize: 1 })
    const server = createServer({ logger: silentLogger, server: { healthPath: false } })
    server.h3.post('/custom', async (event: any) => ({
      files: await uploads.receive(event, { maxSize: 100, field: 'doc' }),
    }))
    const res = await post(server, form([{ name: 'a.txt', body: 'hello' }], 'doc'), '/custom')
    expect(res.status).toBe(200)
  })

  it('stops oversize bodies at the server limit before they are buffered', async () => {
    const uploads = createUploads({ driver: createMemoryUploadsDriver() })
    const server = createServer({
      logger: silentLogger,
      server: { healthPath: false, bodyLimit: 1024 },
    })
    uploads.mount(server)
    const big = 'x'.repeat(4096)
    const res = await server.fetch(
      new Request('http://x/api/uploads', {
        method: 'POST',
        body: form([{ name: 'a.txt', body: big }]),
      }),
    )
    expect(res.status).toBe(413)
  })
})

describe('client helpers', () => {
  it('accepts: patterns are exact, prefix or extension, case-insensitive on extension', () => {
    expect(accepts('image/png', 'a', ['image/png'])).toBe(true)
    expect(accepts('image/pngx', 'a', ['image/png'])).toBe(false)
    expect(accepts('imagefoo/png', 'a', ['image/*'])).toBe(false)
    expect(accepts('x', 'A.PDF', ['.pdf'])).toBe(true)
    expect(accepts('x', 'a.pdf.exe', ['.pdf'])).toBe(false)
    expect(accepts('x', 'a', [])).toBe(true)
  })

  it('checkFile defaults to 10 MiB and passes good files', () => {
    expect(checkFile(new File(['x'], 'a.txt'))).toBeNull()
    const big = { name: 'big', size: 10 * 1024 * 1024 + 1, type: '' } as File
    expect(checkFile(big)).toBe('big is larger than 10.0 MB')
  })

  it('formatBytes covers every unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB')
  })

  it('upload() sends fields and headers, and reports server errors as UploadError', async () => {
    const seen: Request[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const req = new Request(`http://x${url}`, init)
      seen.push(req.clone())
      if (url === '/fail') return new Response(JSON.stringify({ message: 'Nope' }), { status: 400 })
      if (url === '/text') return new Response('gateway down', { status: 502 })
      return Response.json({ files: [{ id: '1', key: '1/a', name: 'a', size: 1, type: 't' }] })
    }) as any
    try {
      const files = await upload([new File(['a'], 'a'), new File(['b'], 'b')], {
        url: '/ok',
        fields: { album: '7' },
        headers: { 'x-csrf-token': 't' },
      })
      expect(files).toHaveLength(1)
      const body = await seen[0]!.formData()
      expect(body.get('album')).toBe('7')
      expect(body.getAll('file')).toHaveLength(2)
      expect(seen[0]!.headers.get('x-csrf-token')).toBe('t')
      const err = await upload(new File(['a'], 'a'), { url: '/fail' }).catch((e) => e)
      expect(err).toBeInstanceOf(UploadError)
      expect(err).toMatchObject({ message: 'Nope', status: 400 })
      await expect(upload(new File(['a'], 'a'), { url: '/text' })).rejects.toMatchObject({
        message: 'Upload failed (502)',
        status: 502,
        body: 'gateway down',
      })
    } finally {
      globalThis.fetch = original
    }
  })
})
