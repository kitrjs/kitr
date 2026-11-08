---
title: Build a phone app
description: Ship an iPhone and Android app from the same React code as your web app, with native navigation, sign-in that survives restarts, the share sheet and deep links.
packages: mobile, platform, router, query, auth, storage
platforms: mobile, web
time: 45 min
preview: true
---

# Build a phone app

Acme's finance team chases unpaid invoices from wherever they are, and a web page in a phone browser does not cut it: no icon on the home screen, a back gesture that reloads the list, and a sign-in that is gone every time iOS clears the browser's storage. You will build Acme Billing, an iPhone and Android app for the invoices API from [Build an API server without React](/guides/api-server). It has a tab bar, an invoice list that stays where you left it when you open an invoice, a sheet for new invoices, sign-in with a token kept in native storage, the system share sheet and `acme://` links that open an invoice.

The app is the same React code that runs in a browser. kitr wraps it in a [Capacitor](https://capacitorjs.com) shell, and while it runs inside the shell, the kitr packages that have a native version switch to it: storage moves to native preferences, the platform hooks get the hardware back button and the app's lifecycle, and links to other sites open in the system browser.

> **Preview**
> The mobile platform is a preview. `@kitr/mobile` and `@kitr/platform` are not on npm yet because their native shells are not built in CI. The commands below need `--preview` and a kitr checkout, as the next section shows. The API may still change before the release.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer, pnpm, and a native toolchain for the phone you test on: Xcode for iOS (macOS only) or Android Studio for Android, set up as the [Capacitor environment guide](https://capacitorjs.com/docs/getting-started/environment-setup) describes. You also need the invoices API from [Build an API server without React](/guides/api-server) running on port 3001.

Until the mobile packages are published, create the project inside a kitr checkout, where `--preview` links the workspace packages:

```sh
git clone https://github.com/kitrjs/kitr.git && cd kitr
pnpm install && pnpm build
node packages/kitr/bin/kitr.mjs new examples/acme-billing --kit mobile --preview \
  --targets ios,android --no-install --no-git --registry $PWD/registry/dist
```

Then point `kitr` and every `@kitr/*` dependency in `examples/acme-billing/package.json` at `workspace:*` and run `pnpm install` at the root. Once the packages ship, this is `kitr new acme-billing --kit mobile`.

## Look at what the kit made

The `mobile` kit is the `app` kit (React, routing, query, forms, auth, theme) with two platforms:

```ts
// kitrrc.ts
platforms: {
  site: web({ mode: 'spa', pwa: true }),
  phone: mobile(),
},
```

`site` is the same app as an installable web app, and `phone` is the Capacitor shell. Both build the same `app/` folder, so a page you write runs in both. The kit also wrote `platforms/phone/capacitor.config.ts`, which is where the native projects will live, and registered `@kitr/mobile/provider` and `@kitr/platform/provider`, which pick the native drivers when the app runs in the shell.

Name the app before the first native build, because `cap add` copies the id into the Xcode and Android Studio projects:

```sh
cd examples/acme-billing
kitr config phone appId com.acme.billing
kitr config phone appName "Acme Billing"
kitr config phone scheme acme
```

`capacitor.config.ts` is written once, so set `appId` and `appName` in `platforms/phone/capacitor.config.ts` too. `scheme: 'acme'` registers `acme://` links in the iOS `Info.plist` and the Android manifest on the next build.

## Point the app at the API

A phone is a different machine from the one running the API, so `localhost` on the phone is the phone itself. Use your computer's address on the local network for development, and the real API in production:

```sh
# .env
VITE_API_URL=http://192.168.1.20:3001/api
```

The browser in the shell sends requests from its own origin: `capacitor://localhost` on iOS and `https://localhost` on Android, or the dev server's address while `kitr dev phone` runs with live reload. Add them to the API's `cors()` origins, next to the web app:

```ts
// acme-billing-api/server/routes.ts
cors({
  origin: ['https://app.acme.com', 'capacitor://localhost', 'https://localhost', 'http://192.168.1.20:3100'],
}),
```

## Sign in with a token

A phone app has no cookie jar it can rely on across restarts, so it signs in with a bearer token, which the API from the server guide already accepts. Give the API a route that trades an email and password for a token, and one that returns the user behind a token:

```ts
// acme-billing-api/server/controllers/session_controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'
import { requireUser } from '@kitr/auth/server'
import { z } from 'zod'
import { type ApiUser, signInWith } from '#server/auth'

export default class SessionController {
  static validation = { store: { body: z.object({ email: z.email(), password: z.string().min(1) }) } }

  async store({ body }: HttpContext<{}, {}, { email: string; password: string }>) {
    const token = await signInWith(body.email, body.password)
    if (!token) throw KitrError.unauthorized('Wrong email or password')
    return { token }
  }

  async show(ctx: HttpContext) {
    return requireUser<ApiUser>(ctx)
  }
}
```

`signInWith` goes next to the token table that `authMiddleware` already reads, and the two routes go on either side of the `auth` group:

```ts
// acme-billing-api/server/auth.ts
// ...ApiUser, tokens and auth as in the server guide

/** Swap for your users table and hashed passwords, as in the sign-in guide. */
const passwords = new Map([['ada@acme.com', 'paper-lantern-42']])

export async function signInWith(email: string, password: string) {
  if (passwords.get(email) !== password) return null
  for (const [token, user] of tokens) if (user.email === email) return token
  return null
}
```

```ts
// acme-billing-api/server/routes.ts
r.post('/sign-in', [SessionController, 'store'], { name: 'session.store' })
  .group({ middleware: [auth] }, (secured) =>
    secured.get('/me', [SessionController, 'show'], { name: 'session.show' }).resource('invoices', InvoicesController),
  )
```

`curl -X POST localhost:3001/api/sign-in -H 'content-type: application/json' -d '{"email":"ada@acme.com","password":"paper-lantern-42"}'` answers `{"token":"tok_ada"}`. [Add sign-in, end to end](/guides/authentication) shows a real users table with scrypt hashes.

On the phone, keep the token in a [Storage](/packages/storage) item. Inside the shell, kitr stores `local` items in Capacitor's native preferences, which iOS does not clear the way it can clear a web view's `localStorage`:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

/** The API token. On a phone this lives in native preferences, which iOS does not clear. */
export const apiToken = defineStorage<string | null>('api-token', { default: null })

/** The last list filter, so the app reopens where Ada left it. */
export const invoiceFilter = defineStorage<'open' | 'paid' | 'all'>('invoice-filter', { default: 'open' })
```

Then hand that item to the token adapter in `config/auth.ts`, and let the HTTP client send the token with every request:

```ts
// config/auth.ts
import { defineConfig, tokenAdapter } from '@kitr/auth'
import { abilities, type User } from '#app/abilities'
import { env } from '#app/env'
import { apiToken } from '#app/storage'

const adapter = tokenAdapter<User>({
  abilities,
  storage: { get: () => apiToken.get(), set: (token) => apiToken.set(token) },
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw new Error('Wrong email or password')
    return (await res.json()) as { token: string }
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
```

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: (container) => container.use('auth').getToken(),
})
```

When the app starts, the auth provider reads the stored token, calls `/me` and restores the session before the first page loads, so Ada opens the app and lands on her invoices without signing in again.

## Describe the invoices

Put the API's endpoints in one file as queries and mutations. Pages and loaders read them through the query cache, so the list and the detail share data and a payment refreshes both:

```ts
// app/features/invoices/queries.ts
import { createKeys } from 'kitr/app'
import { httpMutation, httpQuery } from '@kitr/http'
import { mutationFrom, queryFrom } from '@kitr/query'
import { app } from '#app/app'

export interface Invoice {
  id: string
  customerEmail: string
  amountCents: number
  status: 'open' | 'paid'
}

/** A function, called per request: this file loads with the route table, before the app boots. */
const http = () => app.container.use('http')
export const invoiceKeys = createKeys('invoices')

export const invoicesQuery = queryFrom(
  httpQuery<void, Invoice[]>(http, { path: 'invoices', key: () => invoiceKeys.lists() }),
)

export const invoiceQuery = queryFrom(
  httpQuery<string, Invoice>(http, { path: (id) => `invoices/${id}`, key: (id) => invoiceKeys.detail(id) }),
)

export const payInvoice = mutationFrom(
  httpMutation<string, Invoice>(http, {
    path: (id) => `invoices/${id}/pay`,
    body: () => undefined,
    effects: { invalidate: [invoiceKeys.all] },
  }),
)

export const createInvoice = mutationFrom(
  httpMutation<{ customerEmail: string; amountCents: number }, Invoice>(http, {
    path: 'invoices',
    effects: { invalidate: [invoiceKeys.lists()] },
  }),
)

export const formatAmount = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
```

`http` is a function that returns the client, and `httpQuery` calls it on each request. `app/routes.ts` imports this file for its loaders, and the route table loads before the app boots, when the container has no `http` binding yet. `body: () => undefined` sends the payment request without a body.

## Lay out the pages as a native stack

On a phone, opening an invoice pushes it over the list. The list stays mounted underneath, scrolled to the same row, and a swipe from the left edge on iOS or the back button on Android reveals it again. The route table says which pages exist; `presentation` and `stackParent` say how they move:

```ts
// app/routes.ts
import { defineRoutes } from 'kitr/app'
import { requireAuth } from '@kitr/router'
import router from '@kitr/router/routes'
import { invoiceQuery, invoicesQuery } from '#app/features/invoices/queries'
import { head, RootDocument } from './document'

export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/sign-in', {
      validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
      }),
      lazy: () => import('./pages/sign-in'),
    })
    .layout('_tabs', { beforeLoad: requireAuth(), lazy: () => import('./pages/tabs') }, (tabs) =>
      tabs
        .page('/', {
          loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery.options()),
          lazy: () => import('./pages/invoices'),
        })
        .page('/invoices/new', { presentation: 'cover', lazy: () => import('./pages/new-invoice') })
        .page('/invoices/$id', {
          stackParent: '/',
          loader: ({ context, params }) => context.queryClient.ensureQueryData(invoiceQuery.options(params.id)),
          lazy: () => import('./pages/invoice'),
        })
        .page('/account', { lazy: () => import('./pages/account') }),
    ),
)

export type AppRoutes = typeof routes.$types
```

`requireAuth()` on the layout sends a signed-out visitor to `/sign-in`. `presentation: 'cover'` makes the new-invoice form rise over the whole screen and dismiss with a downward drag. `stackParent: '/'` is for cold starts: when a link opens `/invoices/inv_2041` directly, the list is put under it, so the back gesture has somewhere to go.

The layout renders `<StackTabs>`, which keeps one stack per tab. Leave the Invoices tab two pages deep, check Account, come back, and Invoices is still two pages deep:

```tsx
// app/pages/tabs.tsx
import { StackTabs } from '@kitr/router/stack'
import { DeepLinks } from '#app/components/deep-links'

const tabs = [
  { id: 'invoices', to: '/', label: 'Invoices', match: ['/', '/invoices'] },
  { id: 'account', to: '/account', label: 'Account' },
]

export default function TabsLayout() {
  return (
    <div className="h-dvh">
      <DeepLinks />
      <StackTabs tabs={tabs}>
        {({ tabs, current, select }) => (
          <nav aria-label="Tabs" className="flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                aria-current={current?.id === tab.id ? 'page' : undefined}
                className="flex-1 py-3 text-sm aria-[current=page]:font-semibold"
                onClick={() => select(tab)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </StackTabs>
    </div>
  )
}
```

The stack fills its parent, so the wrapper gets the full dynamic viewport height (`h-dvh`). The tab bar pads itself by `env(safe-area-inset-bottom)` so it clears the home indicator, which works because the kit's document sets `viewport-fit=cover`. Tapping the current tab again pops it to its root, and on Android the back button at the root of Account goes to Invoices before it leaves the app.

## Write the pages

The list reads the cache the loader filled, so it renders without a spinner. The filter is a storage item, so the app reopens on the same filter:

```tsx
// app/pages/invoices.tsx
import { useSuspenseQuery } from '@kitr/query'
import { Link } from '@kitr/router'
import { useStorage } from '@kitr/storage/react'
import { formatAmount, invoicesQuery } from '#app/features/invoices/queries'
import { invoiceFilter } from '#app/storage'

export default function InvoicesPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery.options())
  const [filter, setFilter] = useStorage(invoiceFilter)
  const shown = filter === 'all' ? invoices : invoices.filter((invoice) => invoice.status === filter)

  return (
    <main className="p-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link to="/invoices/new" className="text-sm font-medium">New</Link>
      </header>
      <div role="tablist" className="mb-4 flex gap-2">
        {(['open', 'paid', 'all'] as const).map((value) => (
          <button type="button" role="tab" key={value} aria-selected={filter === value} onClick={() => setFilter(value)}>
            {value}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {shown.map((invoice) => (
          <li key={invoice.id}>
            <Link to="/invoices/$id" params={{ id: invoice.id }} className="flex justify-between py-3">
              <span>{invoice.customerEmail}</span>
              <span>{formatAmount(invoice.amountCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

The detail page has a back button only when there is a page to go back to, a payment button and a share button. `useStack()` tells the page where it stands in the stack:

```tsx
// app/pages/invoice.tsx
import { useMutation, useSuspenseQuery } from '@kitr/query'
import { getRouteApi } from '@kitr/router'
import { useStack } from '@kitr/router/stack'
import { formatAmount, invoiceQuery, payInvoice } from '#app/features/invoices/queries'
import { shareInvoice } from '#app/features/invoices/share-invoice'

const route = getRouteApi('/_tabs/invoices/$id')

export default function InvoicePage() {
  const { id } = route.useParams()
  const { data: invoice } = useSuspenseQuery(invoiceQuery.options(id))
  const pay = useMutation(payInvoice)
  const stack = useStack()

  return (
    <main className="p-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      {stack.canPop ? <button type="button" onClick={stack.pop}>Invoices</button> : null}
      <h1 className="text-2xl font-semibold">{formatAmount(invoice.amountCents)}</h1>
      <p>{invoice.customerEmail} · {invoice.status}</p>
      <div className="mt-6 flex gap-3">
        {invoice.status === 'open' ? (
          <button type="button" disabled={pay.isPending} onClick={() => pay.mutate(invoice.id)}>
            Mark as paid
          </button>
        ) : null}
        <button type="button" onClick={() => void shareInvoice(invoice)}>Share</button>
      </div>
    </main>
  )
}
```

"Mark as paid" posts to `/api/invoices/inv_2041/pay`, and `invalidate: [invoiceKeys.all]` refetches the detail and the list, so the invoice moves out of the Open filter on the page underneath. The new-invoice page is a form whose Cancel button calls `stack.dismiss()` and whose Save button creates the invoice, then replaces the sheet with the new invoice's page by calling `navigate({ to: '/invoices/$id', params: { id: invoice.id }, replace: true })`.

The sign-in page is the one from [Auth](/packages/auth): `useAuth().signIn({ email, password })`, then `navigate({ to: redirect ?? '/', replace: true })`. The Account page shows `useUser()`'s email and the version from `platform.appVersion()`, which reads `CFBundleShortVersionString` on iOS and `versionName` on Android, and signs out with `useAuth().signOut()`.

## Open the share sheet

Capacitor plugins are ordinary dependencies. Install the Share plugin and wrap the call in `nativeOnly()`, which runs it inside the shell and returns the fallback in a browser without loading the plugin:

```sh
pnpm add @capacitor/share
```

```ts
// app/features/invoices/share-invoice.ts
import { nativeOnly } from '@kitr/mobile/client'
import type { Invoice } from './queries'

export async function shareInvoice(invoice: Invoice) {
  const url = `https://app.acme.com/invoices/${invoice.id}`
  const shared = await nativeOnly(async () => {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: `Invoice ${invoice.id}`, text: `Invoice for ${invoice.customerEmail}`, url })
    return 'shared' as const
  }, 'copied' as const)
  if (shared === 'copied') await navigator.clipboard.writeText(url)
  return shared
}
```

On an iPhone, Share opens the system sheet with Messages, Mail and Slack. On the web build of the same page it copies the link. The plugin is registered in the native projects by the next `kitr build phone`, which runs `cap sync`.

## Open invoices from links

`acme://invoices/inv_2041` in a message or an email should open that invoice. The `scheme` option registered `acme://` with both operating systems. Hand every URL the OS gives the app to the router:

```tsx
// app/components/deep-links.tsx
import { useDeepLink } from '@kitr/platform/react'
import { useNavigate } from '@kitr/router'
import { useCallback } from 'react'

/** acme://invoices/inv_2041 and https://app.acme.com/invoices/inv_2041 open the invoice. */
export function DeepLinks() {
  const navigate = useNavigate()
  useDeepLink(useCallback((_url, path) => void navigate({ to: path }), [navigate]))
  return null
}
```

The second argument is the router path with the scheme and host removed: `acme://invoices/inv_2041` becomes `/invoices/inv_2041`. `https://app.acme.com/...` links need Associated Domains on iOS and an App Links intent filter on Android, which the [Capacitor deep links guide](https://capacitorjs.com/docs/guides/deep-links) walks through. When the link starts the app, `stackParent` puts the list under the invoice.

## Run it on a simulator

Build once to create the native projects, then start the iOS simulator with live reload:

```sh
kitr build phone
kitr dev phone --target ios
# phone: dev server on http://192.168.1.20:3100, the ios app loads it live
```

`kitr dev phone` starts Vite on your machine's network address, then runs `cap run ios` with the app pointed at it. Edit a page and the simulator updates in place. Use `--target android` for the Android emulator, and `--device <id>` for a phone on a cable. The same app runs in a desktop browser with `kitr dev site`, where the back button is the browser's, the share button copies the link and storage is `localStorage`.

## Test it

Unit tests run in Node, where there is no Capacitor. A fake `Capacitor` global plays the shell, and `vi.doMock` stands in for the plugin:

```ts
// test/phone.test.ts
import { mobileProvider } from '@kitr/mobile/provider'
import { platformProvider } from '@kitr/platform/provider'
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareInvoice } from '#app/features/invoices/share-invoice'

function fakeShell(os: 'ios' | 'android') {
  ;(globalThis as any).Capacitor = { getPlatform: () => os, isNativePlatform: () => true, isPluginAvailable: () => true }
}

afterEach(() => {
  delete (globalThis as any).Capacitor
  vi.unstubAllGlobals()
})

const invoice = { id: 'inv_2041', customerEmail: 'grace@acme.com', amountCents: 12000, status: 'open' as const }

describe('Acme Billing on a phone', () => {
  it('uses the native drivers inside the shell', async () => {
    fakeShell('ios')
    const app = await createTestApp({ providers: [mobileProvider, platformProvider] })
    expect(app.container.use('platform').is('ios')).toBe(true)
  })

  it('copies the invoice link in a browser', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await shareInvoice(invoice)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://app.acme.com/invoices/inv_2041')
  })

  it('opens the share sheet in the shell', async () => {
    fakeShell('android')
    const share = vi.fn(async () => ({}))
    vi.doMock('@capacitor/share', () => ({ Share: { share } }))
    expect(await shareInvoice(invoice)).toBe('shared')
  })
})
```

Test gestures, the keyboard and the real plugins on a simulator or a device. [Test your app](/guides/testing) covers component and page tests, which work the same here.

## Ship to the stores

`kitr build phone` builds the client into `dist/phone/client` and syncs it into the native projects. `--open` opens each one in its IDE:

```sh
VITE_API_URL=https://api.acme.com/api kitr build phone --target ios --open
```

From Xcode and Android Studio you set signing, the version and build number, icons and splash screens, then archive for TestFlight and the Play Console. The projects in `platforms/phone/ios` and `platforms/phone/android` are yours to edit and commit; `kitr build` only copies the web bundle and the plugin list into them. Run `kitr doctor` before a release: it reports a missing Capacitor package, a missing `capacitor.config.ts`, or a native project that does not register the `acme` scheme yet.

## Next steps

- [Mobile](/packages/mobile): every platform option, the commands and the Capacitor helpers.
- [Platform](/packages/platform): the back button, app state, safe areas and deep links on every platform.
- [Router](/packages/router): stacks, sheets, tabs and the split view in detail.
- [Build a desktop app](/guides/desktop-app): the same app as a Windows, macOS and Linux window.
- [Ship one app to the web, phones and desktops](/guides/one-codebase): one route table for every platform.
