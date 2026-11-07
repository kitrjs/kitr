import { type KitrApp, KitrError } from '@kitr/core'
import type { H3Event } from 'h3'
import { accepts, type UploadedFile, type UploadRules, type UploadsConfig } from './index'

export interface StoredFile {
  key: string
  name: string
  size: number
  type: string
}

/** Where bytes go: disk, S3, R2, GCS. Keys are relative paths the driver owns. */
export interface UploadsDriver {
  name: string
  put(key: string, data: Uint8Array, meta: { type: string; name: string }): Promise<void>
  get(key: string): Promise<{ data: Uint8Array; type: string } | undefined>
  delete(key: string): Promise<void>
  /** A URL for the key, when files are served (CDN, signed URL, the kitr route). */
  url?(key: string): string | Promise<string>
}

export function createMemoryUploadsDriver(): UploadsDriver {
  const files = new Map<string, { data: Uint8Array; type: string }>()
  return {
    name: 'memory',
    async put(key, data, meta) {
      files.set(key, { data, type: meta.type })
    },
    async get(key) {
      return files.get(key)
    },
    async delete(key) {
      files.delete(key)
    },
  }
}

/** Files under a directory (default `storage/uploads`), loaded lazily so the browser bundle never sees node:fs. */
export function createDiskUploadsDriver(
  options: { dir?: string; publicPath?: string } = {},
): UploadsDriver {
  const dir = options.dir ?? 'storage/uploads'
  const fs = () => import('node:fs/promises')
  const path = () => import('node:path')
  const safe = async (key: string) => {
    const p = await path()
    const root = p.resolve(dir)
    const full = p.resolve(root, key)
    // A plain startsWith would let `../uploads-evil/x` out of `uploads`; the separator keeps it in.
    // Sidecar `.meta.json` files are the driver's own and never addressable as uploads.
    if (!key || !full.startsWith(root + p.sep) || full.endsWith('.meta.json'))
      throw KitrError.forbidden('Bad upload key')
    return full
  }
  return {
    name: 'disk',
    async put(key, data, meta) {
      const full = await safe(key)
      const p = await path()
      const f = await fs()
      await f.mkdir(p.dirname(full), { recursive: true })
      await f.writeFile(full, data)
      await f.writeFile(`${full}.meta.json`, JSON.stringify({ type: meta.type, name: meta.name }))
    },
    async get(key) {
      const full = await safe(key)
      const f = await fs()
      try {
        const [data, meta] = await Promise.all([
          f.readFile(full),
          f.readFile(`${full}.meta.json`, 'utf8').then(
            (s) => JSON.parse(s),
            () => ({}),
          ),
        ])
        return { data: new Uint8Array(data), type: meta.type ?? 'application/octet-stream' }
      } catch {
        return undefined
      }
    },
    async delete(key) {
      const full = await safe(key)
      const f = await fs()
      await Promise.allSettled([f.unlink(full), f.unlink(`${full}.meta.json`)])
    },
    url: options.publicPath
      ? (key) => `${options.publicPath!.replace(/\/$/, '')}/${key}`
      : undefined,
  }
}

export interface Uploads {
  /** Read a multipart request, apply the rules and store the files. Throws KitrError on violation. */
  receive(event: H3Event, rules?: UploadRules & { field?: string }): Promise<UploadedFile[]>
  /** Store bytes directly (from a job, a migration). */
  store(file: { name: string; type: string; data: Uint8Array }): Promise<UploadedFile>
  read(key: string): Promise<{ data: Uint8Array; type: string } | undefined>
  remove(key: string): Promise<void>
  /** Mount `POST <path>` (receive) and `GET <path>/:key` (serve) on a kitr server. */
  mount<S extends { h3: any; app?: KitrApp }>(server: S, path?: string): S
  readonly driver: UploadsDriver
}

declare module '@kitr/core' {
  interface ContainerBindings {
    uploads: Uploads
  }
}

/**
 * Types a browser can show inline without running script from our origin. Anything else (HTML,
 * SVG, XML, JavaScript) is served as a download, so an uploaded page can't act as the site.
 */
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|avif|bmp|x-icon)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/plain)(\s*;.*)?$/i

