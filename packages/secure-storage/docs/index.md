---
title: Secure storage
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 1
---

# Secure storage

A session token, a refresh token, an API key someone pasted into settings: these shouldn't sit in `localStorage` as plain text. Phones and computers have a proper vault, each with a different API. `@kitr/secure-storage` gives you one async key-value service, `secureStorage`, and typed items on top of it.

> [!SUMMARY]
> Keeps login tokens and secrets in the phone or computer's secure vault instead of plain storage. Add it with `kitr add secure-storage`; the overview is at [/packages/secure-storage](/packages/secure-storage).

On a phone or desktop it uses the system vault: the iOS Keychain, the Android Keystore or Electron's [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage). In the browser it encrypts each value with a key the browser never lets out. A `secure` flag tells you which you got. It also runs on the server as an in-memory store. The examples follow Acme's app, where a session token goes in at sign-in and out at sign-out.

## When to use it

Use it for anything that grants access: session and refresh tokens, API keys. Reads are async, so components get `undefined` until the vault answers. Use [Storage](/packages/storage) for everything else; it is synchronous and renders on the server.

> [!WARNING] Not in Storage
> Don't put tokens in Storage: it writes plain text.

## Install

```sh
kitr add secure-storage
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/secure-storage` (which brings `@kitr/storage` as a dependency) and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/secure-storage/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/secure-storage.ts` (shown under [Configure](#configure)).
- Writes `app/secure.ts` with one typed item, `sessionItem` (shown under [Store your first secret](#store-your-first-secret)).
- Adds a `## kitr: secure-storage` section to `AGENTS.md`: tokens and secrets go through `@kitr/secure-storage` and `app/secure.ts`, never `defineStorage` or `localStorage`; `useSecureItem(item)` returns `[value, set, { loading, secure }]` and the value is `undefined` until the vault answers.

It adds no environment variables or scripts, asks no questions, and no kit includes it.

`kitr remove secure-storage` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/secure-storage.ts`. It leaves `app/secure.ts` and lists the files that still import `@kitr/secure-storage`. Stored values stay where they are.

</details>

To preview the changes:

```sh
kitr add secure-storage --dry-run
```

## Configure

`kitr add` writes this file:

```ts
// config/secure-storage.ts
import { defineConfig } from '@kitr/secure-storage'

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

The service picks `driver` from the config, else a driver a provider registered, else the one for the runtime: the browser fallback in a browser, a memory driver on the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set. A shell never silently stores secrets in webview storage. A stricter setup:

```ts
// config/secure-storage.ts
import { defineConfig } from '@kitr/secure-storage'

export default defineConfig({
  prefix: 'acme:secure:',
  requireSecure: import.meta.env.PROD,
})
```

## Store your first secret

`kitr add` writes one typed item. An item names a key and the type of what is stored under it:

```ts
// app/secure.ts
import { defineSecureItem } from '@kitr/secure-storage'

/** Secrets, typed once: `useSecureItem(sessionItem)` in components, `sessionItem(storage).get()` elsewhere. */
export const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')
```

Read and write it in a component with `useSecureItem`:

```tsx
// app/components/account/session-status.tsx
import { useSecureItem } from '@kitr/secure-storage/react'
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

After signing in and reloading, `localStorage` holds `kitr:secure:session` as an IV and ciphertext, not the token. **Sign out** removes it.

## Read and write a secret in a component

`useSecureItem(item)` returns a tuple:

| Position | Value |
| --- | --- |
| `[0]` | The stored value, or `undefined` while loading, when nothing is stored, and always on the server. |
| `[1]` | `set(value)`: stores `value`; `set(undefined)` removes it. Resolves when written. |
| `[2].loading` | `true` until the first read finishes. |
| `[2].secure` | `true` when an OS vault holds the value, `false` for the browser fallback and memory. |

> [!WARNING] Wait for loading
> Render nothing while `loading` is `true`; treating `undefined` as "signed out" flashes a sign-in screen on every reload.

> [!WARNING] Copies don't sync
> Each `useSecureItem` call hears only its own writes, so two components don't update each other. Read the session in one component near the top and pass it down, or use a React context.

To act after the write, await `set`:

```tsx
// app/components/account/sign-in-form.tsx
import { useSecureItem } from '@kitr/secure-storage/react'
import { useNavigate } from '@kitr/router'
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
import { defineSecureItem } from '@kitr/secure-storage'
import { z } from 'zod'

