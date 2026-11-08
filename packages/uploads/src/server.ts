import { type KitrApp, KitrError } from '@kitr/core'
import type { H3Event } from 'h3'
import { accepts, type UploadedFile, type UploadRules, type UploadsConfig } from './index'
import { signedUrl, verifySignedUrl } from './signing'
import { matchesType, sniffType } from './sniff'

export { type SignatureCheck, type SignedUrlOptions, signedUrl, verifySignedUrl } from './signing'
export { sniffType } from './sniff'

/** A stored file's key, original name, size and type. */
export interface StoredFile {
  key: string
  name: string
  size: number
  type: string
}

/** Where bytes go: disk, S3, R2, GCS. Keys are relative paths the driver owns. */
export interface UploadsDriver {
  /** A short label, such as `disk` or `memory`. */
  name: string
  /** Write the bytes under `key`, keeping `type` so `get` can return it. */
  put(key: string, data: Uint8Array, meta: { type: string; name: string }): Promise<void>
  /** Read a file back, or `undefined` when the key does not exist. */
  get(key: string): Promise<{ data: Uint8Array; type: string } | undefined>
  /** Delete a file. Deleting a missing key is not an error. */
  delete(key: string): Promise<void>
  /** A URL for the key, when files are served (CDN, signed URL, the kitr route). */
  url?(key: string): string | Promise<string>
}

/** A driver that keeps files in a Map, for tests and demos. Everything is lost when the process exits. */
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

/**
 * The part of an [unstorage](https://unstorage.unjs.io) `Storage` the uploads driver uses. Any
 * unstorage instance fits, whatever its driver: S3 and R2 (`unstorage/drivers/s3`), Azure Blob,
 * Vercel Blob, Netlify Blobs, the filesystem.
 */
export interface UnstorageRawLike {
  getItemRaw(key: string): Promise<unknown>
  setItemRaw(key: string, value: Uint8Array): Promise<void>
  getItem(key: string): Promise<unknown>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** Bytes as unstorage drivers hand them back: a Buffer, a Uint8Array, an ArrayBuffer or base64. */
function toBytes(raw: unknown): Uint8Array | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw instanceof Uint8Array) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (typeof raw === 'string') {
    // Drivers without binary support store raw values as `base64:<data>`.
    const data = raw.startsWith('base64:') ? raw.slice(7) : raw
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  }
  return undefined
}

/**
 * An uploads driver over any unstorage instance, so every server instance reads and writes the
 * same files: object storage such as S3 or R2 instead of one machine's disk.
 *
 *   driver: createUnstorageUploadsDriver(createStorage({ driver: s3Driver({ bucket: 'acme-uploads', ... }) }))
 *
 * Files live under `base` (default `uploads`) with their type and name kept beside them under
 * `<base>:meta`. `publicPath` gives the driver a `url(key)`, as with the disk driver.
 */
export function createUnstorageUploadsDriver(
  storage: UnstorageRawLike,
  options: { base?: string; publicPath?: string } = {},
): UploadsDriver {
  const base = options.base ?? 'uploads'
  const file = (key: string) => `${base}:files:${key}`
  const meta = (key: string) => `${base}:meta:${key}`
  const check = (key: string) => {
    if (!key || key.split(/[/:]/).some((part) => part === '..' || part === ''))
      throw KitrError.forbidden('Bad upload key')
    return key
  }
  return {
    name: 'unstorage',
    async put(key, data, info) {
      check(key)
      await storage.setItemRaw(file(key), data)
      await storage.setItem(meta(key), JSON.stringify({ type: info.type, name: info.name }))
    },
    async get(key) {
      check(key)
      const data = toBytes(await storage.getItemRaw(file(key)))
      if (!data) return undefined
      const raw = await storage.getItem(meta(key))
      const info = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { type?: string } | null
      return { data, type: info?.type ?? 'application/octet-stream' }
    },
    async delete(key) {
      check(key)
      await Promise.allSettled([storage.removeItem(file(key)), storage.removeItem(meta(key))])
    },
    url: options.publicPath
      ? (key) => `${options.publicPath!.replace(/\/$/, '')}/${key}`
      : undefined,
  }
}

