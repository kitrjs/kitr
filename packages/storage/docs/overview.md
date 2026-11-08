---
title: Overview
description: Save small values in the browser or in cookies with types, and read the same cookies on the server.
order: 0
---

# Storage

Every app remembers a few things between visits: a collapsed sidebar, the last orders someone searched for, the language they picked. `localStorage` and `document.cookie` are right there, and they are where the bugs live: `JSON.parse` on a value from last year's release, a hydration mismatch because the server could not read it, two tabs disagreeing, a browser that blocks storage entirely.

`@kitr/storage` lets you declare each value once, with a type and a default, and read and write it anywhere without touching the raw APIs.

## What it is

`@kitr/storage` has two halves. Storage items, defined with `defineStorage` and read with `useStorage`, live in local or session storage in the browser and move to a native store on desktop and mobile. Cookies, defined with `defineCookie` and read with `useCookie`, work in the browser and on the server, where `cookies()` reads and sets them during a request. Both are typed, validated with a schema if you want, versioned with migrations, and fall back to the default when the stored value is missing, old or invalid.

Storage items run in the browser; cookies run on both sides. For a value every request on the server shares, use [cache](/packages/cache). Don't use it for login tokens or other secrets: anything in Web Storage is readable by every script on the page. Use [secure storage](/packages/secure-storage) for those.

## Built on

`@kitr/storage` is built on [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), through a `StorageDriver` so the [desktop](/packages/desktop), [tauri](/packages/tauri) and [mobile](/packages/mobile) platforms can swap in the operating system's store. kitr adds types, schema validation, versions with migrations, expiry, cross-tab sync, hydration-safe React hooks that never mismatch the server, the server-side cookie API with `httpOnly` support, and memory drivers for tests.

## Problems it solves

- **Parsing and defaulting by hand.** An item has a type and a default; bad or missing values fall back to it. See [Save your first value](/packages/storage/guide#save-your-first-value).
- **Old values after a release.** Versions and a migrate function. See [Change a value's shape with versions](/packages/storage/guide#change-a-values-shape-with-versions).
- **Tabs that disagree.** Changes in one tab reach the others. See [Keep tabs in sync](/packages/storage/guide#keep-tabs-in-sync).
- **Hydration mismatches.** Hooks render the default on the server and the stored value after mount, on purpose. See [Render on the server without a hydration mismatch](/packages/storage/guide#render-on-the-server-without-a-hydration-mismatch).
- **Cookies read differently on each side.** The same `defineCookie` works in components and in controllers. See [Read and set cookies on the server](/packages/storage/guide#read-and-set-cookies-on-the-server).
- **Blocked or full storage.** Private mode and quota errors are handled, not thrown. See [Handle missing, invalid and blocked storage](/packages/storage/guide#handle-missing-invalid-and-blocked-storage).

## Further reading

- [Guide](/packages/storage/guide): install, configure and every task.
- [API reference](/packages/storage/api): every export and type.
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) on MDN.
- [Secure storage](/packages/secure-storage), [Offline](/packages/offline) and the platforms ([Desktop](/packages/desktop), [Mobile](/packages/mobile)): secrets, query snapshots, and the native drivers.
