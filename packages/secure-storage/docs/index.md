---
title: Secure storage
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 1
---

# Secure storage

Session tokens and API keys shouldn't sit in `localStorage`, where any script on the page can read them. Each platform has a proper vault, and each one has a different API. `secureStorage` is one async key-value API over all of them: the iOS Keychain and Android Keystore through the mobile package, Electron's `safeStorage` or the Tauri stronghold on desktop, and on the web an AES-GCM fallback whose key never leaves the browser's key store. Code that stores a session token reads the same everywhere.

## Install

```sh
kitr add secure-storage
```

```ts
// config/secure-storage.ts
import { defineConfig } from 'kitr/secure-storage'

export default defineConfig({
  prefix: 'myapp:',
  requireSecure: false, // true: throw instead of using the web fallback
})
```

## Typed items

```ts
// app/lib/session.ts
import { defineSecureItem } from 'kitr/secure-storage'
import { z } from 'zod'

export const sessionItem = defineSecureItem('session', {
  schema: z.object({ token: z.string(), expiresAt: z.number() }),
})
```

```tsx
import { useSecureItem } from 'kitr/secure-storage/react'

function Account() {
  const [session, setSession, { loading, secure }] = useSecureItem(sessionItem)
  if (loading) return null
  if (!session) return <SignIn onDone={(s) => setSession(s)} />
  return <p>Signed in{secure ? '' : ' (browser storage)'} · <button onClick={() => setSession(undefined)}>Sign out</button></p>
}
```

Outside React: `app.container.use('secureStorage').get('session')` or `sessionItem(storage).get()`. Values that fail the schema are removed, so a stale shape after an upgrade falls back to signed out rather than crashing.

## Drivers

Platform packages register the vault under the `secure-storage` capability; `secureStorage.secure` says whether one is active. On the server the service is an in-memory store, so shared code needs no environment check.

## Where values are kept

| Where it runs | Driver |
| --- | --- |
| iOS, Android | The Keychain and the Keystore, through the [mobile](/packages/mobile) package |
| Desktop | Electron's `safeStorage` or the Tauri stronghold, through the [desktop](/packages/desktop) package |
| Browser | AES-GCM encrypted in local storage, with a key the browser keeps non-exportable. `secure` is `false`. |
| Server | In memory, so shared code runs unchanged |

The browser fallback stops a casual look at local storage. It can't stop code running on your own page, so a web app that stores tokens should still keep its pages free of untrusted scripts. Set `requireSecure: true` to refuse the fallback altogether.

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `kitr:secure:` | Prefix for every key. |
| `requireSecure` | `false` | Throw instead of using the browser fallback. |
| `driver` | the platform's vault | Replace the vault, for tests or custom hardware. |
| `storage` | the app's local storage | Where the browser fallback keeps its ciphertext. |

## Tests

```ts
import { createMemorySecureStorageDriver, createSecureStorage } from 'kitr/secure-storage'

const storage = createSecureStorage({ driver: createMemorySecureStorageDriver() })
```