/** The uploads service, as `createUploads` returns it and `useUploads(app)` reads it from the container. */
export interface Uploads {
  /** Read a multipart request, apply the rules and store the files. Throws KitrError on violation. */
  receive(event: H3Event, rules?: UploadRules & { field?: string }): Promise<UploadedFile[]>
  /** Store bytes directly (from a job, a migration). */
  store(file: { name: string; type: string; data: Uint8Array }): Promise<UploadedFile>
  /** Read a stored file's bytes and type, or `undefined`. */
  read(key: string): Promise<{ data: Uint8Array; type: string } | undefined>
  /** Delete a stored file through the driver. */
  remove(key: string): Promise<void>
  /**
   * A link to a stored file that works for `expiresIn` seconds and no longer: the file's URL
   * under the mount path (default `/api/uploads`) with an HMAC signature. Needs `secret` in
   * `config/uploads.ts`. The link skips `authorize`, so hand it only to the person it is for.
   */
  signedUrl(key: string, options: { expiresIn: number; path?: string }): Promise<string>
  /** Answer a `GET` for a stored file under `base`: checks the signed link or `authorize`, then sends the file with safe headers. What the mounted route runs. */
  serve(event: H3Event, options?: { base?: string; app?: KitrApp }): Promise<Response>
  /** Mount `POST <path>` (receive) and `GET <path>/:key` (serve) on a kitr server. */
  mount<S extends { h3: any; app?: KitrApp }>(server: S, path?: string): S
  /** The config this service was made from. */
  readonly config: UploadsConfig
  /** The driver files are stored with. */
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
const INLINE_TYPES =
  /^(image\/(png|jpeg|gif|webp|avif|bmp|x-icon)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/plain)(\s*;.*)?$/i

/** Declared types served as themselves when the bytes cannot be sniffed. */
const DEFAULT_ALLOWED_TYPES = ['text/plain', 'text/csv', 'application/json'] as const

/** Options of `servedFileHeaders`. */
export interface ServedFileOptions {
  /**
   * The file's bytes. With them the type is sniffed from the signature (PNG, JPEG, PDF, ZIP...)
   * and the declared type is only a fallback for allow-listed text formats; without them the
   * declared type is taken as given.
   */
  data?: Uint8Array
  /** Declared types that may be served as themselves when the bytes have no signature. Default `text/plain`, `text/csv`, `application/json`. */
  allow?: string[]
  /** Override `cache-control`. Default: public and immutable. */
  cacheControl?: string
}

/**
 * The type a stored file is served as, and whether a browser may show it inline: the type its bytes
 * show (so a declared `image/png` over HTML is not an image); failing that, the declared type if
 * allow-listed; otherwise `application/octet-stream`.
 */
export function resolveServedType(
  declared: string,
  data: Uint8Array,
  allow: readonly string[] = DEFAULT_ALLOWED_TYPES,
): { type: string; inline: boolean } {
  const sniffed = sniffType(data)
  if (sniffed) return { type: sniffed, inline: INLINE_TYPES.test(sniffed) }
  if (matchesType(declared, allow))
    return { type: declared, inline: /^text\/plain(\s*;.*)?$/i.test(declared) }
  return { type: 'application/octet-stream', inline: false }
}

/**
 * Headers for serving a stored file: never sniffed by the browser (`nosniff`), sandboxed, and
 * inline only when that is safe; everything else is a download (`Content-Disposition: attachment`).
 * Pass the bytes in `options.data` so the type comes from them, not from the uploader.
 */
export function servedFileHeaders(
  type: string,
  name?: string,
  options: ServedFileOptions = {},
): Record<string, string> {
  const served = options.data
    ? resolveServedType(type, options.data, options.allow)
    : { type, inline: INLINE_TYPES.test(type) }
  const filename = name ? `; filename="${name.replace(/["\\\r\n]/g, '_')}"` : ''
  return {
    'content-type': served.inline || options.data ? served.type : 'application/octet-stream',
    'content-disposition': `${served.inline ? 'inline' : 'attachment'}${filename}`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    'cache-control': options.cacheControl ?? 'public, max-age=31536000, immutable',
  }
}

const safeName = (name: string) =>
  name
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 120) || 'file'

