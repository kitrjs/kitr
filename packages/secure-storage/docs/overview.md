---
title: Overview
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 0
---

# Secure storage

## What it is

`@kitr/secure-storage` stores secrets such as tokens. Define an item with `defineSecureItem`, read it with `useSecureItem`. A `secure` flag says whether the value is in a real vault or the encrypted browser fallback, and a switch can refuse the fallback.

Runs in the browser and in native shells. For values that are not secret, use [storage](/packages/storage).

## Install

```sh
kitr add secure-storage
```

Adds `@kitr/secure-storage`, its provider, `config/secure-storage.ts` and `app/secure.ts` with one item. [Every change](/packages/secure-storage/guide#install).

## Quick start

An item names a key and the type of what is stored under it:

```ts
// app/secure.ts
import { defineSecureItem } from '@kitr/secure-storage'

export const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')
```

Read and write it in a component with `useSecureItem`:

```tsx
// app/features/account/session-status.tsx
import { useSecureItem } from '@kitr/secure-storage/react'
import { sessionItem } from '#app/secure'

export function SessionStatus() {
  const [session, setSession, { loading, secure }] = useSecureItem(sessionItem)
  if (loading) return null
  if (!session)
    return (
      <button type="button" onClick={() => setSession({ token: 'tok_ada_7f3k', expiresAt: Date.now() + 3_600_000 })}>
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

Click **Sign in as Ada** and reload: still signed in. `localStorage` holds ciphertext, not the token. With a vault driver, `secure` becomes `true`. Next in the guide: [Store your first secret](/packages/secure-storage/guide#store-your-first-secret).

## Built on

| Where | Built on |
| --- | --- |
| iOS and Android | The Keychain and the Keystore, through the [mobile](/packages/mobile) platform's driver. |
| Electron | [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage), through the [desktop](/packages/desktop) platform's driver. |
| Browser and anywhere without a vault | AES-GCM through the [Web Crypto API](https://developer.mozilla.org/docs/Web/API/SubtleCrypto), under a key the browser keeps in IndexedDB and never lets out. |

kitr adds typed items, schema checks, the hook, the `secure` flag, the fallback switch, a memory driver and the `SecureStorageDriver` interface.

## Problems it solves

- **Tokens in plain `localStorage`.** [Store your first secret](/packages/secure-storage/guide#store-your-first-secret).
- **Secrets with no shape.** [Validate what comes back](/packages/secure-storage/guide#validate-what-comes-back).
- **Not knowing how safe the storage is.** [Refuse the browser fallback](/packages/secure-storage/guide#refuse-the-browser-fallback).
- **Secrets left behind on sign-out.** [Clear secrets on sign-out](/packages/secure-storage/guide#clear-secrets-on-sign-out).
- **A different API on every platform.** [Where values are kept](/packages/secure-storage/guide#where-values-are-kept).

## Further reading

- [Guide](/packages/secure-storage/guide).
- [API reference](/packages/secure-storage/api).
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) and [SubtleCrypto on MDN](https://developer.mozilla.org/docs/Web/API/SubtleCrypto).
- [Storage](/packages/storage) and [Auth](/packages/auth).
