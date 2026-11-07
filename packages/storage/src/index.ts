import {
  createDefineConfig,
  getDevtools,
  type KitrApp,
  type StandardSchemaV1,
  validateSync,
} from '@kitr/core'

export interface StorageConfig {
  /** Prefix for every storage key and cookie name, e.g. `myapp:`. Default none. */
  prefix?: string
  /** Defaults merged into every cookie. */
  cookie?: Omit<CookieOptions, 'name'>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    storage: StorageConfig
  }
}

export const defineConfig = createDefineConfig<StorageConfig>()

/* ----------------------------------------------------------------------------
 * Codecs
 * ------------------------------------------------------------------------- */

export interface Codec<T> {
  encode(value: T): string
  decode(raw: string): T
}

export const jsonCodec = <T>(): Codec<T> => ({
  encode: (v) => JSON.stringify(v),
  decode: (raw) => JSON.parse(raw) as T,
})

export const stringCodec: Codec<string> = { encode: (v) => v, decode: (raw) => raw }

/* ----------------------------------------------------------------------------
 * Web Storage items
 * ------------------------------------------------------------------------- */

export type StorageArea = 'local' | 'session'

export interface StorageItemOptions<T> {
  /** Returned when the key is missing, unparsable, invalid or on the server. */
  default: T
  area?: StorageArea
  /** Validate what comes back from storage (Standard Schema: zod, valibot...). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>
  codec?: Codec<T>
  /** Bump when the shape changes; stored values with another version are migrated or dropped. */
  version?: number
  migrate?: (raw: unknown, fromVersion: number) => T
  /** Keep this many ms, then treat as missing. Stored beside the value. */
  ttl?: number
}

export interface StorageItem<T> {
  readonly key: string
  readonly area: StorageArea
  get(): T
  set(value: T | ((current: T) => T)): void
  remove(): void
  /** Fires on set/remove here and in other tabs (`storage` event). */
  subscribe(listener: (value: T) => void): () => void
  /** The default, for server snapshots. */
  readonly default: T
}

interface Envelope {
  v: number
  d: unknown
  /** Expiry timestamp when a ttl is set. */
  e?: number
}

const listenersByKey = new Map<string, Set<() => void>>()
let crossTabInstalled = false

function area(name: StorageArea): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = name === 'local' ? window.localStorage : window.sessionStorage
    // Safari private mode throws on access.
    s.getItem('__kitr__')
    return s
  } catch {
    return null
  }
}

function installCrossTab() {
  if (crossTabInstalled || typeof window === 'undefined') return
  crossTabInstalled = true
  window.addEventListener('storage', (e) => {
    if (!e.key) return
    for (const l of listenersByKey.get(e.key) ?? []) l()
  })
}

function emit(key: string) {
  for (const l of listenersByKey.get(key) ?? []) l()
}

let keyPrefix = ''
/** Set by the provider from `config/storage.ts`; items created later pick it up. */
export function setStoragePrefix(prefix: string) {
  keyPrefix = prefix
}

/**
 * A typed item in localStorage or sessionStorage.
 *
 *   const sidebar = defineStorage('sidebar', { default: { open: true } })
 *   sidebar.get().open; sidebar.set((s) => ({ ...s, open: false }))
 *
 * Safe everywhere: on the server (or when storage is blocked) `get()` returns the default
 * and `set()` is a no-op, so the same module renders on both sides.
 */
