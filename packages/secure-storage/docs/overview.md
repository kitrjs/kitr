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
