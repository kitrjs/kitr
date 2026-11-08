---
title: Overview
description: Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.
order: 0
---

# Secure storage

A session token, a refresh token, an API key someone pasted into settings: these shouldn't sit in `localStorage` as plain text, where anything that reads the disk or the page can copy them. Phones and computers have a proper vault for secrets, and each has a different API. The browser has none.

`@kitr/secure-storage` gives you one async key-value service for secrets, backed by the platform's vault where there is one and by encryption where there is not.

## What it is

`@kitr/secure-storage` is an async `secureStorage` key-value service, plus typed items defined with `defineSecureItem` and read in components with `useSecureItem`. A `secure` flag on every read says whether the value came from a real vault or the browser fallback, and a config switch refuses the fallback for apps that must never store secrets in a browser. Signing out clears every item.

It runs in the browser, in desktop and mobile shells, and on the server as an in-memory store. For values that are not secret, such as a theme or a draft order, use [storage](/packages/storage): it is synchronous and renders on the server.

## Install

```sh
kitr add secure-storage
```

This installs `@kitr/secure-storage` (with [storage](/packages/storage) as a dependency), registers the provider in `kitrrc.ts`, writes `config/secure-storage.ts` and `app/secure.ts` with one typed item. The guide's [Install](/packages/secure-storage/guide#install) section lists every change.

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

Click **Sign in as Ada** and reload: the component shows "Signed in (browser storage)." In DevTools, `localStorage` holds `kitr:secure:session` with a value like `pV0q3m8nVJ2xY1aB.Zk9…`, which is the IV and the ciphertext, not the token. Register a vault driver for your shell and the same item lands in the Keychain or Keystore, with `secure` set to `true`. The guide continues from here: [Store your first secret](/packages/secure-storage/guide#store-your-first-secret).

## Built on

| Where | Built on |
| --- | --- |
| iOS and Android | The Keychain and the Keystore, through the [mobile](/packages/mobile) platform's driver. |
| Electron | [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage), through the [desktop](/packages/desktop) platform's driver. |
| Browser and anywhere without a vault | AES-GCM through the [Web Crypto API](https://developer.mozilla.org/docs/Web/API/SubtleCrypto), under a key the browser keeps in IndexedDB and never lets out. |

kitr adds the typed items with schema checks, the React hook, the `secure` flag, the switch that refuses the fallback, a memory driver for tests and the `SecureStorageDriver` interface.

## Problems it solves

- **Tokens in plain `localStorage`.** Items go to the vault, or encrypted storage, never plain text. See [Store your first secret](/packages/secure-storage/guide#store-your-first-secret).
- **Secrets with no shape.** Items are typed and validated on read. See [Validate what comes back](/packages/secure-storage/guide#validate-what-comes-back).
- **Not knowing how safe the storage is.** The `secure` flag says vault or fallback, so you can warn or refuse. See [Refuse the browser fallback](/packages/secure-storage/guide#refuse-the-browser-fallback).
- **Secrets left behind on sign-out.** Clear everything in one call. See [Clear secrets on sign-out](/packages/secure-storage/guide#clear-secrets-on-sign-out).
- **A different API on every platform.** The same code reads the Keychain, `safeStorage` and the browser fallback. See [Where values are kept](/packages/secure-storage/guide#where-values-are-kept).

## Further reading

- [Guide](/packages/secure-storage/guide): install, configure and every task.
- [API reference](/packages/secure-storage/api): every export and type.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) and [SubtleCrypto on MDN](https://developer.mozilla.org/docs/Web/API/SubtleCrypto): what each platform uses underneath.
- [Storage](/packages/storage) and [Auth](/packages/auth): non-secret values, and the sessions whose tokens live here.
