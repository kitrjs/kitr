---
title: Secure storage
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 1
---

# Secure storage

A session token, a refresh token, an API key someone pasted into settings: these shouldn't sit in `localStorage` as plain text, where anything that reads the disk or the page can copy them. Phones and computers have a proper vault for secrets, and each has a different API. `kitr/secure-storage` gives you one async key-value service, `secureStorage`, and typed items on top of it, so the code that keeps Ada's session reads the same wherever the app runs.

A platform registers its vault as a driver: the iOS Keychain, the Android Keystore or Electron's [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage). In the browser, and anywhere no vault is registered, a fallback encrypts each value with AES-GCM through the [Web Crypto API](https://developer.mozilla.org/docs/Web/API/SubtleCrypto), under a key the browser keeps in IndexedDB and never lets out. kitr adds typed items with schema checks, a React hook, a `secure` flag that says which one you got, a switch that refuses the fallback, and a memory driver for tests.

It runs in the browser, in desktop and mobile shells, and on the server as an in-memory store. For values that are not secret, such as a theme or a draft order, use [Storage](/packages/storage): it is synchronous and renders on the server.

This guide follows Acme's app at `app.acme.com`: Ada signs in, her session token goes into secure storage, and signing out clears it.

## When to use it

Use secure storage for anything that grants access: session and refresh tokens, API keys, a PIN-protected value. Reads are async, so components get `undefined` until the vault answers.

Use [Storage](/packages/storage) for everything else. Its items are synchronous, can be read during the first render and on the server through cookies, and are cheaper to read. Don't put tokens there: Storage writes plain text.

## Install

```sh
kitr add secure-storage
```

What `kitr add` does:

- Installs `@kitr/secure-storage` (which brings `@kitr/storage` as a dependency) and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/secure-storage/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/secure-storage.ts` (shown under [Configure](#configure)).
- Writes `app/secure.ts` with one typed item, `sessionItem` (shown under [Store your first secret](#store-your-first-secret)).
- Adds a `## kitr: secure-storage` section to `AGENTS.md`: tokens and secrets go through `kitr/secure-storage` and `app/secure.ts`, never `defineStorage` or `localStorage`; `useSecureItem(item)` returns `[value, set, { loading, secure }]` and the value is `undefined` until the vault answers.

It adds no environment variables or scripts. `kitr add secure-storage` asks no questions, and no kit includes it. To preview the changes:

```sh
kitr add secure-storage --dry-run
```

`kitr remove secure-storage` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/secure-storage.ts`. It leaves `app/secure.ts` because you may have added items to it, and lists the files that still import `kitr/secure-storage`. Values already stored stay in the vault or in local storage.

## Configure

`kitr add` writes this file:

```ts
// config/secure-storage.ts
import { defineConfig } from 'kitr/secure-storage'

