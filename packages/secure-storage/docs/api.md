---
title: API
description: Every export of kitr/secure-storage, with its signature.
order: 2
---

# API

Every export of `kitr/secure-storage`, `kitr/secure-storage/react`, `kitr/secure-storage/provider`, read from the published type definitions. The [guide](/packages/secure-storage) shows them in use.

## kitr/secure-storage

### createMemorySecureStorageDriver

```ts
function createMemorySecureStorageDriver(name?: string): SecureStorageDriver;
```

A vault in a `Map`, for tests and the server. `secure` is false; nothing survives a restart.

### createSecureStorage

```ts
function createSecureStorage(config?: SecureStorageConfig, app?: KitrApp): SecureStorage;
```

Build the `secureStorage` service. The driver is `config.driver`, else the vault registered on
`app`, else the encrypted web fallback in a browser or the memory driver on the server.

### createWebSecureStorageDriver

```ts
function createWebSecureStorageDriver(storage?: StorageDriver): SecureStorageDriver;
```

Encrypts values with AES-GCM before handing them to a `StorageDriver`. The key never leaves
the browser's key store, so the ciphertext in local storage cannot be read elsewhere.

### defineSecureItem

```ts
function defineSecureItem<T>(key: string, options?: SecureItemOptions<T>): (storage: SecureStorage) => SecureItem<T>;
```

A typed, subscribable secret: `const session = defineSecureItem<Session>('session')`.
Call it with a service to bind it, `session(app.container.use('secureStorage'))`, or pass it to `useSecureItem`.

### useSecureStorage

```ts
function useSecureStorage(app: KitrApp): SecureStorage;
```

The app's `secureStorage` service, outside React. Same as `app.container.use('secureStorage')`.

### defineConfig

```ts
const defineConfig: <const C extends SecureStorageConfig>(config: C) => C;
```

Types `config/secure-storage.ts`. Returns the object unchanged.

### SecureItem

```ts
interface SecureItem<T> {
  /** The key, without the service prefix. */
  key: string;
  /** Resolve the value, or undefined when missing. Corrupt or invalid values are removed. */
  get(): Promise<T | undefined>;
  /** Store the value and notify this item's subscribers. */
  set(value: T): Promise<void>;
  /** Delete the value and notify this item's subscribers with undefined. */
  remove(): Promise<void>;
  /** Hear writes made through this bound item; returns an unsubscribe function. */
  subscribe(listener: (value: T | undefined) => void): () => void;
}
```

A typed secret bound to a `SecureStorage` service, as returned by calling a `defineSecureItem` result.

### SecureItemOptions

```ts
interface SecureItemOptions<T> {
  /** Validate what comes back from the vault; invalid values are removed. */
  schema?: StandardSchemaV1<unknown, T>;
  /** Serialise with something other than JSON. */
  codec?: {
    encode(value: T): string;
    decode(raw: string): T;
  };
}
```

Options for `defineSecureItem`: a schema to check reads and a codec for non-JSON values.

### SecureStorage

```ts
interface SecureStorage {
  /** The active driver. */
  readonly driver: SecureStorageDriver;
  /** True when values live in an OS vault rather than the encrypted web fallback. */
  readonly secure: boolean;
  /** Resolve the string stored under `key`, or null. */
  get(key: string): Promise<string | null>;
  /** Store a string. Throws under `requireSecure` when no vault is registered. */
  set(key: string, value: string): Promise<void>;
  /** Delete a key. */
  remove(key: string): Promise<void>;
  /** Keys written through this service (not every item in the vault). */
  keys(): Promise<string[]>;
  /** Remove every key `keys()` returns, leaving other prefixes alone. */
  clear(): Promise<void>;
}
```

The `secureStorage` service: async string storage over the vault, under one key prefix.

### SecureStorageConfig

```ts
interface SecureStorageConfig {
  /** Prefix for every key. Default `kitr:secure:`. */
  prefix?: string;
  /** Replace the resolved driver (tests, custom vaults). */
  driver?: SecureStorageDriver;
  /** Where the web fallback keeps the ciphertext. Default: the app's local storage driver. */
  storage?: StorageDriver;
  /** Refuse to store anything when only the web fallback is available (production kiosks, banking). */
  requireSecure?: boolean;
}
```

Options for `config/secure-storage.ts` and `createSecureStorage()`.

### SecureStorageDriver

```ts
/** What a vault implements. Keys arrive with the service's prefix already added. */
interface SecureStorageDriver {
  /** Shown in devtools, such as `web-crypto` or `memory`. */
  name: string;
  /** Backed by hardware or an OS vault (false for the web fallback). */
  secure: boolean;
  /** Resolve the stored string, or null. */
  get(key: string): Promise<string | null>;
  /** Store a string. */
  set(key: string, value: string): Promise<void>;
  /** Delete a key. */
  remove(key: string): Promise<void>;
  /** Every stored key. Optional: without it the service lists keys written this session. */
  keys?(): Promise<string[]>;
}
```

What a vault implements. Keys arrive with the service's prefix already added.

## kitr/secure-storage/react

### useSecureItem

```ts
function useSecureItem<T>(define: (storage: SecureStorage) => SecureItem<T>): [
  T | undefined,
  (value: T | undefined) => Promise<void>,
  {
    loading: boolean;
    secure: boolean;
  }
];
```

Read and write one secret: `const [session, setSession, { loading }] = useSecureItem(sessionItem)`.
The value is `undefined` until the vault answers (and always on the server).

### useSecureStorage

```ts
function useSecureStorage(): SecureStorage;
```

The app's `secureStorage` service in a component.

## kitr/secure-storage/provider

### secureStorageProvider

```ts
const secureStorageProvider: import("@kitr/core").KitrProvider;
```

Binds `secureStorage` to the platform vault (registered by the mobile/desktop providers under
the `secure-storage` capability) or the encrypted web fallback. On the server it is an in-memory
store, so code that runs in both places needs no branches.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
