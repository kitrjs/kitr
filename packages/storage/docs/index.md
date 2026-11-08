---
title: Storage
description: Save small values in the browser or in cookies with types, and read the same cookies on the server.
order: 1
---

# Storage

Every app remembers a few things between visits: a collapsed sidebar, recent searches, the chosen language. `@kitr/storage` declares each value once, with a type and a default, and reads and writes it anywhere without touching `localStorage` or `document.cookie`. Bad, old or missing values fall back to the default, other tabs stay in sync, and server rendering never breaks.

> [!SUMMARY]
> Typed, validated values saved in the browser or in cookies, readable on the server too. Add it with `kitr add storage`; the overview is at [/packages/storage](/packages/storage).

It builds on [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies). Storage items run in the browser; cookies run on both sides.

> [!WARNING] Not for secrets
> Anything in Web Storage is readable by every script on the page. Use [Secure storage](/packages/secure-storage) for login tokens and other secrets.

This guide follows Acme's order dashboard at `app.acme.com`: Ada collapses the sidebar, searches for orders, and switches the language to German.

## When to use it

Use storage for **small values the user's device owns**: preferences, recent searches, a dismissed notice, a draft. They survive a reload, are read synchronously, and are not shared with other devices.

For values that live only while the page is open, use [State](/packages/state). For data the server owns, such as the orders themselves, use [Query](/packages/query), or [Offline](/packages/offline) to keep it on the device. For a value every server request shares, use [cache](/packages/cache).

## Install

```sh
kitr add storage
```

<details>
<summary>Everything kitr add changes</summary>

