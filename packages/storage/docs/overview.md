---
title: Overview
description: Save small values in the browser or in cookies with types, and read the same cookies on the server.
order: 0
---

# Storage

## What it is

`@kitr/storage` stores small values the device owns: preferences, drafts, recent searches. `defineStorage` and `useStorage` cover local and session storage; `defineCookie` and `useCookie` cover cookies on both sides. Everything is typed, versioned and falls back to its default.

Storage items run in the browser and native shells; cookies run on both sides. For secrets, use [secure storage](/packages/secure-storage).

## Install

```sh
kitr add storage
```

Adds `@kitr/storage`, its provider, `config/storage.ts` and `app/storage.ts` with the locale cookie. [Every change](/packages/storage/guide#install).

## Quick start

Declare each value once in `app/storage.ts`, with its default:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })
```

Then read and write it like `useState`:

```tsx
// app/components/sidebar-toggle.tsx
import { useStorage } from '@kitr/storage/react'
import { sidebar } from '#app/storage'

export function SidebarToggle() {
  const [state, setState] = useStorage(sidebar)
  return (
    <button type="button" onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>
      {state.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    </button>
  )
}
```

Put `<SidebarToggle />` in your layout and click it. The label changes to "Expand sidebar". Reload the page: it still says "Expand sidebar". Under Application → Local Storage in the browser's devtools you see one key:

```text
acme:sidebar    {"v":1,"d":{"collapsed":true}}
```

`v` is the version and `d` the data; you never read the envelope yourself. In native shells the same item lands in the OS store. Next in the guide: [Save your first value](/packages/storage/guide#save-your-first-value).

## Built on

kitr adds types, schema validation, versions with migrations, expiry, cross-tab sync, hydration-safe hooks, the server cookie API and memory drivers.

## Problems it solves

- **Parsing and defaulting by hand.** [Save your first value](/packages/storage/guide#save-your-first-value).
- **Old values after a release.** [Change a value's shape with versions](/packages/storage/guide#change-a-values-shape-with-versions).
- **Tabs that disagree.** [Keep tabs in sync](/packages/storage/guide#keep-tabs-in-sync).
- **Hydration mismatches.** [Render on the server without a hydration mismatch](/packages/storage/guide#render-on-the-server-without-a-hydration-mismatch).
- **Cookies read differently on each side.** [Read and set cookies on the server](/packages/storage/guide#read-and-set-cookies-on-the-server).
- **Blocked or full storage.** [Handle missing, invalid and blocked storage](/packages/storage/guide#handle-missing-invalid-and-blocked-storage).

## Further reading

- [Guide](/packages/storage/guide).
- [API reference](/packages/storage/api).
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) on MDN.
- [Secure storage](/packages/secure-storage), [Offline](/packages/offline) and the platforms ([Desktop](/packages/desktop), [Mobile](/packages/mobile)).
