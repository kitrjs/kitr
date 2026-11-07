import {
  createDefineConfig,
  getDevtools,
  type KitrApp,
  type StandardSchemaV1,
  validateSync,
} from '@kitr/core'

/** Options for `config/storage.ts`: a key prefix, cookie defaults and the server-side kv driver. */
export interface StorageConfig {
  /** Prefix for every storage key and cookie name, e.g. `myapp:`. Default none. */
  prefix?: string
  /** Defaults merged into every cookie. */
  cookie?: Omit<CookieOptions, 'name'>
  /** Server-side key-value store behind `defineKv` (app scope). Default: in-memory. */
  kv?: KvDriver
}

/**
 * What a platform supplies to back `defineStorage` items: Capacitor Preferences on mobile,
 * the Tauri store or an Electron JSON file on desktop, Web Storage in the browser.
 * Reads are synchronous from a cache `hydrate()` fills at boot; writes go through in the background.
 */
export interface StorageDriver {
  /** Shown in the devtools log, e.g. `web:local` or `capacitor:preferences`. */
  name: string
  /** Load every stored key into memory before the first render. */
  hydrate?(): Promise<void>
  /** The raw string stored under `key`, or null. Must answer synchronously. */
  get(key: string): string | null
  /** Store a raw string. May persist in the background. */
  set(key: string, raw: string): void
  /** Delete one key. */
  remove(key: string): void
  /** Every stored key, for the devtools panel. */
  keys(): string[]
  /** Changes made elsewhere (another tab, the native side). */
  subscribe?(listener: (key: string | null) => void): () => void
}

/**
 * The server-side store behind `defineKv`: anything async with get, set and remove over strings.
 * Wrap Redis, Cloudflare KV or a file in this shape and pass it as `kv` in `config/storage.ts`.
 */
export interface KvDriver {
  /** The raw string under `key`, or null when missing or expired. */
  get(key: string): Promise<string | null>
  /** Store a raw string; `ttl` is in milliseconds. */
  set(key: string, raw: string, options?: { ttl?: number }): Promise<void>
  /** Delete one key. */
  remove(key: string): Promise<void>
  /** Keys starting with `prefix`. Optional; kitr does not call it. */
  keys?(prefix?: string): Promise<string[]>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    storage: StorageConfig
  }
  interface DriverTypes {
    storage: StorageDriver
  }
}

/** Type-checks `config/storage.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<StorageConfig>()

/* ----------------------------------------------------------------------------
 * Codecs
 * ------------------------------------------------------------------------- */

/** Turns a value into the string that is stored and back. Pass one as `codec` to change the format. */
export interface Codec<T> {
  /** Value to stored string. */
  encode(value: T): string
  /** Stored string to value. Throwing makes the item fall back to its default. */
  decode(raw: string): T
}

/** The default codec for objects: `JSON.stringify` and `JSON.parse`. */
export const jsonCodec = <T>(): Codec<T> => ({
  encode: (v) => JSON.stringify(v),
  decode: (raw) => JSON.parse(raw) as T,
})

/** Stores strings as they are, with no quotes. The default for cookies whose default is a string. */
export const stringCodec: Codec<string> = { encode: (v) => v, decode: (raw) => raw }

/* ----------------------------------------------------------------------------
 * Web Storage items
 * ------------------------------------------------------------------------- */

/** `local` keeps a value until it is cleared; `session` keeps it for the current tab. */
export type StorageArea = 'local' | 'session'

/** Options for `defineStorage`: the default, the area, and how stored values are checked. */
export interface StorageItemOptions<T> {
  /** Returned when the key is missing, unparsable, invalid or on the server. */
  default: T
  /** Where it is stored. Default `local`. */
  area?: StorageArea
  /** Validate what comes back from storage (Standard Schema: zod, valibot...). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>
  /** Format of the stored envelope. Default: JSON. */
  codec?: Codec<T>
  /** Bump when the shape changes; stored values with another version are migrated or dropped. */
  version?: number
  /** Converts a value stored under an older `version`. Without it, old values are dropped. */
  migrate?: (raw: unknown, fromVersion: number) => T
  /** Keep this many ms, then treat as missing. Stored beside the value. */
  ttl?: number
}

