---
title: API
description: Every export of kitr/storage, with its signature.
order: 2
---

# API

Every export of `kitr/storage`, `kitr/storage/react`, `kitr/storage/server`, `kitr/storage/provider`, read from the published type definitions. The [guide](/packages/storage) shows them in use.

## kitr/storage

### createAsyncStorageDriver

```ts
function createAsyncStorageDriver(options: {
  name: string;
  load(): Promise<Record<string, string>>;
  write(key: string, raw: string): Promise<void>;
  erase(key: string): Promise<void>;
  onError?: (error: unknown) => void;
}): StorageDriver;
```

Build a driver over an async native store. `load` runs once at boot and fills the cache;
`write`/`erase` run in the background after each change, so reads stay synchronous.

### createMemoryKvDriver

```ts
function createMemoryKvDriver(): KvDriver;
```

### createMemoryStorageDriver

```ts
function createMemoryStorageDriver(name?: string): StorageDriver;
```

In-memory driver: tests, the server, and `session` items on native platforms.

### createWebStorageDriver

```ts
function createWebStorageDriver(name: StorageArea): StorageDriver | null;
```

Web Storage as a driver. Null outside a browser, so items fall back to their defaults.

### defineCookie

```ts
function defineCookie<T = string>(name: string, options: CookieItemOptions<T>): CookieItem<T>;
```

A typed cookie, readable on both sides and writable from the browser or the server.

```ts
const locale = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
locale.get()                      // client: document.cookie
locale.get(request.headers)       // server: any Headers / Cookie header string
locale.set('de')                  // client
cookies(event).set(locale, 'de')  // server (kitr/storage/server)
```

### defineKv

```ts
function defineKv<T>(name: string, options: KvItemOptions<T>): KvItem<T>;
```

A value shared by the whole app on the server (`scope: 'app'`): feature state, counters,
cached lookups. Backed by memory unless `config/storage.ts` sets a `kv` driver
(Redis, Cloudflare KV, a file... anything with get/set/remove).

```ts
const banner = defineKv('banner', { default: { text: '' } })
await banner.set({ text: 'Maintenance at 22:00' })
```

### defineStorage

```ts
function defineStorage<T>(name: string, options: StorageItemOptions<T>): StorageItem<T>;
```

A typed item in localStorage or sessionStorage.

```ts
const sidebar = defineStorage('sidebar', { default: { open: true } })
sidebar.get().open; sidebar.set((s) => ({ ...s, open: false }))
```
Safe everywhere: on the server (or when storage is blocked) `get()` returns the default
and `set()` is a no-op, so the same module renders on both sides.

### getKvDriver

```ts
function getKvDriver(): KvDriver;
```

### getStorageDriver

```ts
function getStorageDriver(name: StorageArea): StorageDriver | null;
```

### listStorage

```ts
function listStorage(name: StorageArea): Array<{
  key: string;
  raw: string | null;
}>;
```

Every key in an area, for the devtools panel.

### logStorage

```ts
function logStorage(app: KitrApp, label: string, data?: unknown): void;
```

### notifyCookiesChanged

```ts
function notifyCookiesChanged(): void;
```

Call after something else wrote `document.cookie` so `useCookie()` re-reads.

### parseCookies

```ts
function parseCookies(header: string | null | undefined): Record<string, string>;
```

Parse a `Cookie` header into a map. Values are decoded with decodeURIComponent.

### removeStorageKey

```ts
function removeStorageKey(name: StorageArea, key: string): void;
```

### serializeCookie

```ts
function serializeCookie(name: string, value: string | null, options?: CookieOptions): string;
```

Build a `Set-Cookie` value. `value === null` expires the cookie.

### setCookieDefaults

```ts
function setCookieDefaults(defaults: Omit<CookieOptions, 'name'>): void;
```

### setKvDriver

```ts
function setKvDriver(driver: KvDriver): void;
```

Set by the storage provider from `config/storage.ts` (`kv`). Any unstorage-shaped driver works.

### setStorageDriver

```ts
function setStorageDriver(driver: StorageDriver, areas?: {
  local?: StorageDriver;
  session?: StorageDriver;
}): void;
```

Replace the Web Storage backing with a platform driver. Called by the storage provider when a
platform registered one (`app.drivers.register('storage', driver)`); `session` items keep an
in-memory driver unless `areas` says otherwise.

### setStoragePrefix

```ts
function setStoragePrefix(prefix: string): void;
```

Set by the provider from `config/storage.ts`; items created later pick it up.

### defineConfig

```ts
const defineConfig: <const C extends StorageConfig>(config: C) => C;
```

### jsonCodec

```ts
const jsonCodec: <T>() => Codec<T>;
```

### stringCodec

```ts
const stringCodec: Codec<string>;
```

### Codec

```ts
interface Codec<T> {
  encode(value: T): string;
  decode(raw: string): T;
}
```

### CookieItem

```ts
interface CookieItem<T> {
  readonly name: string;
  readonly default: T;
  readonly options: CookieOptions;
  /** Read from `document.cookie`, or from the given source on the server. */
  get(source?: CookieSource): T;
  /** Write `document.cookie` (client). On the server use `cookies(event).set(item, value)`. */
  set(value: T, options?: CookieOptions): void;
  remove(): void;
  subscribe(listener: (value: T) => void): () => void;
  /** The `Set-Cookie` header value for this item. */
  serialize(value: T | null, options?: CookieOptions): string;
  /** Parse one raw cookie value into T (or the default). */
  decode(raw: string | undefined): T;
}
```

### CookieItemOptions

