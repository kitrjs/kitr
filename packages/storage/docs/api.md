---
title: API reference
description: Every export of kitr/storage, with its signature.
order: 2
---

# API reference

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

### getStorageDriver

```ts
function getStorageDriver(name: StorageArea): StorageDriver | null;
```

The driver behind an area: the platform driver, Web Storage, or null on the server.

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

Write a line to the devtools `storage` channel. Does nothing when devtools are off.

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

Delete one raw key from an area and notify subscribers. Used by the devtools panel.

### serializeCookie

```ts
function serializeCookie(name: string, value: string | null, options?: CookieOptions): string;
```

Build a `Set-Cookie` value. `value === null` expires the cookie.

### setCookieDefaults

```ts
function setCookieDefaults(defaults: Omit<CookieOptions, 'name'>): void;
```

Attributes merged into every cookie this app writes. The provider sets them from `cookie` in config.

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

Type-checks `config/storage.ts`. Returns the object unchanged.

### jsonCodec

```ts
const jsonCodec: <T>() => Codec<T>;
```

The default codec for objects: `JSON.stringify` and `JSON.parse`.

### stringCodec

```ts
const stringCodec: Codec<string>;
```

Stores strings as they are, with no quotes. The default for cookies whose default is a string.

### Codec

```ts
interface Codec<T> {
  /** Value to stored string. */
  encode(value: T): string;
  /** Stored string to value. Throwing makes the item fall back to its default. */
  decode(raw: string): T;
}
```

Turns a value into the string that is stored and back. Pass one as `codec` to change the format.

### CookieItem

```ts
interface CookieItem<T> {
  /** The name it was defined with, without the config prefix. */
  readonly name: string;
  /** Returned when the cookie is missing or invalid. */
  readonly default: T;
  /** The attributes given to `defineCookie`. */
  readonly options: CookieOptions;
  /** Read from `document.cookie`, or from the given source on the server. */
  get(source?: CookieSource): T;
  /** Write `document.cookie` (client). On the server use `cookies(event).set(item, value)`. */
  set(value: T, options?: CookieOptions): void;
  /** Expire the cookie in the browser. A no-op on the server. */
  remove(): void;
  /** Fires after `set`, `remove` or `notifyCookiesChanged()` in this tab. */
  subscribe(listener: (value: T) => void): () => void;
  /** The `Set-Cookie` header value for this item. */
  serialize(value: T | null, options?: CookieOptions): string;
  /** Parse one raw cookie value into T (or the default). */
  decode(raw: string | undefined): T;
}
```

A typed cookie returned by `defineCookie`, readable on both sides.

### CookieItemOptions

```ts
interface CookieItemOptions<T> extends CookieOptions {
  /** Returned when the cookie is missing or invalid. */
  default: T;
  /** Validate the decoded value (Standard Schema). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>;
  /** Default: JSON for objects, plain string for string defaults. */
  codec?: Codec<T>;
}
```

Options for `defineCookie`: the default, validation, format, and the cookie attributes.

### CookieOptions

```ts
interface CookieOptions {
  /** URL path the cookie is sent for. */
  path?: string;
  /** Domain the cookie is sent to, e.g. `.acme.com` to share it with subdomains. */
  domain?: string;
  /** Seconds. */
  maxAge?: number;
  /** Absolute expiry date. */
  expires?: Date;
  /** Send only over HTTPS. Forced on when `sameSite` is `none`. */
  secure?: boolean;
  /** Server-set cookies only; the browser cannot write httpOnly cookies. */
  httpOnly?: boolean;
  /** Cross-site sending rule. */
  sameSite?: 'lax' | 'strict' | 'none';
}
```

Attributes written into `Set-Cookie`. `path: '/'` and `sameSite: 'lax'` apply unless overridden.

### StorageConfig

```ts
interface StorageConfig {
  /** Prefix for every storage key and cookie name, e.g. `myapp:`. Default none. */
  prefix?: string;
  /** Defaults merged into every cookie. */
  cookie?: Omit<CookieOptions, 'name'>;
}
```

