---
title: Storage
description: Save small values in the browser or in cookies with types, and read the same cookies on the server.
order: 1
---

# Storage

Typed items over local storage, session storage and cookies. Each item has a default, an optional schema, a version with a migration and a TTL, so a stale or corrupt value becomes the default instead of a crash. Cookies have one definition for both sides: `useCookie(item)` in a component, `cookies(event).get(item)` on the server.

## Install

```sh
kitr add storage
```

`config/storage.ts` sets a key prefix and cookie defaults. On desktop and mobile the platform packages register a native driver, so the same items live in the OS store.

## Items

```ts
// app/storage.ts
import { defineCookie, defineStorage } from 'kitr/storage'
import { z } from 'zod'

export const sidebar = defineStorage('sidebar', {
  default: { collapsed: false },
  schema: z.object({ collapsed: z.boolean() }),
  version: 2,
  migrate: (raw) => ({ collapsed: Boolean((raw as { closed?: boolean }).closed) }),
})

export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
```

```tsx
import { useCookie, useStorage } from 'kitr/storage/react'

function Sidebar() {
  const [state, setState] = useStorage(sidebar)
  const [locale, setLocale] = useCookie(localeCookie)
  return <button onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>{locale}</button>
}
```

Hooks are hydration-safe: the server and the first render see the default. Outside React, `sidebar.get()`, `.set()`, `.subscribe()`.

## On the server

```ts
import { cookies } from 'kitr/storage/server'

const jar = cookies(event)
const locale = jar.get(localeCookie)
jar.set(localeCookie, 'fr')
```

`defineKv` gives server code a key-value store with the same shape (in-memory by default, a `KvDriver` for Redis).

## Secrets

Tokens do not belong here. Use [Secure storage](/packages/secure-storage), which encrypts on the web and uses the OS vault on devices.