export default defineConfig({
  // OS vault on mobile/desktop; AES-GCM in the browser. true refuses the browser fallback.
  requireSecure: false,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `requireSecure` | `false` | `true` makes every write throw when no vault is registered, instead of using the encrypted browser fallback. Reads and removes still work. |
| `prefix` | `'kitr:secure:'` | Put in front of every key, so `session` is stored as `kitr:secure:session`. Two apps on one origin need different prefixes. |
| `driver` | registered, else the driver for the runtime | A `SecureStorageDriver` that replaces the one the service would pick. For tests and custom vaults. |
| `fallbackToWeb` | `false` | In Electron, Tauri or Capacitor with no vault driver, use the encrypted browser fallback inside the webview instead of throwing `E_DRIVER_UNAVAILABLE`. `secure` stays `false`. |
| `storage` | the app's local storage driver | Where the browser fallback keeps its ciphertext. Any [Storage](/packages/storage) `StorageDriver`. |

The service picks its driver in this order: `driver` from the config, a driver a provider registered under `secure-storage`, then `selectDriver(runtime)`: the browser fallback in a browser, a memory driver on the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set. A shell never silently stores secrets in webview storage.

A stricter setup for a banking-grade desktop build:

```ts
// config/secure-storage.ts
import { defineConfig } from 'kitr/secure-storage'

export default defineConfig({
  prefix: 'acme:secure:',
  requireSecure: import.meta.env.PROD,
})
```

## Store your first secret

`kitr add` writes one typed item. An item names a key and the type of what is stored under it:

```ts
// app/secure.ts
import { defineSecureItem } from 'kitr/secure-storage'

/** Secrets, typed once: `useSecureItem(sessionItem)` in components, `sessionItem(storage).get()` elsewhere. */
export const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')
```

Read and write it in a component with `useSecureItem`:

```tsx
// app/features/account/session-status.tsx
import { useSecureItem } from 'kitr/secure-storage/react'
import { sessionItem } from '#app/secure'

export function SessionStatus() {
  const [session, setSession, { loading, secure }] = useSecureItem(sessionItem)
  if (loading) return null
  if (!session)
    return (
      <button
        type="button"
        onClick={() => setSession({ token: 'tok_ada_7f3k', expiresAt: Date.now() + 3_600_000 })}
      >
        Sign in as Ada
      </button>
    )
  return (
    <p>
      Signed in{secure ? '' : ' (browser storage)'}.{' '}
      <button type="button" onClick={() => setSession(undefined)}>
        Sign out
      </button>
    </p>
  )
}
```

Click **Sign in as Ada** and reload: the component renders nothing for a moment, then "Signed in (browser storage)." In DevTools, `localStorage` holds `kitr:secure:session` with a value like `pV0q3m8nVJ2xY1aB.Zk9…`, which is the IV and the ciphertext, not the token. **Sign out** removes it.

## Read and write a secret in a component

`useSecureItem(item)` returns a tuple:

| Position | Value |
| --- | --- |
| `[0]` | The stored value, or `undefined` while loading, when nothing is stored, and always on the server. |
| `[1]` | `set(value)`: stores `value`; `set(undefined)` removes it. Resolves when written. |
| `[2].loading` | `true` until the first read finishes. |
| `[2].secure` | `true` when an OS vault holds the value, `false` for the browser fallback and memory. |

Render nothing (or a skeleton) while `loading` is `true`. Don't treat `undefined` as "signed out" before then, or Ada sees a sign-in screen flash on every reload.

Each `useSecureItem` call binds its own copy of the item, and only that copy hears its writes. Two components that each call `useSecureItem(sessionItem)` don't update each other: when one signs out, the other keeps showing the old value until it remounts. Read the session in one component near the top and pass it down, or put it in a React context.

To act after the write, await `set`:

```tsx
// app/features/account/sign-in-form.tsx
import { useSecureItem } from 'kitr/secure-storage/react'
import { useNavigate } from 'kitr/router'
import { sessionItem } from '#app/secure'

export function SignInForm() {
  const [, setSession] = useSecureItem(sessionItem)
  const navigate = useNavigate()
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/auth/sign-in', { method: 'POST', body: form })
    const { token, expiresIn } = (await response.json()) as { token: string; expiresIn: number }
    await setSession({ token, expiresAt: Date.now() + expiresIn * 1000 })
    await navigate({ to: '/orders' })
  }
  return (
    <form onSubmit={onSubmit}>
      <input name="email" type="email" defaultValue="ada@acme.com" />
      <input name="password" type="password" />
      <button type="submit">Sign in</button>
    </form>
  )
}
```

## Validate what comes back

Pass a `schema` to check the stored value on every read. Any [Standard Schema](https://standardschema.dev) library works, such as Zod. A value that fails is removed and reads as `undefined`:

```ts
// app/secure.ts
import { defineSecureItem } from 'kitr/secure-storage'
import { z } from 'zod'

export const sessionItem = defineSecureItem('session', {
  schema: z.object({ token: z.string(), expiresAt: z.number() }),
})
```

The type comes from the schema, so no type argument is needed. When version 2 of the app stores `{ token, refreshToken, expiresAt }` and Grace still has the old shape, or a value was corrupted, she reads `undefined` and signs in again instead of the app crashing on a missing field. A value that isn't valid JSON is removed the same way, with or without a schema.

Validation runs on reads only. `set` stores whatever you pass, so TypeScript is what checks writes.

## Store values that aren't JSON

Items serialise with `JSON.stringify` and `JSON.parse` by default. Pass a `codec` for anything else, such as a `Date` that should come back as a `Date`:

```ts
// app/secure.ts
import { defineSecureItem } from 'kitr/secure-storage'

export const lastUnlockItem = defineSecureItem<Date>('last-unlock', {
  codec: {
    encode: (date) => String(date.getTime()),
    decode: (raw) => new Date(Number(raw)),
  },
})
```

`lastUnlockItem(storage).set(new Date())` stores `'1767225600000'`, and `get()` returns a `Date`. A `decode` that throws counts as a corrupt value: it is removed and reads as `undefined`.

## Use secrets outside React

An item is a function that binds it to a `SecureStorage` service. Get the service from the app's container, or with `useSecureStorage(app)` from `kitr/secure-storage`:

```ts
// app/features/account/session.ts
import type { KitrApp } from 'kitr/app'
import { useSecureStorage } from 'kitr/secure-storage'
import { sessionItem } from '#app/secure'

export async function currentToken(app: KitrApp): Promise<string | null> {
  const storage = useSecureStorage(app) // same as app.container.use('secureStorage')
  const session = await sessionItem(storage).get()
  // => { token: 'tok_ada_7f3k', expiresAt: 1767229200000 }, or undefined
  if (!session || session.expiresAt < Date.now()) return null
  return session.token
}
```

A bound item has `key`, `get()`, `set(value)`, `remove()` and `subscribe(listener)`. `subscribe` calls the listener with the new value (or `undefined` after `remove`) on writes made through that bound item, and returns an unsubscribe function:

```ts
// app/features/account/watch-session.ts
import type { SecureStorage } from 'kitr/secure-storage'
import { sessionItem } from '#app/secure'

export function watchSession(storage: SecureStorage, onSignOut: () => void) {
  const session = sessionItem(storage)
  const off = session.subscribe((value) => {
    if (value === undefined) onSignOut()
  })
  return { session, off }
}
```

Make writes through the returned `session` so the listener hears them. In a component, `useSecureStorage()` from `kitr/secure-storage/react` returns the same service.

## Use the key-value API

Under the items is a plain async key-value API of strings. Use it for secrets you don't type ahead, such as one API key per integration:

```ts
// app/features/integrations/api-keys.ts
import type { SecureStorage } from 'kitr/secure-storage'

export async function saveIntegrationKey(storage: SecureStorage, integration: string, key: string) {
  await storage.set(`integration:${integration}`, key)
}

export async function listIntegrations(storage: SecureStorage) {
  const keys = await storage.keys()
  // => ['session', 'integration:stripe', 'integration:github']
  return keys.filter((k) => k.startsWith('integration:')).map((k) => k.slice('integration:'.length))
}

export async function readIntegrationKey(storage: SecureStorage, integration: string) {
  return storage.get(`integration:${integration}`)
  // => 'sk_live_…', or null when not stored
}
```

| Method | Description |
| --- | --- |
| `get(key)` | Resolves to the string, or `null`. |
| `set(key, value)` | Stores a string. Throws under `requireSecure` without a vault. |
| `remove(key)` | Deletes it. |
| `keys()` | Keys under this service's prefix, without the prefix. When the driver can't list keys, the keys written since the app started. |
| `clear()` | Removes every key `keys()` returns. |

Keys are given without the prefix; the service adds it.

## Clear secrets on sign-out

`clear()` removes everything this app stored under its prefix and leaves other apps' entries alone. Call it when Ada signs out, so Linus doesn't inherit her tokens on a shared machine:

```ts
// app/features/account/sign-out.ts
import type { SecureStorage } from 'kitr/secure-storage'

export async function signOut(storage: SecureStorage) {
  await fetch('/api/auth/sign-out', { method: 'POST' })
  await storage.clear()
}
```

To remove one secret, use the item's `remove()` or `set(undefined)` from the hook.

## Refuse the browser fallback

Set `requireSecure: true` when a secret must never be stored outside an OS vault. With no vault registered, writes throw and nothing is stored:

```ts
// app/features/account/remember-device.ts
import type { SecureStorage } from 'kitr/secure-storage'

export async function rememberDevice(storage: SecureStorage, deviceToken: string) {
  if (!storage.secure) return false
  await storage.set('device', deviceToken)
  return true
  // without the check, under requireSecure:
  // throws Error: kitr/secure-storage: no secure vault on this platform (requireSecure is on)
}
```

Reads and removes still work, so a value written before you turned it on can be read once and deleted. Check `storage.secure` before showing a "Remember this device" option, rather than catching the error.

## How the browser fallback works

In the browser, and in a shell with no vault registered when you set `fallbackToWeb: true`, each value is encrypted before it is stored:

- On first use the driver creates a 256-bit AES-GCM key with `extractable: false` and keeps it in IndexedDB (`kitr-secure-storage`). Script can use the key but cannot read its bytes.
- Every write uses a fresh 12-byte IV and stores `<iv>.<ciphertext>` in base64 in local storage.
- The storage key is authenticated with each value, so ciphertext copied from `kitr:secure:refresh` to `kitr:secure:session` fails to decrypt.
- A value that fails to decrypt (tampered, moved, or written under another browser profile's key) is removed and reads as `null`.
- When two tabs start at once, both end up with the same key.

The key and the ciphertext live in the same browser profile, so the fallback stops a copied `localStorage` dump or a casual look in DevTools. It does not stop code running on your own page.

> **Warning**
> On the web, any script running on `app.acme.com` can call `secureStorage.get('session')` and read the token. The fallback is not protection against XSS. Keep untrusted scripts off pages that hold secrets, and prefer short-lived tokens. `secure` is `false` for this fallback, so you can tell.

Clearing site data deletes the key, and every stored value then reads as `null`. Treat secrets in the fallback as something the person may lose.

`createWebSecureStorageDriver(storage)` builds the fallback yourself, over any [Storage](/packages/storage) driver. Without Web Crypto, its first write rejects with `kitr/secure-storage: Web Crypto is not available`.

## Use it on the server

On the server the service is an in-memory store, so code shared with the client runs without an environment check: reads resolve to `null` and items to `undefined`.

> **Warning**
> The server store is one map for the whole process, shared by every request and lost on restart. Never write a person's secret to it during a request: the next request, from anyone, can read it. Keep server secrets in environment variables and per-user tokens in your database or session.

## Where values are kept

| Where it runs | Driver | `secure` |
| --- | --- | --- |
| Browser | `createWebSecureStorageDriver()`: AES-GCM, ciphertext in local storage | `false` |
| Mobile shell (Capacitor) | `createCapacitorSecureStorageDriver()`: the iOS Keychain, the Android Keystore | `true` |
| Desktop shells | A vault a provider registers, else `E_DRIVER_UNAVAILABLE`. With `fallbackToWeb: true`, the same fallback inside the webview, its ciphertext in the shell's storage driver when one is registered. | `false` for the fallback |
| A registered vault | Whatever the driver wraps, such as Electron `safeStorage` | `true` when the driver says so |
| Server | `createMemorySecureStorageDriver()`, in memory | `false` |

Today [Desktop](/packages/desktop) (Electron) and [Tauri](/packages/tauri) register only `platform` and `storage` drivers, not `secure-storage`. To keep secrets in Electron's `safeStorage` or the OS keyring, register a vault driver as shown under [Extend](#extend).

### Capacitor

In the [Mobile](/packages/mobile) shell the service uses `@aparajita/capacitor-secure-storage`, an optional peer dependency imported the first time a method runs. `kitr add secure-storage` installs it when the project has the mobile platform. Values go to the iOS Keychain and, on Android, to storage encrypted with a key in the Android Keystore. `secure` is `true`, so `requireSecure: true` is satisfied. Secrets are never written to `localStorage` or IndexedDB there.

```ts
// app/session.ts
import { createSecureStorage } from 'kitr/secure-storage'

const storage = createSecureStorage({ requireSecure: true })
await storage.set('refresh-token', 'rt_ada_91f')
await storage.get('refresh-token') // => 'rt_ada_91f'
console.log(storage.driver.name, storage.secure) // => capacitor-keychain true
```

- The driver turns off iCloud Keychain sync and sets `whenUnlockedThisDeviceOnly`: a secret is readable only while the phone is unlocked, never leaves the device and is not restored onto a new phone. People sign in again after a restore.
- The iOS Keychain survives uninstalling the app, so a reinstalled app can still read the old secrets. Clear them on first launch if that is wrong for your app.
- On Android, uninstalling the app removes its secrets.
- If the plugin is not installed, every call rejects with `E_DRIVER_UNAVAILABLE` and `install @aparajita/capacitor-secure-storage`. When the [Devtools](/packages/devtools) provider is installed, the service logs which driver is active at boot (for example `web-crypto (encrypted web fallback)`) and each key set or removed, never the values.

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `E_DRIVER_UNAVAILABLE` (`KitrError`, `data.runtime`, `data.package`) | The app runs in Electron, Tauri or Capacitor and no secure-storage driver is registered. | Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/secure-storage.ts` to run the web driver inside the webview. |
| `kitr/secure-storage: no secure vault on this platform (requireSecure is on)` | `set()` under `requireSecure: true` with no vault. | Check `storage.secure` first, or register a vault driver. |
| `kitr/secure-storage: Web Crypto is not available` | The browser fallback's first use, without `crypto.subtle` (a plain `http://` page other than `localhost`). | Serve the app over HTTPS. |
| `kitr/secure-storage: could not store the encryption key` | IndexedDB refused the new key and holds none. | Rare; usually storage is full or blocked in a private window. |

A value that fails to decrypt, parse or validate is not an error: it is removed and reads as missing.

## Testing

`createMemorySecureStorageDriver(name)` keeps values in a `Map`. Its `secure` is `false`; spread it and set `secure: true` to test code that checks for a vault. Pass it through `config['secure-storage'].driver`:

```tsx
// app/features/account/session-status.test.tsx
import { fireEvent, screen } from '@testing-library/react'
import { createMemorySecureStorageDriver } from 'kitr/secure-storage'
import { secureStorageProvider } from 'kitr/secure-storage/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { sessionItem } from '#app/secure'
import { SessionStatus } from './session-status'

async function setup(secure = false) {
  const driver = { ...createMemorySecureStorageDriver('vault'), secure }
  const app = await createTestApp({
    providers: [secureStorageProvider],
    config: { 'secure-storage': { driver } },
  })
  return { app, driver, storage: app.container.use('secureStorage') }
}

describe('session status', () => {
  it('stores the session under the prefixed key and clears it on sign-out', async () => {
    const { app, driver } = await setup()
    renderWithKitr(<SessionStatus />, { app })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as Ada' }))
    await screen.findByText(/Signed in \(browser storage\)/)
    expect(JSON.parse((await driver.get('kitr:secure:session'))!)).toMatchObject({
      token: 'tok_ada_7f3k',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Sign in as Ada' })
    expect(await driver.get('kitr:secure:session')).toBeNull()
  })

  it('reads an existing session from the vault', async () => {
    const { app, storage } = await setup(true)
    await sessionItem(storage).set({ token: 'tok_grace_2m9q', expiresAt: Date.now() + 60_000 })
    renderWithKitr(<SessionStatus />, { app })
    await screen.findByText('Signed in.')
  })

  it('refuses to write without a vault under requireSecure', async () => {
    const app = await createTestApp({
      providers: [secureStorageProvider],
      config: {
        'secure-storage': { driver: createMemorySecureStorageDriver(), requireSecure: true },
      },
    })
    const storage = app.container.use('secureStorage')
    await expect(storage.set('session', 'tok_ada_7f3k')).rejects.toThrow(/requireSecure is on/)
  })
})
```

For code that takes the service directly, `createSecureStorage({ driver: createMemorySecureStorageDriver() })` needs no app. To test the browser fallback itself, give `createWebSecureStorageDriver()` a memory [Storage](/packages/storage) driver and check the stored value holds no plain text; Node 20 and later have Web Crypto, and without IndexedDB the key lives in memory.

## Extend

A vault implements `SecureStorageDriver`. Keys arrive with the prefix already added:

```ts
interface SecureStorageDriver {
  name: string
  secure: boolean // true when an OS vault or hardware holds the values
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  keys?(): Promise<string[]> // optional: without it, keys() lists what was written this session
}
```

This driver keeps secrets in Electron's [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage), which encrypts with the macOS Keychain, Windows DPAPI or the Linux secret store. The main process encrypts and writes a file in the app's data folder; the renderer reaches it over the IPC bridge the desktop platform sets up:

```ts
// platforms/app/main.ts
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, ipcMain, safeStorage } from 'electron'
import { handleIpc } from 'kitr/desktop/main'

const vaultFile = () => join(app.getPath('userData'), 'vault.json')
const load = async (): Promise<Record<string, string>> =>
  JSON.parse(await readFile(vaultFile(), 'utf8').catch(() => '{}'))
const save = (data: Record<string, string>) => writeFile(vaultFile(), JSON.stringify(data))

handleIpc<{
  'vault.get': (key: string) => string | null
  'vault.set': (key: string, value: string) => void
  'vault.remove': (key: string) => void
  'vault.keys': () => string[]
}>(ipcMain, {
  'vault.get': async (_event, key) => {
    const sealed = (await load())[key]
    return sealed ? safeStorage.decryptString(Buffer.from(sealed, 'base64')) : null
  },
  'vault.set': async (_event, key, value) => {
    const data = await load()
    data[key] = safeStorage.encryptString(value).toString('base64')
    await save(data)
  },
  'vault.remove': async (_event, key) => {
    const data = await load()
    delete data[key]
    await save(data)
  },
  'vault.keys': async () => Object.keys(await load()),
})
// ...
```

```ts
// app/providers/vault_provider.ts
import { defineProvider } from 'kitr/app'
import { createIpcClient } from 'kitr/desktop/client'
import type { SecureStorageDriver } from 'kitr/secure-storage'

const ipc = createIpcClient<{
  'vault.get': (key: string) => string | null
  'vault.set': (key: string, value: string) => void
  'vault.remove': (key: string) => void
  'vault.keys': () => string[]
}>()

function electronVault(): SecureStorageDriver {
  return {
    name: 'electron-safe-storage',
    secure: true,
    get: (key) => ipc.invoke('vault.get', key),
    set: (key, value) => ipc.invoke('vault.set', key, value),
    remove: (key) => ipc.invoke('vault.remove', key),
    keys: () => ipc.invoke('vault.keys'),
  }
}

export default defineProvider({
  name: 'vault',
  register(app) {
    if (ipc.available) app.drivers.register('secure-storage', electronVault(), { platform: 'desktop' })
  },
})
```

Create the provider with `kitr make:provider vault` and add `() => import('#app/providers/vault_provider')` to `providers` in `kitrrc.ts`. Inside the Electron app, `secureStorage.secure` is now `true`, the session status drops "(browser storage)", and `requireSecure: true` lets writes through. In the web build `ipc.available` is `false`, so the browser fallback still applies.

On Linux without a secret store, `safeStorage` falls back to a hard-coded password; check `safeStorage.getSelectedStorageBackend()` in main if that matters to you. In a [Tauri](/packages/tauri) app the same driver shape fits over a keyring plugin through Tauri commands. The `SecureStorageDriver` and `SecureItem` types are in the [API reference](/packages/secure-storage/api).

## Next steps

- [API reference](/packages/secure-storage/api)
- [Storage](/packages/storage): synchronous items for values that aren't secret, and the driver the fallback writes to.
- [Auth](/packages/auth): sign-in, sessions and the token adapter.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): what each operating system uses underneath.
- [SubtleCrypto on MDN](https://developer.mozilla.org/docs/Web/API/SubtleCrypto): the Web Crypto API behind the browser fallback.