Options for `config/storage.ts`: a key prefix and cookie defaults.

### StorageDriver

```ts
interface StorageDriver {
  /** Shown in the devtools log, e.g. `web:local` or `capacitor:preferences`. */
  name: string;
  /** Load every stored key into memory before the first render. */
  hydrate?(): Promise<void>;
  /** The raw string stored under `key`, or null. Must answer synchronously. */
  get(key: string): string | null;
  /** Store a raw string. May persist in the background. */
  set(key: string, raw: string): void;
  /** Delete one key. */
  remove(key: string): void;
  /** Every stored key, for the devtools panel. */
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
  /** The name it was defined with, without the config prefix. */
  readonly key: string;
  /** Which area it lives in. */
  readonly area: StorageArea;
  /** The stored value, or the default when it is missing, invalid, expired or on the server. */
  get(): T;
  /** Store a value, or compute it from the current one. A no-op on the server. */
  set(value: T | ((current: T) => T)): void;
  /** Delete the stored value so `get()` returns the default. */
  remove(): void;
  /** Fires on set/remove here and in other tabs (`storage` event). */
  subscribe(listener: (value: T) => void): () => void;
  /** The default, for server snapshots. */
  readonly default: T;
}
```

A typed value in local or session storage, returned by `defineStorage`.

### StorageItemOptions

```ts
interface StorageItemOptions<T> {
  /** Returned when the key is missing, unparsable, invalid or on the server. */
  default: T;
  /** Where it is stored. Default `local`. */
  area?: StorageArea;
  /** Validate what comes back from storage (Standard Schema: zod, valibot...). Invalid → default. */
  schema?: StandardSchemaV1<unknown, T>;
  /** Format of the stored envelope. Default: JSON. */
  codec?: Codec<T>;
  /** Bump when the shape changes; stored values with another version are migrated or dropped. */
  version?: number;
  /** Converts a value stored under an older `version`. Without it, old values are dropped. */
  migrate?: (raw: unknown, fromVersion: number) => T;
  /** Keep this many ms, then treat as missing. Stored beside the value. */
  ttl?: number;
}
```

Options for `defineStorage`: the default, the area, and how stored values are checked.

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

`local` keeps a value until it is cleared; `session` keeps it for the current tab.

## kitr/storage/react

### CookieHeader

```ts
function CookieHeader({ value, children }: {
  value: string | null | undefined;
  children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<string | null | undefined>>;
```

Gives `useCookie()` the request's `Cookie` header during server rendering, so the first
HTML shows the stored value instead of the default. Wrap the tree once, in the root route.

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
  /** The request; only its headers are read. */
  req: {
    headers: Headers;
  };
  /** The response; `Set-Cookie` headers are appended here. */
  res: {
    headers: Headers;
  };
}
```

The parts of an h3 v2 event (or anything request/response shaped) that cookies need.

### ServerCookies

```ts
interface ServerCookies {
  /** The item's value from the request's `Cookie` header, or its default. */
  get<T>(item: CookieItem<T>): T;
  /** Appends a `Set-Cookie` header; `httpOnly` and the other item options apply. */
  set<T>(item: CookieItem<T>, value: T, options?: CookieOptions): void;
  /** Appends a `Set-Cookie` header that expires the cookie. */
  remove(item: CookieItem<unknown>): void;
  /** The raw `Cookie` header, for `<CookieHeader>` during SSR. */
  readonly header: string | null;
}
```

Typed cookie access for one request, returned by `cookies()`.

## kitr/storage/provider

### storageProvider

```ts
const storageProvider: import("@kitr/core").KitrProvider;
```

Applies `config/storage.ts` (key prefix, cookie defaults), switches `defineStorage`
items to the platform's native driver when one is registered, hydrates it before the first
render, and contributes the Storage panel to the devtools.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