export function defineStorage<T>(name: string, options: StorageItemOptions<T>): StorageItem<T> {
  const areaName = options.area ?? 'local'
  const codec = options.codec ?? jsonCodec<Envelope>()
  const version = options.version ?? 1
  const fullKey = () => `${keyPrefix}${name}`
  let cache: { raw: string | null; value: T } | undefined

  const parse = (raw: string | null): T => {
    if (raw === null) return options.default
    try {
      const env = (codec as Codec<Envelope>).decode(raw)
      if (!env || typeof env !== 'object' || !('d' in env)) return options.default
      if (env.e !== undefined && env.e < Date.now()) return options.default
      let data: unknown = env.d
      if (env.v !== version) {
        if (!options.migrate) return options.default
        data = options.migrate(data, env.v)
      }
      if (options.schema) {
        const result = validateSync(options.schema, data)
        return result.success ? result.data : options.default
      }
      return data as T
    } catch {
      return options.default
    }
  }

  const item: StorageItem<T> = {
    key: name,
    area: areaName,
    default: options.default,
    get() {
      const s = area(areaName)
      if (!s) return options.default
      const raw = s.getItem(fullKey())
      // Same raw string → same object identity, which useSyncExternalStore needs.
      if (cache && cache.raw === raw) return cache.value
      const value = parse(raw)
      cache = { raw, value }
      return value
    },
    set(next) {
      const s = area(areaName)
      if (!s) return
      const value = typeof next === 'function' ? (next as (c: T) => T)(item.get()) : next
      const env: Envelope = { v: version, d: value }
      if (options.ttl) env.e = Date.now() + options.ttl
      try {
        s.setItem(fullKey(), (codec as Codec<Envelope>).encode(env))
      } catch {
        // Quota exceeded: keep running with the in-memory value.
        cache = { raw: null, value }
      }
      emit(fullKey())
    },
    remove() {
      area(areaName)?.removeItem(fullKey())
      cache = undefined
      emit(fullKey())
    },
    subscribe(listener) {
      installCrossTab()
      const key = fullKey()
      const wrapped = () => listener(item.get())
      let set = listenersByKey.get(key)
      if (!set) {
        set = new Set()
        listenersByKey.set(key, set)
      }
      set.add(wrapped)
      return () => {
        set.delete(wrapped)
      }
    },
  }
  return item
}

/* ----------------------------------------------------------------------------
 * Cookies
 * ------------------------------------------------------------------------- */

export interface CookieOptions {
  path?: string
  domain?: string
  /** Seconds. */
  maxAge?: number
  expires?: Date
  secure?: boolean
  /** Server-set cookies only; the browser cannot write httpOnly cookies. */
  httpOnly?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

export interface CookieItemOptions<T> extends CookieOptions {
  default: T
  schema?: StandardSchemaV1<unknown, T>
  /** Default: JSON for objects, plain string for string defaults. */
  codec?: Codec<T>
}

/** Anything that can hold cookies: a `Cookie` header string, a Headers object or `document`. */
export type CookieSource = string | null | undefined | Headers | { cookie?: string | null }

export interface CookieItem<T> {
  readonly name: string
  readonly default: T
  readonly options: CookieOptions
  /** Read from `document.cookie`, or from the given source on the server. */
  get(source?: CookieSource): T
  /** Write `document.cookie` (client). On the server use `cookies(event).set(item, value)`. */
  set(value: T, options?: CookieOptions): void
  remove(): void
  subscribe(listener: (value: T) => void): () => void
  /** The `Set-Cookie` header value for this item. */
  serialize(value: T | null, options?: CookieOptions): string
  /** Parse one raw cookie value into T (or the default). */
  decode(raw: string | undefined): T
}

const cookieListeners = new Set<() => void>()
let cookieDefaults: Omit<CookieOptions, 'name'> = {}
export function setCookieDefaults(defaults: Omit<CookieOptions, 'name'>) {
  cookieDefaults = defaults
}

/** Parse a `Cookie` header into a map. Values are decoded with decodeURIComponent. */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    const v = part.slice(i + 1).trim()
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

/** Build a `Set-Cookie` value. `value === null` expires the cookie. */
export function serializeCookie(
  name: string,
  value: string | null,
  options: CookieOptions = {},
): string {
  const parts = [`${name}=${value === null ? '' : encodeURIComponent(value)}`]
  const o = { path: '/', sameSite: 'lax' as const, ...cookieDefaults, ...options }
  if (value === null) parts.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  else {
    if (o.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAge)}`)
    if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`)
  }
  if (o.domain) parts.push(`Domain=${o.domain}`)
  if (o.path) parts.push(`Path=${o.path}`)
  if (o.secure || o.sameSite === 'none') parts.push('Secure')
  if (o.httpOnly) parts.push('HttpOnly')
  if (o.sameSite) parts.push(`SameSite=${o.sameSite[0]!.toUpperCase()}${o.sameSite.slice(1)}`)
  return parts.join('; ')
}