```ts
interface CookieItemOptions<T> extends CookieOptions {
  default: T;
  schema?: StandardSchemaV1<unknown, T>;
  /** Default: JSON for objects, plain string for string defaults. */
  codec?: Codec<T>;
}
```

### CookieOptions

```ts
interface CookieOptions {
  path?: string;
  domain?: string;
  /** Seconds. */
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  /** Server-set cookies only; the browser cannot write httpOnly cookies. */
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}
```

### KvDriver

```ts
interface KvDriver {
  get(key: string): Promise<string | null>;
  set(key: string, raw: string, options?: {
    ttl?: number;
  }): Promise<void>;
  remove(key: string): Promise<void>;
  keys?(prefix?: string): Promise<string[]>;
}
```

### KvItem

```ts
interface KvItem<T> {
  readonly key: string;
  readonly default: T;
  get(): Promise<T>;
  set(value: T | ((current: T) => T), options?: {
    ttl?: number;
  }): Promise<void>;
  remove(): Promise<void>;
}
```

### KvItemOptions

```ts
interface KvItemOptions<T> {
  default: T;
  schema?: StandardSchemaV1<unknown, T>;
  codec?: Codec<T>;
  /** Milliseconds to keep a value. */
  ttl?: number;
}
```

### StorageConfig

```ts
interface StorageConfig {
  /** Prefix for every storage key and cookie name, e.g. `myapp:`. Default none. */
  prefix?: string;
  /** Defaults merged into every cookie. */
  cookie?: Omit<CookieOptions, 'name'>;
  /** Server-side key-value store behind `defineKv` (app scope). Default: in-memory. */
  kv?: KvDriver;
}
```

### StorageDriver

```ts
interface StorageDriver {
  name: string;
  /** Load every stored key into memory before the first render. */
  hydrate?(): Promise<void>;
  get(key: string): string | null;
  set(key: string, raw: string): void;
  remove(key: string): void;
  keys(): string[];
  /** Changes made elsewhere (another tab, the native side). */
  subscribe?(listener: (key: string | null) => void): () => void;
}
```

What a platform supplies to back `defineStorage` items: Capacitor Preferences on mobile,
the Tauri store or an Electron JSON file on desktop, Web Storage in the browser.
Reads are synchronous from a cache `hydrate()` fills at boot; writes go through in the background.

### StorageItem

```ts
interface StorageItem<T> {
  readonly key: string;
  readonly area: StorageArea;
  get(): T;
  set(value: T | ((current: T) => T)): void;
  remove(): void;
  /** Fires on set/remove here and in other tabs (`storage` event). */
  subscribe(listener: (value: T) => void): () => void;
  /** The default, for server snapshots. */
  readonly default: T;
}
```

### StorageItemOptions

```ts
interface StorageItemOptions<T> {
  /** Returned when the key is missing, unparsable, invalid or on the server. */
  default: T;
  area?: StorageArea;
  /** Validate what comes back from storage (Standard Schema: zod, valibot...). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>;
  codec?: Codec<T>;
  /** Bump when the shape changes; stored values with another version are migrated or dropped. */
  version?: number;
  migrate?: (raw: unknown, fromVersion: number) => T;
  /** Keep this many ms, then treat as missing. Stored beside the value. */
  ttl?: number;
}
```

### CookieSource

```ts
type CookieSource = string | null | undefined | Headers | {
  cookie?: string | null;
};
```

Anything that can hold cookies: a `Cookie` header string, a Headers object or `document`.

### StorageArea

```ts
type StorageArea = 'local' | 'session';
```

## kitr/storage/react

### CookieHeader

```ts
function CookieHeader({ value, children }: {
  value: string | null | undefined;
  children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<string | null | undefined>>;
```

### useCookie

```ts
function useCookie<T>(item: CookieItem<T>): [
  T,
  (value: T) => void,
  () => void
];
```

Read and write a cookie from a component. On the server the value comes from
`<CookieHeader>` when present, otherwise the default.

### useStorage

```ts
function useStorage<T>(item: StorageItem<T>): [
  T,
  (value: T | ((current: T) => T)) => void,
  () => void
];
```

Read and write a storage item from a component. Hydration-safe: the server (and the first
client render) see the default, then the stored value applies, so markup always matches.

## kitr/storage/server

### cookies

```ts
function cookies(event: CookieEventLike): ServerCookies;

function cookies(request: Request, responseHeaders: Headers): ServerCookies;
```

Typed cookies on the server: `cookies(event)` in a controller or middleware,
`cookies(request, responseHeaders)` anywhere you only have the Fetch primitives.

### CookieEventLike

```ts
interface CookieEventLike {
  req: {
    headers: Headers;
  };
  res: {
    headers: Headers;
  };
}
```

The parts of an h3 v2 event (or anything request/response shaped) that cookies need.

### ServerCookies

```ts
interface ServerCookies {
  get<T>(item: CookieItem<T>): T;
  /** Appends a `Set-Cookie` header; `httpOnly` and the other item options apply. */
  set<T>(item: CookieItem<T>, value: T, options?: CookieOptions): void;
  remove(item: CookieItem<unknown>): void;
  /** The raw `Cookie` header, for `<CookieHeader>` during SSR. */
  readonly header: string | null;
}
```

## kitr/storage/provider

### storageProvider

```ts
const storageProvider: import("@kitr/core").KitrProvider;
```

Applies `config/storage.ts` (key prefix, cookie defaults, kv driver), switches `defineStorage`
items to the platform's native driver when one is registered, hydrates it before the first
render, and contributes the Storage panel to the devtools.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
