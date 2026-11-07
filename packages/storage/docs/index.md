---
title: Storage
description: Save small values in the browser or in cookies with types, and read the same cookies on the server.
order: 1
---

# Storage

Every app saves a few things on the device: a collapsed sidebar, recent searches, a chosen language. Reading `localStorage` directly means parsing JSON by hand, guarding against bad values, breaking server rendering and forgetting to update other tabs. `kitr/storage` lets you declare each value once, with a type and a default, and then read it anywhere.

## Install

```sh
kitr add storage
```

The desktop and mobile [platforms](/docs/platforms) add it for you, and save values in the native store instead of the browser. It writes `config/storage.ts` and `app/storage.ts`.

## Declare values

```ts
// app/storage.ts
import { defineCookie, defineStorage } from 'kitr/storage'
import { z } from 'zod'

export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })

export const recentSearches = defineStorage<string[]>('recent-searches', {
  default: [],
  area: 'session',
  schema: z.array(z.string()).max(10),
})

export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
```

| Option | Description |
| --- | --- |
| `default` | Returned when nothing is saved, when the saved value is invalid, and on the server. |
| `area` | `local` (the default) keeps it until cleared. `session` keeps it for this tab. |
| `schema` | A zod or valibot schema. A saved value that fails it is ignored. |
| `version`, `migrate` | Bump `version` when the shape changes. `migrate(old, fromVersion)` converts old values; without it they are dropped. |
| `ttl` | Milliseconds before a saved value expires. |

## Use them in components

```tsx
import { useStorage } from 'kitr/storage/react'
import { sidebar } from '#app/storage'

function SidebarToggle() {
  const [state, setState] = useStorage(sidebar)
  return (
    <button onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>
      {state.collapsed ? 'Expand' : 'Collapse'}
    </button>
  )
}
```

The server and the first browser render both see the default, so hydration never mismatches. Changes in another tab update the component too.

Outside React, call `sidebar.get()`, `sidebar.set(value)` and `sidebar.remove()`.

## Cookies on the client and the server

A cookie is the one value both sides can read, which makes it the right home for anything the server needs to render the first page, like the visitor's language.

```tsx
// In a component
import { useCookie } from 'kitr/storage/react'
const [locale, setLocale] = useCookie(localeCookie)
```

```ts
// In a controller
import { cookies } from 'kitr/storage/server'

const jar = cookies(ctx.event)
const locale = jar.get(localeCookie)
jar.set(localeCookie, 'de', { httpOnly: false })
```

To have `useCookie` render the right value during server rendering, wrap the root route in `<CookieHeader value={request.headers.get('cookie')}>`.

`config/storage.ts` sets a `prefix` for every key and cookie name, so several apps on one domain never collide, plus default cookie options such as `sameSite` and `secure`.

## Server-side values

`defineKv` keeps a value for the whole server: a banner, a feature switch, a cached lookup.

```ts
import { defineKv } from 'kitr/storage'

export const banner = defineKv('banner', { default: { text: '' } })
await banner.set({ text: 'Maintenance at 22:00' }, { ttl: 6 * 60 * 60 * 1000 })
```

It lives in memory until you set a `kv` driver in `config/storage.ts`. A driver is any object with `get`, `set` and `remove`, so Redis, Cloudflare KV or a file all work.