export const sessionItem = defineSecureItem('session', {
  schema: z.object({ token: z.string(), expiresAt: z.number() }),
})
```

The type comes from the schema. A stored value with an old shape or corrupted reads as `undefined`, so people sign in again instead of the app crashing; invalid JSON is removed the same way. Validation runs on reads only.

## Store values that aren't JSON

Items use JSON by default. Pass a `codec` for anything else, such as a `Date`:

```ts
// app/secure.ts
import { defineSecureItem } from '@kitr/secure-storage'

export const lastUnlockItem = defineSecureItem<Date>('last-unlock', {
  codec: {
    encode: (date) => String(date.getTime()),
    decode: (raw) => new Date(Number(raw)),
  },
})
```

A `decode` that throws counts as a corrupt value: it is removed and reads as `undefined`.

## Use secrets outside React

An item is a function that binds it to a `SecureStorage` service. Get the service with `useSecureStorage(app)`:

```ts
// app/lib/account/session.ts
import type { KitrApp } from 'kitr/app'
import { useSecureStorage } from '@kitr/secure-storage'
import { sessionItem } from '#app/secure'

export async function currentToken(app: KitrApp): Promise<string | null> {
  const storage = useSecureStorage(app) // same as app.container.use('secureStorage')
  const session = await sessionItem(storage).get()
  // => { token: 'tok_ada_7f3k', expiresAt: 1767229200000 }, or undefined
  if (!session || session.expiresAt < Date.now()) return null
  return session.token
}
```

A bound item has `key`, `get()`, `set(value)`, `remove()` and `subscribe(listener)`, which hears writes made through that bound item:

```ts
// app/lib/account/watch-session.ts
import type { SecureStorage } from '@kitr/secure-storage'
import { sessionItem } from '#app/secure'

export function watchSession(storage: SecureStorage, onSignOut: () => void) {
  const session = sessionItem(storage)
  const off = session.subscribe((value) => {
    if (value === undefined) onSignOut()
  })
  return { session, off }
}
```

In a component, `useSecureStorage()` from `@kitr/secure-storage/react` returns the same service.

## Use the key-value API

Under the items is an async key-value API of strings, for secrets you don't type ahead:

```ts
// app/lib/integrations/api-keys.ts
import type { SecureStorage } from '@kitr/secure-storage'

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

`clear()` removes everything this app stored under its prefix. Call it on sign-out, so the next person on a shared machine doesn't inherit the tokens:

```ts
// app/lib/account/sign-out.ts
import type { SecureStorage } from '@kitr/secure-storage'

export async function signOut(storage: SecureStorage) {
  await fetch('/api/auth/sign-out', { method: 'POST' })
  await storage.clear()
}
```

To remove one secret, use the item's `remove()` or `set(undefined)` from the hook.

## Refuse the browser fallback

Set `requireSecure: true` when a secret must never be stored outside an OS vault. With no vault, writes throw and nothing is stored:

```ts
// app/lib/account/remember-device.ts
import type { SecureStorage } from '@kitr/secure-storage'

export async function rememberDevice(storage: SecureStorage, deviceToken: string) {
  if (!storage.secure) return false
  await storage.set('device', deviceToken)
  return true
  // without the check, under requireSecure:
  // throws Error: @kitr/secure-storage: no secure vault on this platform (requireSecure is on)
}
```

Reads and removes still work. Check `storage.secure` before showing an option, rather than catching the error.

## How the browser fallback works

In the browser, each value is encrypted before it is stored. The fallback stops a copied `localStorage` dump or a casual look in DevTools.

> [!WARNING] Not protection against XSS
> Any script on your page can call `secureStorage.get('session')` and read the token. Keep untrusted scripts off pages that hold secrets, and prefer short-lived tokens. `secure` is `false` for this fallback, so you can tell.