function headerFrom(source: CookieSource): string | null | undefined {
  if (source === undefined) {
    return typeof document === 'undefined' ? undefined : document.cookie
  }
  if (source === null || typeof source === 'string') return source
  if (typeof Headers !== 'undefined' && source instanceof Headers) return source.get('cookie')
  return (source as { cookie?: string | null }).cookie
}

/**
 * A typed cookie, readable on both sides and writable from the browser or the server.
 *
 *   const locale = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
 *   locale.get()                      // client: document.cookie
 *   locale.get(request.headers)       // server: any Headers / Cookie header string
 *   locale.set('de')                  // client
 *   cookies(event).set(locale, 'de')  // server (kitr/storage/server)
 */
export function defineCookie<T = string>(
  name: string,
  options: CookieItemOptions<T>,
): CookieItem<T> {
  const { default: fallback, schema, codec: givenCodec, ...cookieOptions } = options
  const codec: Codec<T> =
    givenCodec ?? ((typeof fallback === 'string' ? stringCodec : jsonCodec<T>()) as Codec<T>)
  const fullName = () => `${keyPrefix}${name}`

  const decode = (raw: string | undefined): T => {
    if (raw === undefined) return fallback
    try {
      const data = codec.decode(raw)
      if (schema) {
        const result = validateSync(schema, data)
        return result.success ? result.data : fallback
      }
      return data
    } catch {
      return fallback
    }
  }

  const item: CookieItem<T> = {
    name,
    default: fallback,
    options: cookieOptions,
    decode,
    get(source) {
      const header = headerFrom(source)
      if (header === undefined) return fallback
      return decode(parseCookies(header)[fullName()])
    },
    serialize(value, overrides) {
      return serializeCookie(fullName(), value === null ? null : codec.encode(value), {
        ...cookieOptions,
        ...overrides,
      })
    },
    set(value, overrides) {
      if (typeof document === 'undefined') return
      // biome-ignore lint/suspicious/noDocumentCookie: this is the cookie abstraction itself
      document.cookie = item.serialize(value, { ...overrides, httpOnly: false })
      for (const l of cookieListeners) l()
    },
    remove() {
      if (typeof document === 'undefined') return
      // biome-ignore lint/suspicious/noDocumentCookie: same
      document.cookie = item.serialize(null)
      for (const l of cookieListeners) l()
    },
    subscribe(listener) {
      const wrapped = () => listener(item.get())
      cookieListeners.add(wrapped)
      return () => {
        cookieListeners.delete(wrapped)
      }
    },
  }
  return item
}

/** Call after something else wrote `document.cookie` so `useCookie()` re-reads. */
export function notifyCookiesChanged() {
  for (const l of cookieListeners) l()
}

/* ----------------------------------------------------------------------------
 * Devtools helpers (used by the storage panel and the provider)
 * ------------------------------------------------------------------------- */

/** Every key in an area, for the devtools panel. */
export function listStorage(name: StorageArea): Array<{ key: string; raw: string | null }> {
  const s = area(name)
  if (!s) return []
  const out: Array<{ key: string; raw: string | null }> = []
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i)
    if (key !== null) out.push({ key, raw: s.getItem(key) })
  }
  return out
}

export function removeStorageKey(name: StorageArea, key: string) {
  area(name)?.removeItem(key)
  emit(key)
}

export function logStorage(app: KitrApp, label: string, data?: unknown) {
  getDevtools(app)?.log('storage', label, data)
}
