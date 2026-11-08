---
title: API reference
description: Every export of kitr/secure-storage, with its signature.
order: 2
---

# API reference

Every export of `kitr/secure-storage`, `kitr/secure-storage/react`, `kitr/secure-storage/provider`, `kitr/secure-storage/driver`, `kitr/secure-storage/drivers/web`, `kitr/secure-storage/drivers/electron`, `kitr/secure-storage/drivers/tauri`, `kitr/secure-storage/drivers/capacitor`, read from the published type definitions. The [guide](/packages/secure-storage/guide) shows them in use.

## kitr/secure-storage

### createCapacitorSecureStorageDriver

```ts
function createCapacitorSecureStorageDriver(_options?: DriverOptions): Driver;
```

Secure storage for the Capacitor shell on `@aparajita/capacitor-secure-storage`: the iOS Keychain
and, on Android, the Keystore with encrypted shared preferences. Values are strings and stay on
this device (`whenUnlockedThisDeviceOnly`: no iCloud sync, no migration to a new phone, readable
only while unlocked). Never falls back to `localStorage`.

### createElectronSecureStorageDriver

```ts
function createElectronSecureStorageDriver(_options?: DriverOptions): Driver;
```

The secure-storage driver for the Electron shell. Values are encrypted in the main process with
`safeStorage` (Keychain on macOS, DPAPI on Windows, the desktop's secret service on Linux) and
the ciphertext is kept in `kitr-secure-storage.json` in `userData`, served over the `kitr:secure:*`
channels of `handleKitrIpc()`. The window never sees the key. Where the OS has no vault, main
refuses to store and `set()` rejects, so nothing is ever kept in the clear.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

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
`app`, else `selectDriver()` for the runtime: the encrypted web fallback in a browser, the memory driver on
the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set.

### createTauriSecureStorageDriver

```ts
function createTauriSecureStorageDriver(options?: TauriSecureStorageOptions): Driver;
```

The secure-storage driver for the Tauri shell, on `@tauri-apps/plugin-stronghold`: an encrypted
IOTA Stronghold snapshot in the app data dir, opened with a password that the Rust side keeps in
the OS keyring. The plugins are imported on first use and are optional peers; when one is
missing, every method rejects with `E_DRIVER_UNAVAILABLE`.

Stronghold rather than `plugin-store`: the store plugin writes plain JSON to disk, which is
storage, not a vault.

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

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The secure-storage driver for a runtime: the AES-GCM web fallback on `web` (a memory driver on
the server), and each shell's OS vault (Keychain, Keystore, safeStorage, keyring). A shell with
no vault driver yet throws `E_DRIVER_UNAVAILABLE` rather than quietly encrypting into WebView
storage, unless `fallbackToWeb` is set.

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

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** Where the web fallback keeps its ciphertext. Default: the app's local storage driver. */
  storage?: StorageDriver;
}
```

Options of `selectDriver()`.

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
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no vault driver, use the encrypted web
   * fallback inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. The ciphertext and its
   * key then live in WebView storage, not the OS vault, so `secure` stays false. Default false.
   */
  fallbackToWeb?: boolean;
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

### TauriSecureStorageOptions

```ts
interface TauriSecureStorageOptions extends DriverOptions {
  /**
   * The vault password. Stronghold derives the snapshot key from it, so it must not be a constant
   * in the bundle. Default: the random secret the scaffolded Rust side keeps in the OS keyring,
   * read with `invoke('kitr_vault_key')`.
   */
  password?: () => Promise<string>;
  /** The snapshot file inside the app data dir. Default `kitr-vault.hold`. */
  file?: string;
  /** The Stronghold client name. Default `kitr`. */
  client?: string;
}
```

Options of the Tauri secure-storage driver, passed to `createTauriDriver()`.

### Driver

```ts
type Driver = SecureStorageDriver;
```

What a secure-storage driver is: `SecureStorageDriver`, whichever runtime supplies it.

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

## kitr/secure-storage/driver

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The secure-storage driver for a runtime: the AES-GCM web fallback on `web` (a memory driver on
the server), and each shell's OS vault (Keychain, Keystore, safeStorage, keyring). A shell with
no vault driver yet throws `E_DRIVER_UNAVAILABLE` rather than quietly encrypting into WebView
storage, unless `fallbackToWeb` is set.

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** Where the web fallback keeps its ciphertext. Default: the app's local storage driver. */
  storage?: StorageDriver;
}
```

Options of `selectDriver()`.

### Driver

```ts
type Driver = SecureStorageDriver;
```

What a secure-storage driver is: `SecureStorageDriver`, whichever runtime supplies it.

## kitr/secure-storage/drivers/web

### createWebSecureStorageDriver

```ts
function createWebSecureStorageDriver(storage?: StorageDriver): SecureStorageDriver;
```

Encrypts values with AES-GCM before handing them to a `StorageDriver`. The key never leaves
the browser's key store, so the ciphertext in local storage cannot be read elsewhere.

## kitr/secure-storage/drivers/electron

### createElectronDriver

```ts
function createElectronDriver(_options?: DriverOptions): Driver;
```

The secure-storage driver for the Electron shell. Values are encrypted in the main process with
`safeStorage` (Keychain on macOS, DPAPI on Windows, the desktop's secret service on Linux) and
the ciphertext is kept in `kitr-secure-storage.json` in `userData`, served over the `kitr:secure:*`
channels of `handleKitrIpc()`. The window never sees the key. Where the OS has no vault, main
refuses to store and `set()` rejects, so nothing is ever kept in the clear.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

## kitr/secure-storage/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(options?: TauriSecureStorageOptions): Driver;
```

The secure-storage driver for the Tauri shell, on `@tauri-apps/plugin-stronghold`: an encrypted
IOTA Stronghold snapshot in the app data dir, opened with a password that the Rust side keeps in
the OS keyring. The plugins are imported on first use and are optional peers; when one is
missing, every method rejects with `E_DRIVER_UNAVAILABLE`.

Stronghold rather than `plugin-store`: the store plugin writes plain JSON to disk, which is
storage, not a vault.

### TauriSecureStorageOptions

```ts
interface TauriSecureStorageOptions extends DriverOptions {
  /**
   * The vault password. Stronghold derives the snapshot key from it, so it must not be a constant
   * in the bundle. Default: the random secret the scaffolded Rust side keeps in the OS keyring,
   * read with `invoke('kitr_vault_key')`.
   */
  password?: () => Promise<string>;
  /** The snapshot file inside the app data dir. Default `kitr-vault.hold`. */
  file?: string;
  /** The Stronghold client name. Default `kitr`. */
  client?: string;
}
```

Options of the Tauri secure-storage driver, passed to `createTauriDriver()`.

## kitr/secure-storage/drivers/capacitor

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

Secure storage for the Capacitor shell on `@aparajita/capacitor-secure-storage`: the iOS Keychain
and, on Android, the Keystore with encrypted shared preferences. Values are strings and stay on
this device (`whenUnlockedThisDeviceOnly`: no iCloud sync, no migration to a new phone, readable
only while unlocked). Never falls back to `localStorage`.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