/** A typed value in local or session storage, returned by `defineStorage`. */
export interface StorageItem<T> {
  /** The name it was defined with, without the config prefix. */
  readonly key: string
  /** Which area it lives in. */
  readonly area: StorageArea
  /** The stored value, or the default when it is missing, invalid, expired or on the server. */
  get(): T
  /** Store a value, or compute it from the current one. A no-op on the server. */
  set(value: T | ((current: T) => T)): void
  /** Delete the stored value so `get()` returns the default. */
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

function webStorage(name: StorageArea): Storage | null {
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

/** Web Storage as a driver. Null outside a browser, so items fall back to their defaults. */
export function createWebStorageDriver(name: StorageArea): StorageDriver | null {
  const s = webStorage(name)
  if (!s) return null
  return {
    name: `web:${name}`,
    get: (key) => s.getItem(key),
    set: (key, raw) => s.setItem(key, raw),
    remove: (key) => s.removeItem(key),
    keys: () => {
      const out: string[] = []
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i)
        if (key !== null) out.push(key)
      }
      return out
    },
    subscribe: (listener) => {
      if (typeof window === 'undefined') return () => {}
      const handler = (e: StorageEvent) => {
        if (e.storageArea === s) listener(e.key)
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}

/** In-memory driver: tests, the server, and `session` items on native platforms. */
export function createMemoryStorageDriver(name = 'memory'): StorageDriver {
  const map = new Map<string, string>()
  return {
    name,
    get: (key) => map.get(key) ?? null,
    set: (key, raw) => void map.set(key, raw),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  }
}

/**
 * Build a driver over an async native store. `load` runs once at boot and fills the cache;
 * `write`/`erase` run in the background after each change, so reads stay synchronous.
 */
export function createAsyncStorageDriver(options: {
  name: string
  load(): Promise<Record<string, string>>
  write(key: string, raw: string): Promise<void>
  erase(key: string): Promise<void>
  onError?: (error: unknown) => void
}): StorageDriver {
  const cache = new Map<string, string>()
  const fail = options.onError ?? ((e) => console.error(`[kitr/storage] ${options.name}:`, e))
  return {
    name: options.name,
    async hydrate() {
      try {
        for (const [k, v] of Object.entries(await options.load())) cache.set(k, v)
      } catch (e) {
        fail(e)
      }
    },
    get: (key) => cache.get(key) ?? null,
    set: (key, raw) => {
      cache.set(key, raw)
      options.write(key, raw).catch(fail)
    },
    remove: (key) => {
      cache.delete(key)
      options.erase(key).catch(fail)
    },
    keys: () => [...cache.keys()],
  }
}

const drivers: { local?: StorageDriver | null; session?: StorageDriver | null } = {}
const driverUnsubscribers: Array<() => void> = []

/**
 * Replace the Web Storage backing with a platform driver. Called by the storage provider when a
 * platform registered one (`app.drivers.register('storage', driver)`); `session` items keep an
 * in-memory driver unless `areas` says otherwise.
 */
export function setStorageDriver(
  driver: StorageDriver,
  areas: { local?: StorageDriver; session?: StorageDriver } = {},
) {
  drivers.local = areas.local ?? driver
  drivers.session = areas.session ?? createMemoryStorageDriver('memory:session')
  for (const stop of driverUnsubscribers.splice(0)) stop()
  for (const d of [drivers.local, drivers.session]) {
    const stop = d.subscribe?.((key) => {
      if (key === null) for (const set of listenersByKey.values()) for (const l of set) l()
      else emit(key)
    })
    if (stop) driverUnsubscribers.push(stop)
  }
}

/** The driver behind an area: the platform driver, Web Storage, or null on the server. */
export function getStorageDriver(name: StorageArea): StorageDriver | null {
  if (drivers[name] === undefined) drivers[name] = createWebStorageDriver(name)
  return drivers[name] ?? null
}

function area(name: StorageArea): StorageDriver | null {
  return getStorageDriver(name)
}

function installCrossTab() {
  if (crossTabInstalled || typeof window === 'undefined') return
  crossTabInstalled = true
  // Web Storage events for the default drivers; platform drivers wire their own in setStorageDriver.
  window.addEventListener('storage', (e) => {
    if (drivers.local && drivers.local.name !== 'web:local') return
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
      const raw = s.get(fullKey())
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
        s.set(fullKey(), (codec as Codec<Envelope>).encode(env))
      } catch {
        // Quota exceeded: keep running with the in-memory value.
        cache = { raw: null, value }
      }
      emit(fullKey())
    },
    remove() {
      area(areaName)?.remove(fullKey())
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

/** Attributes written into `Set-Cookie`. `path: '/'` and `sameSite: 'lax'` apply unless overridden. */
export interface CookieOptions {
  /** URL path the cookie is sent for. */
  path?: string
  /** Domain the cookie is sent to, e.g. `.acme.com` to share it with subdomains. */
  domain?: string
  /** Seconds. */
  maxAge?: number
  /** Absolute expiry date. */
  expires?: Date
  /** Send only over HTTPS. Forced on when `sameSite` is `none`. */
  secure?: boolean
  /** Server-set cookies only; the browser cannot write httpOnly cookies. */
  httpOnly?: boolean
  /** Cross-site sending rule. */
  sameSite?: 'lax' | 'strict' | 'none'
}

/** Options for `defineCookie`: the default, validation, format, and the cookie attributes. */
export interface CookieItemOptions<T> extends CookieOptions {
  /** Returned when the cookie is missing or invalid. */
  default: T
  /** Validate the decoded value (Standard Schema). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>
  /** Default: JSON for objects, plain string for string defaults. */
  codec?: Codec<T>
}

/** Anything that can hold cookies: a `Cookie` header string, a Headers object or `document`. */
export type CookieSource = string | null | undefined | Headers | { cookie?: string | null }

/** A typed cookie returned by `defineCookie`, readable on both sides. */
export interface CookieItem<T> {
  /** The name it was defined with, without the config prefix. */
  readonly name: string
  /** Returned when the cookie is missing or invalid. */
  readonly default: T
  /** The attributes given to `defineCookie`. */
  readonly options: CookieOptions
  /** Read from `document.cookie`, or from the given source on the server. */
  get(source?: CookieSource): T
  /** Write `document.cookie` (client). On the server use `cookies(event).set(item, value)`. */
  set(value: T, options?: CookieOptions): void
  /** Expire the cookie in the browser. A no-op on the server. */
  remove(): void
  /** Fires after `set`, `remove` or `notifyCookiesChanged()` in this tab. */
  subscribe(listener: (value: T) => void): () => void
  /** The `Set-Cookie` header value for this item. */
  serialize(value: T | null, options?: CookieOptions): string
  /** Parse one raw cookie value into T (or the default). */
  decode(raw: string | undefined): T
}

const cookieListeners = new Set<() => void>()
let cookieDefaults: Omit<CookieOptions, 'name'> = {}
/** Attributes merged into every cookie this app writes. The provider sets them from `cookie` in config. */
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
  return s.keys().map((key) => ({ key, raw: s.get(key) }))
}

/** Delete one raw key from an area and notify subscribers. Used by the devtools panel. */
export function removeStorageKey(name: StorageArea, key: string) {
  area(name)?.remove(key)
  emit(key)
}

/** Write a line to the devtools `storage` channel. Does nothing when devtools are off. */
export function logStorage(app: KitrApp, label: string, data?: unknown) {
  getDevtools(app)?.log('storage', label, data)
}

/* ----------------------------------------------------------------------------
 * App scope: a server-side key-value store
 * ------------------------------------------------------------------------- */

/** The default `kv` driver: a Map with ttl support. Values are lost on restart and not shared between processes. */
export function createMemoryKvDriver(): KvDriver {
  const map = new Map<string, { raw: string; expires?: number }>()
  return {
    async get(key) {
      const hit = map.get(key)
      if (!hit) return null
      if (hit.expires !== undefined && hit.expires < Date.now()) {
        map.delete(key)
        return null
      }
      return hit.raw
    },
    async set(key, raw, options) {
      map.set(key, { raw, expires: options?.ttl ? Date.now() + options.ttl : undefined })
    },
    async remove(key) {
      map.delete(key)
    },
    async keys(prefix = '') {
      return [...map.keys()].filter((k) => k.startsWith(prefix))
    },
  }
}

let kvDriver: KvDriver | undefined
/** Set by the storage provider from `config/storage.ts` (`kv`). Any object with async get, set and remove over strings works. */
export function setKvDriver(driver: KvDriver) {
  kvDriver = driver
}
/** The active `kv` driver, creating the in-memory one on first use. */
export function getKvDriver(): KvDriver {
  kvDriver ??= createMemoryKvDriver()
  return kvDriver
}

/** Options for `defineKv`: the default, validation, format and a default ttl. */
export interface KvItemOptions<T> {
  /** Returned when the key is missing, expired or invalid. */
  default: T
  /** Validate what comes back from the driver (Standard Schema). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>
  /** Format of the stored string. Default: JSON. */
  codec?: Codec<T>
  /** Milliseconds to keep a value. */
  ttl?: number
}

/** A typed server-side value returned by `defineKv`. Every method is async. */
export interface KvItem<T> {
  /** The name it was defined with, without the config prefix. */
  readonly key: string
  /** Returned when the key is missing, expired or invalid. */
  readonly default: T
  /** The stored value, or the default. */
  get(): Promise<T>
  /** Store a value, or compute it from the current one. `ttl` overrides the item's default. */
  set(value: T | ((current: T) => T), options?: { ttl?: number }): Promise<void>
  /** Delete the stored value. */
  remove(): Promise<void>
}

/**
 * A value shared by the whole app on the server (`scope: 'app'`): feature state, counters,
 * cached lookups. Backed by memory unless `config/storage.ts` sets a `kv` driver
 * (Redis, Cloudflare KV, a file... anything with get/set/remove).
 *
 *   const banner = defineKv('banner', { default: { text: '' } })
 *   await banner.set({ text: 'Maintenance at 22:00' })
 */
export function defineKv<T>(name: string, options: KvItemOptions<T>): KvItem<T> {
  const codec = options.codec ?? jsonCodec<T>()
  const fullKey = () => `${keyPrefix}${name}`
  const decode = (raw: string | null): T => {
    if (raw === null) return options.default
    try {
      const data = codec.decode(raw)
      if (options.schema) {
        const result = validateSync(options.schema, data)
        return result.success ? result.data : options.default
      }
      return data
    } catch {
      return options.default
    }
  }
  const item: KvItem<T> = {
    key: name,
    default: options.default,
    get: async () => decode(await getKvDriver().get(fullKey())),
    async set(next, setOptions) {
      const value = typeof next === 'function' ? (next as (c: T) => T)(await item.get()) : next
      await getKvDriver().set(fullKey(), codec.encode(value), {
        ttl: setOptions?.ttl ?? options.ttl,
      })
    },
    remove: () => getKvDriver().remove(fullKey()),
  }
  return item
}