/**
 * Creates the uploads service from a config: the driver (disk under `storage/uploads` by default)
 * and the default rules. The provider calls it with `config/uploads.ts`; call it yourself in tests.
 */
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
  if (config.requireSigned && !config.secret)
    throw new Error('[@kitr/uploads] requireSigned needs `secret` in config/uploads.ts.')
  const uploads: Uploads = {
    driver,
    config,
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
    async signedUrl(key, options) {
      if (!config.secret)
        throw new Error('[@kitr/uploads] signedUrl() needs `secret` in config/uploads.ts.')
      const base = (options.path ?? '/api/uploads').replace(/\/$/, '')
      return signedUrl(`${base}/${key.split('/').map(encodeURIComponent).join('/')}`, {
        expiresIn: options.expiresIn,
        secret: config.secret,
      })
    },
    async serve(event, options = {}) {
      const base = (options.base ?? '/api/uploads').replace(/\/$/, '')
      const url = new URL(event.req.url)
      let key: string
      try {
        key = decodeURIComponent(url.pathname.slice(base.length + 1))
      } catch {
        throw KitrError.notFound('File')
      }
      // A link that carries a signature must verify: a bad or expired one is refused, not
      // quietly treated as an unsigned request.
      const check = await verifySignedUrl(url, config.secret ?? '')
      if (check === 'expired') throw KitrError.forbidden('This link has expired')
      if (check === 'invalid') throw KitrError.forbidden('This link is not valid')
      if (check === 'unsigned' && config.requireSigned)
        throw KitrError.forbidden('A signed link is required')
      const file = await driver.get(key)
      if (!file) throw KitrError.notFound('File')
      const allow = config.allowTypes
      const served = resolveServedType(file.type, file.data, allow)
      const name = key.split('/').pop() ?? key
      if (check === 'unsigned' && config.authorize) {
        const app = options.app ?? (event.context as { kitr?: { app?: KitrApp } }).kitr?.app
        if (!app)
          throw new Error('[@kitr/uploads] authorize needs the app: mount uploads on a kitr server.')
        const allowed = await config.authorize(
          { event, request: event.req as unknown as Request, app },
          { key, name, type: served.type, size: file.data.byteLength },
        )
        if (!allowed) throw KitrError.forbidden('You cannot open this file')
      }
      // Files behind a link or a check are not for shared caches.
      const restricted = check === 'ok' || !!config.authorize
      return new Response(file.data as BodyInit, {
        headers: servedFileHeaders(file.type, name, {
          data: file.data,
          allow,
          cacheControl: restricted ? 'private, max-age=300' : undefined,
        }),
      })
    },
    mount(server, path = '/api/uploads') {
      const base = path.replace(/\/$/, '')
      raiseBodyLimit(server as never, base, config)
      server.h3.post(base, async (event: H3Event) => ({ files: await uploads.receive(event) }))
      server.h3.get(`${base}/**`, (event: H3Event) =>
        uploads.serve(event, { base, app: server.app }),
      )
      return server
    },
  }
  return uploads
}

/**
 * The server's body limit (1 MiB by default) applies before the upload rules: without a larger
 * limit on the upload path, every file over 1 MiB fails with 413 whatever `maxSize` says.
 * Multipart framing adds a little per file, so the limit leaves room for it.
 */
function raiseBodyLimit(
  server: { app?: KitrApp; config?: { bodyLimits?: Record<string, number> } },
  base: string,
  rules?: UploadsConfig,
) {
  if (!server.config) return
  const config =
    rules ?? (server.app?.config.has('uploads') ? server.app.config.get('uploads') : {})
  const maxSize = config.maxSize ?? 10 * 1024 * 1024
  const maxFiles = config.maxFiles ?? 1
  server.config.bodyLimits = {
    ...server.config.bodyLimits,
    [base]: maxSize * maxFiles + 64 * 1024 * maxFiles,
  }
}

/** Returns the `uploads` service the provider bound, for a controller or job: `useUploads(ctx.app)`. */
export function useUploads(app: KitrApp): Uploads {
  return app.container.use('uploads')
}

/**
 * Mount `POST <path>` (receive) and `GET <path>/**` (serve) on a kitr server from `server/main.ts`.
 * The service is resolved per request, so this can run before the app has booted.
 */
export function mountUploads<
  S extends { h3: any; app: KitrApp; config?: { bodyLimits?: Record<string, number> } },
>(server: S, path = '/api/uploads'): S {
  const base = path.replace(/\/$/, '')
  raiseBodyLimit(server, base)
  server.h3.post(base, async (event: H3Event) => ({
    files: await useUploads(server.app).receive(event),
  }))
  // The service is resolved per request. The file's bytes decide its type, not what the uploader
  // declared (an SVG or HTML upload would run script as the site).
  server.h3.get(`${base}/**`, (event: H3Event) =>
    useUploads(server.app).serve(event, { base, app: server.app }),
  )
  return server
}