Clearing site data deletes the key, so stored values then read as `null`; treat them as something the person may lose.

<details>
<summary>How the encryption works</summary>

- On first use the driver creates a 256-bit AES-GCM key with `extractable: false` and keeps it in IndexedDB. Script can use the key but cannot read its bytes.
- Every write uses a fresh 12-byte IV and stores `<iv>.<ciphertext>` in base64 in local storage.
- The storage key is authenticated with each value, so ciphertext copied to another key fails to decrypt.
- A value that fails to decrypt is removed and reads as `null`.

`createWebSecureStorageDriver(storage)` builds the fallback over any [Storage](/packages/storage) driver. Without Web Crypto, its first write rejects.

</details>

## Use it on the server

On the server the service is an in-memory store, so shared code runs without an environment check: reads resolve to `null` and items to `undefined`.

> [!WARNING] Shared across requests
> The server store is one map for the whole process. Never write a person's secret to it during a request; keep server secrets in environment variables and per-user tokens in your database or session.

## Where values are kept

<details>
<summary>Drivers for each runtime</summary>

| Where it runs | Driver | `secure` |
| --- | --- | --- |
| Browser | `createWebSecureStorageDriver()`: AES-GCM, ciphertext in local storage | `false` |
| Mobile shell (Capacitor) | `createCapacitorSecureStorageDriver()`: the iOS Keychain, the Android Keystore | `true` |
| A registered vault | Whatever the driver wraps, such as Electron `safeStorage` | `true` when the driver says so |
| Server | `createMemorySecureStorageDriver()`, in memory | `false` |
| Electron | `createElectronDriver()`: `safeStorage` in the main process, ciphertext in `userData` | `true` |
| Tauri | `createTauriDriver()`: a Stronghold snapshot, opened with a secret from the OS keyring | `true` |

### Capacitor

In the [Mobile](/packages/mobile) shell the service uses `@aparajita/capacitor-secure-storage`, which `kitr add secure-storage` installs when the project has the mobile platform. Values go to the iOS Keychain or the Android Keystore, `secure` is `true`, and nothing is written to `localStorage`.

```ts
// app/session.ts
import { createSecureStorage } from '@kitr/secure-storage'

const storage = createSecureStorage({ requireSecure: true })
await storage.set('refresh-token', 'rt_ada_91f')
await storage.get('refresh-token') // => 'rt_ada_91f'
console.log(storage.driver.name, storage.secure) // => capacitor-keychain true
```

- Secrets are readable only while the phone is unlocked, never leave the device and are not restored onto a new phone, so people sign in again after a restore.
- The iOS Keychain survives uninstalling the app; clear old secrets on first launch if that is wrong for you. On Android, uninstalling removes them.
- If the plugin is missing, every call rejects with `E_DRIVER_UNAVAILABLE`.

</details>

## Use it in Electron and Tauri

In a desktop shell the service picks the shell's vault by itself, so `secure` is `true` and `config/secure-storage.ts` does not change.

### Electron

The Electron driver encrypts in the main process with [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage): the macOS Keychain, Windows DPAPI or the Linux secret service. The ciphertext is one JSON file in the app's `userData` folder, and the window never sees the key. To keep the file somewhere else, pass `secureFile`:

```ts
// platforms/app/main.ts
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { handleKitrIpc } from '@kitr/desktop/main'

app.whenReady().then(() => {
  handleKitrIpc(ipcMain, app, { secureFile: join(app.getPath('userData'), 'acme-vault.json') })
})
```

> [!WARNING] Linux needs a secret service
> Without GNOME Keyring or KWallet, `safeStorage` falls back to a hard-coded password. kitr refuses: `set()` rejects and nothing is written.

<details>
<summary>Electron requirements</summary>

- `exposeIpc()` in the preload script. Without the `kitrIpc` bridge, creating the service throws `E_DRIVER_UNAVAILABLE`.
- The same account and machine: ciphertext copied elsewhere does not decrypt.

</details>

### Tauri

