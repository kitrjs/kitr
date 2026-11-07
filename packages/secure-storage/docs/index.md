---
title: Secure storage
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 1
---

# Secure storage

`secureStorage` is one async key-value API over the platform vault: the iOS Keychain and Android Keystore through the mobile package, Electron's `safeStorage` or the Tauri stronghold on desktop, and on the web an AES-GCM fallback whose key never leaves the browser's key store. Code that stores a session token reads the same everywhere.

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