- Installs `@kitr/storage` and adds its provider and package to `kitrrc.ts`.
- Writes `config/storage.ts` (see [Configure](#configure)).
- Writes `app/storage.ts` with three sample values: `sidebar`, `recentSearches` and `localeCookie`. A server-only project gets only `localeCookie`.
- Adds a `## kitr: storage` section to `AGENTS.md`.

It asks no questions and adds no environment variables or scripts. It does not overwrite `config/storage.ts` or `app/storage.ts` when they exist.

The `app`, `fullstack`, `saas`, `site`, `realtime`, `desktop` and `mobile` kits include it, and the [Desktop](/packages/desktop), [Tauri](/packages/tauri) and [Mobile](/packages/mobile) platforms require it.

`kitr remove storage` reverses all of it and deletes `config/storage.ts`. It leaves `app/storage.ts`, because you have probably edited it, and lists the files that still import `@kitr/storage`.

</details>

The generated `app/storage.ts` in a project with React:

```ts
// app/storage.ts
import { defineCookie, defineStorage } from '@kitr/storage'

/**
 * Every persisted value, in one file, typed. Components read them with
 * `useStorage(item)` / `useCookie(item)` from @kitr/storage/react; plain code with `item.get()`.
 */
export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })

export const recentSearches = defineStorage<string[]>('recent-searches', {
  default: [],
  area: 'session',
  version: 1,
})

/** Readable on the server too (`localeCookie.get(request.headers)`), so SSR picks the right locale. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
```


## Configure

`kitr add storage` writes this file. The prefix comes from the `name` in your `package.json`, without its scope:

```ts
// config/storage.ts
import { defineConfig } from '@kitr/storage'

export default defineConfig({
  // Prefixes every storage key and cookie name so several apps on one origin never collide.
  prefix: 'acme:',
  cookie: { path: '/', sameSite: 'lax', secure: import.meta.env?.PROD ?? false },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `''` | Added in front of every storage key and cookie name. `sidebar` is stored as `acme:sidebar`. |
| `cookie` | `{}` | Attributes merged into every cookie this app writes. An item's own options and the options passed to `set()` win over these. |
| `cookie.path` | `'/'` | The URL path a cookie is sent for. |
| `cookie.domain` | none | The domain a cookie is sent to. `.acme.com` shares it with every subdomain. |
| `cookie.maxAge` | none | Lifetime in seconds. Without `maxAge` or `expires`, a cookie lasts until the browser closes. |
| `cookie.expires` | none | An absolute expiry `Date`. |
| `cookie.secure` | `false` | Send only over HTTPS. Always on when `sameSite` is `'none'`. |
| `cookie.httpOnly` | `false` | Hide the cookie from browser scripts. Only cookies set by the server can be `httpOnly`. |
| `cookie.sameSite` | `'lax'` | `'lax'`, `'strict'` or `'none'`. |

`import.meta.env?.PROD` is Vite's production flag, so cookies are `Secure` in production builds and work over plain `http://localhost` in development.

> [!WARNING] Changing the prefix
> Changing `prefix` in a live app makes every saved value look missing, because the keys change. Users see the defaults again; nothing is migrated.

## Save your first value

Read and write a value from a component with `useStorage`. It returns the value, a setter and a remover, like `useState`:

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

Put `<SidebarToggle />` in your layout and click it. The label changes to "Expand sidebar". Reload the page: it still says "Expand sidebar". In the browser's devtools, under Application → Local Storage, you see one key:

```text
acme:sidebar    {"v":1,"d":{"collapsed":true}}
```

Each item is saved as a small envelope: `v` is the version, `d` the data, and `e` the expiry when the item has a `ttl`. `get()` unwraps it. The setter takes a value or a function of the current value; `remove` deletes the key so the item reads its default again.

## Read and write outside React

Every item has the same three methods outside components, so services, route loaders and event handlers use the same declaration:

```ts
// app/lib/orders/search.ts
import { recentSearches } from '#app/storage'

export function rememberSearch(term: string) {
  recentSearches.set((current) => [term, ...current.filter((t) => t !== term)].slice(0, 5))
}

rememberSearch('INV-1042')
rememberSearch('Grace')
recentSearches.get() // => ['Grace', 'INV-1042']
recentSearches.remove()
recentSearches.get() // => []
```

`get()` is synchronous and returns the same object for the same stored string, so it is cheap in a render or a loop. `set()` notifies subscribers in this tab at once and other tabs through the browser's `storage` event.

Without React, subscribe. The call returns an unsubscribe function:

```ts
// app/lib/layout/body-class.ts
import { sidebar } from '#app/storage'

const stop = sidebar.subscribe((value) => {
  document.body.classList.toggle('sidebar-collapsed', value.collapsed)
})

// later, when the layout unmounts
stop()
```

## Choose local or session storage

`area` picks where the value lives. `local` (the default) keeps it until cleared. `session` keeps it for the current tab only.

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

// Survives restarts: a preference.
export const ordersPageSize = defineStorage('orders-page-size', { default: 25 })

// Forgotten when the tab closes: the search history of this session.
export const recentSearches = defineStorage<string[]>('recent-searches', {
  default: [],
  area: 'session',
  version: 1,
})
```

On desktop and mobile, `session` items live in memory and are gone when the app restarts, like a closed tab.

## Validate stored values with a schema

Anything in storage can be edited by the user, an old app version or an extension. Pass a [Standard Schema](https://standardschema.dev) such as [zod](https://zod.dev) or [valibot](https://valibot.dev) and every read is checked. A value that fails reads as the default:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'
import { z } from 'zod'

const orderFilters = z.object({
  status: z.enum(['open', 'paid', 'shipped']).nullable(),
  customer: z.string().max(80),
})

export const savedFilters = defineStorage('order-filters', {
  default: { status: null, customer: '' } as z.infer<typeof orderFilters>,
  schema: orderFilters,
})
```

```ts
// What happens with a tampered value
localStorage.setItem('acme:order-filters', '{"v":1,"d":{"status":"lost","customer":"Ada"}}')
savedFilters.get() // => { status: null, customer: '' }
```

The schema runs on reads, not writes, and must be synchronous: an async schema makes every read return the default.

## Change a value's shape with versions

When a stored value changes shape, old browsers still hold the old one. Bump `version` and give `migrate` a function that receives the old data and its saved version:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

// Version 1 stored { collapsed: boolean }. Version 2 also remembers the width.
export const sidebar = defineStorage('sidebar', {
  default: { collapsed: false, width: 280 },
  version: 2,
  migrate: (old, fromVersion) => {
    if (fromVersion === 1) return { ...(old as { collapsed: boolean }), width: 280 }
    return { collapsed: false, width: 280 }
  },
})
```

```ts
// Ada's browser still holds a version 1 value
localStorage.getItem('acme:sidebar') // => '{"v":1,"d":{"collapsed":true}}'
sidebar.get() // => { collapsed: true, width: 280 }
```

The migrated value is returned but not written back until the next `set()`. If `migrate` throws or is missing, a value with another version reads as the default. When both `migrate` and `schema` are set, the schema checks the migrated value.

> [!WARNING] Bump the version
> Don't change the shape of `default` without bumping `version`, or old values are read as the new type and `sidebar.get().width` is `undefined`.

## Expire a value after a time

`ttl` keeps a value for that many milliseconds after each `set()`, then treats it as missing. Use it for things that go stale, such as a dismissed notice that should return next week:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

const sevenDays = 7 * 24 * 60 * 60 * 1000

export const invoiceTipDismissed = defineStorage('invoice-tip-dismissed', {
  default: false,
  ttl: sevenDays,
})
```

```ts
invoiceTipDismissed.set(true)
localStorage.getItem('acme:invoice-tip-dismissed')
// => '{"v":1,"d":true,"e":1731542400000}'
invoiceTipDismissed.get() // => true, until seven days from now; then false
```

Every `set()` starts a new period. An expired value stays in storage until the next `set()` or `remove()`, but is never returned.

## Keep tabs in sync

When Ada collapses the sidebar in one tab, every other tab of `app.acme.com` updates too. `useStorage` listens to the browser's [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), so every `local` item syncs with no code from you.

```tsx
// app/components/sidebar.tsx
import { useStorage } from '@kitr/storage/react'
import type { ReactNode } from 'react'
import { sidebar } from '#app/storage'

export function Sidebar({ children }: { children: ReactNode }) {
  const [{ collapsed }] = useStorage(sidebar)
  return <aside className={collapsed ? 'w-14' : 'w-72'}>{children}</aside>
}
```

`session` items don't sync, because each tab has its own session storage. Native drivers have one window, so there is nothing to sync.

## Render on the server without a hydration mismatch

On the server there is no `localStorage`: `get()` returns the default and `set()` does nothing, so the same module imports safely on both sides. `useStorage` renders the default on the server **and** on the first browser render, then switches to the stored value after hydration:

```ts
// app/routes.ts
r.page('/orders', { lazy: () => import('./pages/orders') })
```

```tsx
// app/pages/orders.tsx
import { useStorage } from '@kitr/storage/react'
import { ordersPageSize } from '#app/storage'

export default function OrdersPage() {
  const [pageSize, setPageSize] = useStorage(ordersPageSize)
  return (
    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
      <option value={25}>25 per page</option>
      <option value={50}>50 per page</option>
      <option value={100}>100 per page</option>
    </select>
  )
}
```

If Ada saved 50, the server sends HTML with 25 selected, the browser hydrates with 25, and then shows 50. The markup always matches, so React never reports a hydration error.

> [!WARNING] Use the hook in rendered components
> Don't call `ordersPageSize.get()` in a server-rendered component: the server returns 25, the browser 50, and React reports a mismatch. If the first HTML must show the saved value, use a cookie.

## Handle missing, invalid and blocked storage

Storage items never throw on a read. Each case below returns the default:

| Situation | `get()` returns | `set()` does |
| --- | --- | --- |
| Nothing saved yet | the default | saves the value |
| Saved value isn't valid JSON | the default | overwrites it |
| Saved value fails `schema` | the default | saves the value |
| Saved under another `version`, no `migrate` | the default | saves with the new version |
| Older than its `ttl` | the default | saves with a new expiry |
| On the server | the default | nothing |
| Storage blocked (some private modes, sandboxed iframes) | the default | nothing |
| Storage full | see below | doesn't throw |

When the browser refuses a write because storage is full, `set()` catches the error and still notifies subscribers. `get()` returns the new value for the rest of the page's life if the key had none before; otherwise it keeps returning the last saved value.

## Declare a cookie

A cookie is the one value both browser and server can read, so it suits anything the server needs for the first page, such as Ada's language. Declare it with `defineCookie`, next to the storage items:

```ts
// app/storage.ts
import { defineCookie } from '@kitr/storage'

export type Locale = 'en' | 'de' | 'fr'

export const localeCookie = defineCookie<Locale>('locale', {
  default: 'en',
  maxAge: 60 * 60 * 24 * 365,
})

export const tablePrefs = defineCookie('table-prefs', {
  default: { dense: false, columns: ['id', 'customer', 'total'] },
  maxAge: 60 * 60 * 24 * 30,
})
```

A string default is stored as plain text (`acme:locale=de`); any other default as URL-encoded JSON. Pass `codec` to choose yourself; `schema` works as on storage items. Every `CookieOptions` field (`path`, `domain`, `maxAge`, `expires`, `secure`, `httpOnly`, `sameSite`) can be set on the item and wins over `cookie` in `config/storage.ts`.

> [!WARNING] Keep cookies small
> The browser sends every cookie with every request, and caps one at about 4 KB. Put large or private values in storage items or on the server.

## Read and write cookies in a component

In a component, `useCookie` works like `useStorage`:

```tsx
// app/components/locale-switch.tsx
import { useCookie } from '@kitr/storage/react'
import { type Locale, localeCookie } from '#app/storage'

export function LocaleSwitch() {
  const [locale, setLocale] = useCookie(localeCookie)
  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
      <option value="en">English</option>
      <option value="de">Deutsch</option>
      <option value="fr">Français</option>
    </select>
  )
}
```

Ada picks Deutsch. The browser now holds:

```text
acme:locale=de; Max-Age=31536000; Path=/; SameSite=Lax
```

The next request to the server carries `Cookie: acme:locale=de`. Outside React, call the same methods on the item:

```ts
// app/lib/settings/locale.ts
import { localeCookie } from '#app/storage'

localeCookie.set('fr')
localeCookie.get() // => 'fr'
localeCookie.remove()
localeCookie.get() // => 'en'
```

In the browser, `get()` with no argument reads `document.cookie`. `set()` always writes a script-readable cookie, even for `httpOnly: true` items, because browsers refuse script writes of `httpOnly`. Cookies don't fire events across tabs; another tab sees the new value on its next read.

If other code writes `document.cookie`, such as a vendor consent banner, call `notifyCookiesChanged()` so mounted `useCookie` hooks re-read:

```ts
// app/lib/vendor-banner.ts
import { notifyCookiesChanged } from '@kitr/storage'

window.addEventListener('vendor:consent-saved', () => notifyCookiesChanged())
```

## Render cookies during server rendering

During server rendering `useCookie` needs the request's `Cookie` header. Wrap the tree once in `<CookieHeader>` in the root route. In a [TanStack Start](https://tanstack.com/start/latest) app, read the header in a server function and pass it from the loader:

```ts
// app/routes.ts
import { head, readCookieHeader, RootDocument } from './document'

r.root({ head, loader: () => readCookieHeader(), component: RootDocument })
```

```tsx
// app/document.tsx
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getRouteApi, HeadContent, Outlet, Scripts } from '@kitr/router'
import { CookieHeader } from '@kitr/storage/react'

export const readCookieHeader = createServerFn({ method: 'GET' }).handler(() =>
  getRequest().headers.get('cookie'),
)

const root = getRouteApi('__root__')

export function RootDocument() {
  const cookieHeader = root.useLoaderData()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <CookieHeader value={cookieHeader}>
          <Outlet />
        </CookieHeader>
        <Scripts />
      </body>
    </html>
  )
}
```

With the wrapper, `<LocaleSwitch />` renders `Deutsch` in the first HTML for Ada. Without it, the server renders `English` and the browser corrects it after hydration, as a flash.

For one cookie in a loader, skip the wrapper: `get()` accepts a `Headers` object, a raw `Cookie` string, or anything with a `cookie` field:

```ts
// app/pages/orders.tsx
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { localeCookie } from '#app/storage'

export const readLocale = createServerFn({ method: 'GET' }).handler(() =>
  localeCookie.get(getRequest().headers),
)

localeCookie.get('acme:locale=de; acme:table-prefs=%7B%7D') // => 'de'
localeCookie.get(null) // => 'en'
```

## Read and set cookies on the server

On the server, `cookies()` from `@kitr/storage/server` gives typed access to one request's cookies. Pass it the h3 event. Reads come from the `Cookie` header; writes append `Set-Cookie` to the response:

```ts
// server/controllers/settings-controller.ts
import type { HttpContext } from '@kitr/api'
import { cookies } from '@kitr/storage/server'
import { type Locale, localeCookie } from '#app/storage'

export default class SettingsController {
  async show({ event }: HttpContext) {
    const jar = cookies(event)
    return { locale: jar.get(localeCookie) }
  }

  async update({ event, body }: HttpContext<{}, {}, { locale: Locale }>) {
    const jar = cookies(event)
    jar.set(localeCookie, body.locale)
    return { locale: body.locale }
  }
}
```

`PUT /api/settings` with `{ "locale": "de" }` answers with this header:

```http
Set-Cookie: acme:locale=de; Max-Age=31536000; Path=/; SameSite=Lax
```

`jar.remove(item)` appends a header that expires the cookie. `jar.header` is the raw `Cookie` header, which you can pass to `<CookieHeader>`.

With only Fetch primitives, such as a Cloudflare Worker, pass the `Request` and the response `Headers`:

```ts
// server/edge/locale.ts
import { cookies } from '@kitr/storage/server'
import { localeCookie } from '#app/storage'

export function handleLocale(request: Request): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  const jar = cookies(request, headers)
  const locale = jar.get(localeCookie)
  if (locale === 'en') jar.set(localeCookie, 'de')
  return new Response(JSON.stringify({ locale }), { headers })
}
```

## Set an httpOnly cookie from the server

A cookie that scripts must never read, such as an opaque session id, is `httpOnly` and set only by the server. Declare it with `httpOnly: true`:

```ts
// server/auth/session-cookie.ts
import { defineCookie } from '@kitr/storage'

export const sessionCookie = defineCookie('sid', {
  default: '',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 8,
})
```

```ts
// server/controllers/sessions-controller.ts
import type { HttpContext } from '@kitr/api'
import { cookies } from '@kitr/storage/server'
import { sessionCookie } from '#server/auth/session-cookie'

export default class SessionsController {
  async store({ event }: HttpContext) {
    const sessionId = crypto.randomUUID()
    cookies(event).set(sessionCookie, sessionId)
    return { ok: true }
  }

  async destroy({ event }: HttpContext) {
    cookies(event).remove(sessionCookie)
    return { ok: true }
  }
}
```

```http
Set-Cookie: acme:sid=3f2b...; Max-Age=28800; Path=/; Secure; HttpOnly; SameSite=Strict
```

Options passed to `set()` win over the item's, so `jar.set(sessionCookie, id, { maxAge: 60 * 60 * 24 * 30 })` writes a "remember me" cookie from the same declaration.

> [!WARNING] Cookies are not signed
> Anyone can edit their own cookies, so never trust one as proof of who someone is: store a random id and look it up on the server. For sign-in, use [Auth](/packages/auth).

## Share cookies across subdomains

To read one cookie on `acme.com`, `app.acme.com` and `billing.acme.com`, set `domain` to the parent domain, in config for every cookie or on one item:

```ts
// config/storage.ts
import { defineConfig } from '@kitr/storage'

export default defineConfig({
  prefix: 'acme:',
  cookie: {
    path: '/',
    domain: '.acme.com',
    sameSite: 'lax',
    secure: import.meta.env?.PROD ?? false,
  },
})
```

Every `Set-Cookie` now ends with `Domain=.acme.com; Path=/; ...`. A cookie can only be removed with the `domain` it was set with, so keep it in config.

## Build and parse cookie headers by hand

`parseCookies` and `serializeCookie` are what every cookie item uses. Use them for a cookie that isn't declared, such as one a third party set:

```ts
// server/lib/referrer.ts
import { parseCookies, serializeCookie } from '@kitr/storage'

parseCookies('acme:locale=de; utm_source=newsletter; broken')
// => { 'acme:locale': 'de', utm_source: 'newsletter' }

serializeCookie('utm_source', 'newsletter', { maxAge: 3600 })
// => 'utm_source=newsletter; Max-Age=3600; Path=/; SameSite=Lax'

serializeCookie('utm_source', null)
// => 'utm_source=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax'
```

`parseCookies` skips parts without `=`, trims spaces and URL-decodes values. `serializeCookie` URL-encodes the value and adds `Path=/` and `SameSite=Lax` plus the config defaults, but not the `prefix`; only items add that. An item can do the same: `localeCookie.serialize('de')` and `localeCookie.decode('de')`.

## Store values natively on desktop and mobile

Storage items use the platform's own store when a platform registers a driver, and Web Storage otherwise. You declare and read items the same way everywhere. The provider hydrates the native store before the first render, so `get()` stays synchronous.

| Where the app runs | Driver | Where `local` items are saved |
| --- | --- | --- |
| Browser | `web:local` | `localStorage` |
| Desktop (Electron) | `electron:ipc` | `kitr-storage.json` in Electron's `userData` folder |
| Tauri | `tauri:store` | `kitr.json` in the app data folder |
| Mobile, Capacitor | `capacitor:preferences` | Capacitor Preferences |
| Server, or storage blocked | none | nothing; items read their defaults |

The platform's provider (`@kitr/desktop/provider`, `@kitr/tauri/provider` or `@kitr/mobile/provider`) can be listed before or after `@kitr/storage/provider` in `kitrrc.ts`.

On native platforms `session` items use an in-memory driver. Native writes happen in the background; a failed write is logged as `[@kitr/storage] <driver>: <error>` and the in-memory value stays.

### Browser

Nothing to set up: `local` items use `localStorage` and `session` items `sessionStorage`, about 5 MB per origin. Inspect them in devtools under Application → Local Storage.

### Desktop with Electron

[Desktop](/packages/desktop) with Electron registers `electronStorageDriver()`, which sends writes to the main process over IPC. The desktop scaffold's `main.ts` serves them with one call:

```ts
// platforms/app/main.ts
import { app, ipcMain } from 'electron'
import { handleKitrIpc } from '@kitr/desktop/main'

app.whenReady().then(() => {
  handleKitrIpc(ipcMain, app)
  // ... create the window
})
```

Values land in `kitr-storage.json` in [`app.getPath('userData')`](https://www.electronjs.org/docs/latest/api/app#appgetpathname). Pass `{ storageFile }` as the third argument to choose another file.

### Desktop with Tauri

The [Tauri](/packages/tauri) provider registers `tauriStoreDriver()` on the [store plugin](https://v2.tauri.app/plugin/store/), writing `kitr.json` in the app data folder. `kitr add tauri` sets up the plugin and permission; your items don't change.

### Mobile with Capacitor

[Mobile](/packages/mobile) registers `preferencesDriver()` on [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences). Preferences lives in the app's own data, so saved values survive when iOS or Android clears a WebView's `localStorage`.

## Testing

Storage items are module-level values, so a test reads and writes them directly. In Vitest's Node environment there is no `localStorage`: give items an in-memory driver with `setStorageDriver(createMemoryStorageDriver())`. Cookies need no setup; pass a `Request` and a `Headers` object to `cookies()`.

```ts
// app/storage.test.ts
import { createTestApp } from '@kitr/testing'
import {
  createMemoryStorageDriver,
  getStorageDriver,
  setStorageDriver,
  setStoragePrefix,
} from '@kitr/storage'
import storageProvider from '@kitr/storage/provider'
import { cookies } from '@kitr/storage/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localeCookie, recentSearches, sidebar } from '#app/storage'

beforeEach(() => {
  setStorageDriver(createMemoryStorageDriver())
})

afterEach(() => {
  setStoragePrefix('')
})

describe('app/storage', () => {
  it('remembers the sidebar under the configured prefix', async () => {
    await createTestApp({
      providers: [storageProvider],
      config: { storage: { prefix: 'acme:' } },
    })

    expect(sidebar.get()).toEqual({ collapsed: false })
    sidebar.set((s) => ({ collapsed: !s.collapsed }))
    expect(sidebar.get()).toEqual({ collapsed: true })
    expect(getStorageDriver('local')?.get('acme:sidebar')).toBe('{"v":1,"d":{"collapsed":true}}')
  })

  it('keeps recent searches in the session area', () => {
    recentSearches.set(['INV-1042'])
    expect(recentSearches.get()).toEqual(['INV-1042'])
    expect(getStorageDriver('session')?.keys()).toEqual(['recent-searches'])
  })

  it('reads and sets the locale cookie on the server', () => {
    const request = new Request('https://app.acme.com/orders', {
      headers: { cookie: 'locale=de' },
    })
    const response = new Headers()
    const jar = cookies(request, response)

    expect(jar.get(localeCookie)).toBe('de')
    jar.set(localeCookie, 'fr')
    expect(response.get('set-cookie')).toBe('locale=fr; Max-Age=31536000; Path=/; SameSite=Lax')
  })
})
```

The prefix and cookie defaults are module state too: reset them in `afterEach` with `setStoragePrefix('')` and `setCookieDefaults({})`, or later tests see `acme:` keys.

For components and cross-tab behaviour, use a DOM environment with `// @vitest-environment happy-dom` on the first line, clear `localStorage` between tests, and render with [Testing Library](https://testing-library.com/docs/react-testing-library/intro):

```tsx
// app/components/sidebar-toggle.test.tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { SidebarToggle } from '#app/components/sidebar-toggle'

afterEach(() => localStorage.clear())

it('collapses and remembers it', () => {
  render(<SidebarToggle />)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
  expect(localStorage.getItem('sidebar')).toBe('{"v":1,"d":{"collapsed":true}}')
})
```

To check the pre-hydration HTML, call `renderToString`: a `useStorage` component renders the default, and a `useCookie` component inside `<CookieHeader value="locale=de">` renders `de`.

## Extend

One interface plugs into storage: `StorageDriver`, the synchronous store behind `defineStorage` items on a platform. Its full type is in the [API reference](/packages/storage/api).

### Write a storage driver

| Member | Description |
| --- | --- |
| `name` | Shown in the devtools log. |
| `hydrate()` | Optional. Load every key into memory before the first render. The provider awaits it in `boot()`. |
| `get(key)` | The raw string, or `null`. Must answer synchronously. |
| `set(key, raw)` | Store a raw string. |
| `remove(key)` | Delete one key. |
| `keys()` | Every stored key, for the devtools panel. |
| `subscribe(listener)` | Optional. Call `listener(key)` when something outside this window changed a key (`null` for all keys); return an unsubscribe function. |

Most native stores are async. `createAsyncStorageDriver` wraps one: `load` fills an in-memory cache at boot, and `write` and `erase` run in the background, so reads stay synchronous. This driver uses [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) through [idb-keyval](https://github.com/jakearchibald/idb-keyval):

```ts
// app/providers/idb-storage.ts
import { defineProvider } from 'kitr/app'
import { createAsyncStorageDriver } from '@kitr/storage'
import { createStore, del, entries, set } from 'idb-keyval'

const store = createStore('acme', 'storage')

export const idbStorageDriver = createAsyncStorageDriver({
  name: 'idb:acme',
  load: async () => {
    const out: Record<string, string> = {}
    for (const [key, value] of await entries<string, string>(store)) out[key] = value
    return out
  },
  write: (key, raw) => set(key, raw, store),
  erase: (key) => del(key, store),
  onError: (error) => console.warn('[acme] could not save to IndexedDB', error),
})

export default defineProvider({
  name: 'idb-storage',
  register(app) {
    app.drivers.register('storage', idbStorageDriver, { platform: 'web' })
  },
})
```

Register it in `kitrrc.ts`; its place in the list does not matter:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  providers: [
    () => import('#app/providers/idb-storage'),
    () => import('@kitr/storage/provider'),
    // ...
  ],
  // ...
})
```

When several drivers are registered, the highest `priority` wins; platform drivers default to `10`. To replace both areas directly, such as in a test, call `setStorageDriver(driver, { session: otherDriver })`.

## Devtools

With [Devtools](/packages/devtools) installed, the provider adds a **Storage** panel in development. It lists every key in local storage, session storage and `document.cookie`, with a **remove** button per row and **Clear localStorage** and **Clear sessionStorage** actions.

At boot the provider logs the active driver (`web:local`, a native driver's name, or `none (server)`) to the Log panel under `storage`. Write your own lines with `logStorage(app, 'label', data)`.

## Next steps

- [API reference](/packages/storage/api): every export with its signature.
- [Secure storage](/packages/secure-storage): tokens and secrets in the OS vault.
- [Offline](/packages/offline): keep loaded query data on the device.