/** Headers for serving a stored file: never sniffed, sandboxed, and inline only when that is safe. */
export function servedFileHeaders(type: string, name?: string): Record<string, string> {
  const inline = INLINE_TYPES.test(type)
  const filename = name ? `; filename="${name.replace(/["\\\r\n]/g, '_')}"` : ''
  return {
    'content-type': inline ? type : 'application/octet-stream',
    'content-disposition': `${inline ? 'inline' : 'attachment'}${filename}`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    'cache-control': 'public, max-age=31536000, immutable',
  }
}

const safeName = (name: string) =>
  name
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 120) || 'file'

export function createUploads(config: UploadsConfig = {}): Uploads {
  const driver =
    (config.driver as UploadsDriver | undefined) ??
    createDiskUploadsDriver({ publicPath: config.publicPath })
  const describe = async (
    key: string,
    name: string,
    size: number,
    type: string,
  ): Promise<UploadedFile> => ({
    id: key.split('/')[0]!,
    key,
    name,
    size,
    type,
    url: driver.url
      ? await driver.url(key)
      : config.publicPath
        ? `${config.publicPath.replace(/\/$/, '')}/${key}`
        : undefined,
  })
  const uploads: Uploads = {
    driver,
    async store(file) {
      const key = `${crypto.randomUUID()}/${safeName(file.name)}`
      await driver.put(key, file.data, { type: file.type, name: file.name })
      return describe(key, file.name, file.data.byteLength, file.type)
    },
    async receive(event, rules = {}) {
      const maxSize = rules.maxSize ?? config.maxSize ?? 10 * 1024 * 1024
      const accept = rules.accept ?? config.accept
      const maxFiles = rules.maxFiles ?? config.maxFiles ?? 1
      const field = rules.field ?? 'file'
      const contentType = event.req.headers.get('content-type') ?? ''
      if (!contentType.startsWith('multipart/form-data'))
        throw KitrError.validation({ [field]: ['Expected multipart/form-data'] })
      // Through h3's bound Request, undici no longer sees the multipart header; a Response over the same body does.
      const form = await new Response(event.req.body, {
        headers: { 'content-type': contentType },
      }).formData()
      const entries = form.getAll(field).filter((v): v is File => typeof v !== 'string')
      if (!entries.length) throw KitrError.validation({ [field]: ['No file sent'] })
      if (entries.length > maxFiles)
        throw KitrError.validation({ [field]: [`At most ${maxFiles} file(s)`] })
      const out: UploadedFile[] = []
      for (const file of entries) {
        if (file.size > maxSize)
          throw KitrError.validation({ [field]: [`${file.name} is larger than ${maxSize} bytes`] })
        if (!accepts(file.type, file.name, accept))
          throw KitrError.validation({ [field]: [`${file.name} is not an accepted type`] })
        out.push(
          await uploads.store({
            name: file.name,
            type: file.type,
            data: new Uint8Array(await file.arrayBuffer()),
          }),
        )
      }
      return out
    },
    read: (key) => driver.get(key),
    remove: (key) => driver.delete(key),
    mount(server, path = '/api/uploads') {
      const base = path.replace(/\/$/, '')
      server.h3.post(base, async (event: H3Event) => ({ files: await uploads.receive(event) }))
      server.h3.get(`${base}/**`, async (event: H3Event) => {
        const key = decodeURIComponent(new URL(event.req.url).pathname.slice(base.length + 1))
        const file = await driver.get(key)
        if (!file) throw KitrError.notFound('File')
        return new Response(file.data as BodyInit, {
          headers: servedFileHeaders(file.type, key.split('/').pop()),
        })
      })
      return server
    },
  }
  return uploads
}

export function useUploads(app: KitrApp): Uploads {
  return app.container.use('uploads')
}

/**
 * Mount `POST <path>` (receive) and `GET <path>/**` (serve) on a kitr server from `server/main.ts`.
 * The service is resolved per request, so this can run before the app has booted.
 */
export function mountUploads<S extends { h3: any; app: KitrApp }>(
  server: S,
  path = '/api/uploads',
): S {
  const base = path.replace(/\/$/, '')
  server.h3.post(base, async (event: H3Event) => ({
    files: await useUploads(server.app).receive(event),
  }))
  server.h3.get(`${base}/**`, async (event: H3Event) => {
    const key = decodeURIComponent(new URL(event.req.url).pathname.slice(base.length + 1))
    const file = await useUploads(server.app).driver.get(key)
    if (!file) throw KitrError.notFound('File')
    return new Response(file.data as BodyInit, {
      headers: {
        'content-type': file.type,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  })
  return server
}