The Tauri driver uses [`@tauri-apps/plugin-stronghold`](https://v2.tauri.app/plugin/stronghold/), an encrypted file in the app data folder, with a random password kept in the system keyring. The first call is slower while the key is derived.

```ts
// app/providers/vault.ts
import { defineProvider } from 'kitr/app'
import { createTauriSecureStorageDriver } from '@kitr/secure-storage'

/** Supply your own password source, such as a prompt, instead of the keyring secret. */
export default defineProvider({
  name: 'vault',
  register(app) {
    app.drivers.register(
      'secure-storage',
      createTauriSecureStorageDriver({ password: async () => window.prompt('Vault passphrase') ?? '', file: 'acme.hold' }),
      { platform: 'tauri' },
    )
  },
})
```

> [!WARNING] Keep a strict CSP
> Every script in the window can call `kitr_vault_key`, as it can use the vault. Set a strict `csp` in `tauri.conf.json`.

<details>
<summary>Tauri requirements</summary>

- `@tauri-apps/plugin-stronghold` and `@tauri-apps/api` in `package.json`, which `kitr add tauri` and `kitr add secure-storage` install. When missing, every method rejects with `E_DRIVER_UNAVAILABLE`.
- The matching crates, the plugin and `kitr_vault_key` command registered in `lib.rs`, and `stronghold:default` in `capabilities/default.json`, which the Tauri scaffold writes.

</details>

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `E_DRIVER_UNAVAILABLE` (`KitrError`, `data.runtime`, `data.package`) | The app runs in Electron, Tauri or Capacitor and no secure-storage driver is registered. | Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/secure-storage.ts` to run the web driver inside the webview. |
| `@kitr/desktop: the operating system has no secret vault (safeStorage); secrets are not stored` | `set()` in Electron on a machine with no keychain, or on Linux with only the `basic_text` backend. | Install and unlock a secret service (GNOME Keyring or KWallet), then restart the app. Nothing was written. |
| `@kitr/secure-storage: no secure vault on this platform (requireSecure is on)` | `set()` under `requireSecure: true` with no vault. | Check `storage.secure` first, or register a vault driver. |
| `@kitr/secure-storage: Web Crypto is not available` | The browser fallback's first use, without `crypto.subtle` (a plain `http://` page other than `localhost`). | Serve the app over HTTPS. |
| `@kitr/secure-storage: could not store the encryption key` | IndexedDB refused the new key and holds none. | Rare; usually storage is full or blocked in a private window. |

A value that fails to decrypt, parse or validate is removed and reads as missing.

## Testing

`createMemorySecureStorageDriver(name)` keeps values in a `Map`. Its `secure` is `false`; spread it and set `secure: true` to test code that checks for a vault. Pass it through `config['secure-storage'].driver`:

```tsx
// app/components/account/session-status.test.tsx
import { fireEvent, screen } from '@testing-library/react'
import { createMemorySecureStorageDriver } from '@kitr/secure-storage'
import { secureStorageProvider } from '@kitr/secure-storage/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
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

For code that takes the service directly, `createSecureStorage({ driver: createMemorySecureStorageDriver() })` needs no app. To test the browser fallback, give `createWebSecureStorageDriver()` a memory [Storage](/packages/storage) driver and check the stored value holds no plain text.

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

The built-in Electron driver already covers Electron; this version shows the whole shape for a vault of your own. The main process encrypts with [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage) and writes a file; the renderer reaches it over the desktop IPC bridge:

```ts
// platforms/app/main.ts
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, ipcMain, safeStorage } from 'electron'
import { handleIpc } from '@kitr/desktop/main'

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
// app/providers/vault-provider.ts
import { defineProvider } from 'kitr/app'
import { createIpcClient } from '@kitr/desktop/client'
import type { SecureStorageDriver } from '@kitr/secure-storage'

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

Create the provider with `kitr make:provider vault`, which also lists it in `kitrrc.ts`. Inside the Electron app `secureStorage.secure` is now `true`; in the web build `ipc.available` is `false`, so the browser fallback still applies.

## Next steps

- [API reference](/packages/secure-storage/api): every export with its signature.
- [Storage](/packages/storage): synchronous items for values that aren't secret.
- [Auth](/packages/auth): sign-in, sessions and the token adapter.
