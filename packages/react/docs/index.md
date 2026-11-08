---
title: React
description: React with the kitr app in context, so every component can reach services and config.
order: 1
---

# React

Every component in a real app needs something from outside itself: the HTTP client, the signed-in user, a feature flag, the theme. `@kitr/react` puts the kitr app object in React context, so any component can read a service or a config file with one hook, without importing singletons, prop-drilling or writing a context of its own. It is built on [React](https://react.dev) and adds `KitrProvider`, `KitrBoot` and three hooks: `useApp`, `useService` and `useConfig`.

It runs on the client, and on the server during server rendering. A server-only project (the `server` kit) has no React at all; use [server](/packages/server) and reach services through `app.container` there.

This guide follows Acme's billing app at `app.acme.com`: Ada adds a `billing` service that loads invoices, and every component reaches it through the app.

## Install

Every UI kit (`blank`, `app`, `fullstack`, `saas`, `site`, `realtime`, `desktop`, `mobile`) includes React, and the web, desktop and mobile platforms add it through the [router](/packages/router), which requires it. You only run this in a project that has none:

```sh
kitr add react
```

What `kitr add` does:

- Installs `@kitr/react`, `react` and `react-dom`, and as dev dependencies `@vitejs/plugin-react`, `@types/react` and `@types/react-dom`.
- Adds `'@kitr/react'` to `packages` in `kitrrc.ts`. React registers no provider, so `providers` is unchanged.
- Writes `app/env.ts`, which declares one public variable, `VITE_APP_NAME`, defaulting to your package name.
- Writes `app/app.ts`, which creates the app from the providers in `kitrrc.ts`, the files in `config/` and `app/env.ts`.
- Adds no config file, no variables to `.env.example`, no scripts and no `AGENTS.md` section.

`kitr add` never overwrites a file that exists, so an `app/env.ts` or `app/app.ts` you already have is kept. `kitr add react` asks no questions. It accepts the usual flags: `--no-install` skips the package manager and `--dry-run` prints what would change.

```sh
kitr add react --dry-run
```

`kitr remove react` removes the packages and the `kitrrc.ts` entry. It leaves `app/env.ts` and `app/app.ts` in place, because the rest of the app imports them.

## Configure

`@kitr/react` has no config file. What it needs is the app object, which `kitr add react` writes to `app/app.ts`:

```ts
// app/app.ts
import { createApp } from 'kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'

/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */
export const app = createApp({ providers, config, env })
```

`virtual:kitr/providers` is the `providers` list from `kitrrc.ts`, and `virtual:kitr/config` holds every `config/<name>.ts`, keyed by file name. The [`kitr()` Vite plugin](/docs/configuration) generates both.

`app/env.ts` is the environment file it passes in:

```ts
// app/env.ts
import { createEnv, env as e } from 'kitr/env'

/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */
export const env = createEnv({
  public: {
    VITE_APP_NAME: e.string({ default: 'acme-billing' }),
  },
  server: {},
})
```

You hand the app to React through the props of `KitrProvider` or `KitrBoot`:

| Option | Default | Description |
| --- | --- | --- |
| `app` | required | The `KitrApp` from `app/app.ts`. Both components put it in context and render every provider's `wrap()` around `children`. |
| `children` | required | The tree that can call `useApp`, `useService` and `useConfig`. |
| `fallback` | `null` | `KitrBoot` only. What renders while the app boots. |

`createApp` from `kitr/app` (also re-exported from `@kitr/react`) takes these options:

| Option | Default | Description |
| --- | --- | --- |
| `providers` | `[]` | Providers, or lazy imports of them, in `kitrrc.ts` order. |
| `config` | `{}` | Per-package config keyed by package name, as in `config/<name>.ts`. |
| `env` | `{}` | The validated env object from `createEnv`. Exposed as `app.env`. |
| `environment` | detected | `'client'`, `'server'` or `'test'`. `'test'` under Vitest, `'client'` when `window` and `document` exist, otherwise `'server'`. |
| `mode` | detected | `'development'`, `'production'` or `'test'`, from Vite's `import.meta.env.MODE` or `NODE_ENV`. |
| `platform` | `import.meta.env.KITR_PLATFORM` | The platform name from `kitrrc.ts` this bundle runs as, such as `site`. |

## Read a service in your first component

With the router installed there is nothing to wire: `createKitrRouter` renders `KitrProvider` around every page. A component reads a service with `useService` and a config file with `useConfig`:

```tsx
// app/components/invoices/invoice-count.tsx
import { useConfig, useService } from '@kitr/react'
import { useEffect, useState } from 'react'

export function InvoiceCount() {
  const http = useService('http') // the ky instance from @kitr/http
  const theme = useConfig('theme') // config/theme.ts
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    http
      .get('invoices')
      .json<{ id: string }[]>()
      .then((invoices) => setCount(invoices.length))
  }, [http])

  return (
    <p>
      {count === null ? 'Loading invoices…' : `${count} open invoices`} (theme: {theme.default})
    </p>
  )
}
```

Use it in any route:

```ts
// app/routes.ts
import { InvoiceCount } from '#app/components/invoices/invoice-count'

r.page('/invoices', {
    <main>
      <h1>Invoices</h1>
      <InvoiceCount />
    </main>
  ),
  lazy: () => import('./pages/invoices'),
})
```

```tsx
// app/pages/invoices.tsx
export default () => (
```

Open `/invoices` and the page shows `3 open invoices (theme: system)`. Both hooks are typed: `useService('http')` returns ky's `KyInstance` because [http](/packages/http) declares that binding, and `useConfig('theme')` returns `ThemeConfig` because [theme](/packages/theme) declares that config. A name no installed package declares returns `unknown`.

For data, prefer [query](/packages/query) over `useEffect`; this example only shows where the service comes from.

## Mount the app without the router

On the client, when you render React yourself (a widget, a micro-frontend, a test page), wrap the root in `KitrBoot`:

```tsx
// app/main.tsx
import { KitrBoot } from '@kitr/react'
import { createRoot } from 'react-dom/client'
import { app } from './app'
import { InvoiceCount } from './components/invoices/invoice-count'

createRoot(document.getElementById('root')!).render(
  <KitrBoot app={app} fallback={<p>Starting Acme Billing…</p>}>
    <InvoiceCount />
  </KitrBoot>,
)
```

`KitrBoot` calls `app.boot()`, which runs every provider's `register` and then its `boot`. It renders `fallback` until that finishes and then renders `KitrProvider`. If the app has already booted, it renders the children on the first render and never shows the fallback.

If boot fails, `KitrBoot` rethrows the error during render, so the nearest React error boundary catches it.

## Boot before rendering

When you can await, boot first and render `KitrProvider` directly. Nothing suspends and the first render is complete:

```tsx
// app/main.tsx
import { KitrProvider } from '@kitr/react'
import { createRoot } from 'react-dom/client'
import { app } from './app'
import { InvoiceCount } from './components/invoices/invoice-count'

await app.boot()

createRoot(document.getElementById('root')!).render(
  <KitrProvider app={app}>
    <InvoiceCount />
  </KitrProvider>,
)
```

This is what `app/client.tsx` does in a router project: it boots the app, then hydrates the server's HTML, so the first client render matches what the server sent.

```tsx
// app/client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { app } from './app'

/** Start's client entry, with the kitr app booted first so providers are ready when the tree hydrates. */
app.boot().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
})
```

`app.boot()` is idempotent: every caller shares one boot, so calling it from `client.tsx`, the router and a test never runs a provider twice.

## Render before boot with Suspense

`KitrProvider` also accepts an app that has not booted. It suspends on the boot promise, so the nearest `<Suspense>` boundary shows its fallback until every provider is ready. TanStack Start relies on this, because it builds the router synchronously before anything has awaited `app.boot()`.

```tsx
// app/main.tsx
import { KitrProvider } from '@kitr/react'
import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { app } from './app'
import { InvoiceCount } from './components/invoices/invoice-count'

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<p>Starting Acme Billing…</p>}>
    <KitrProvider app={app}>
      <InvoiceCount />
    </KitrProvider>
  </Suspense>,
)
```

Without a `<Suspense>` boundary above it, React has nowhere to show the wait and throws. Use `KitrBoot` when you do not want to place a boundary yourself.

| You have | Use |
| --- | --- |
| The router | Nothing. `createKitrRouter` renders `KitrProvider`. |
| Your own root, and you can `await` | `await app.boot()`, then `KitrProvider`. |
| Your own root, and you cannot `await` | `KitrBoot` with a `fallback`. |
| A `<Suspense>` boundary already in place | `KitrProvider` with an unbooted app. |

## Read the app itself

`useApp()` returns the whole app. Reach for it when you need something that is not a single service or config file:

```tsx
// app/components/environment-badge.tsx
import { useApp } from '@kitr/react'

export function EnvironmentBadge() {
  const app = useApp()
  if (app.isProduction) return null
  return (
    <span>
      {app.mode} on {app.platform ?? 'unknown platform'} ({app.environment})
    </span>
  )
}
// In `kitr dev site`: "development on site (client)"
```

| Property | What it is |
| --- | --- |
| `app.container` | The service container: `use(key)`, `has(key)`, `make(key)`, `keys()`. |
| `app.config` | Every `config/<name>.ts`: `get(key, fallback?)`, `has(key)`. |
| `app.env` | The object from `app/env.ts`, untyped. Import `env` from `#app/env` for types. |
| `app.mode` | `'development'`, `'production'` or `'test'`. |
| `app.environment` | `'client'`, `'server'` or `'test'`. |
| `app.platform` | The platform name from `kitrrc.ts`, such as `site`, or `undefined`. |
| `app.isClient`, `app.isServer`, `app.isDevelopment`, `app.isProduction` | Shorthands for the four checks above. |
| `app.status` | `'created'`, `'registered'`, `'booted'`, `'ready'` or `'shutdown'`. |

For typed environment variables, import the env object directly rather than reading `app.env`:

```tsx
// app/components/app-title.tsx
import { env } from '#app/env'

export function AppTitle() {
  return <title>{env.VITE_APP_NAME}</title>
}
```

## Read config in a component

`useConfig(name)` returns what `config/<name>.ts` exports by default:

```tsx
// app/components/theme-color.tsx
import { useConfig } from '@kitr/react'

export function ThemeColorSwatch() {
  const { colors } = useConfig('theme')
  return <span style={{ background: colors?.light }} aria-label="Light theme color" />
}
```

When the file does not exist, `useConfig` throws `[kitr] Missing config "theme". Create config/theme.ts or pass it to createApp().` For optional config, read it through the app with a fallback instead:

```tsx
// app/components/billing-banner.tsx
import { useApp } from '@kitr/react'

export function BillingBanner() {
  const billing = useApp().config.get('billing', { currency: 'usd' })
  return <p>Invoices are billed in {billing.currency.toUpperCase()}.</p>
}
```

Config is static: it is read once when `app/app.ts` runs. A component that reads it never re-renders because of it.

## Register your own service

Your own services go in the same container as the packages' services. Ada's billing client is a plain class:

```ts
// app/billing/client.ts
export interface Invoice {
  id: string
  team: string
  total: number
  status: 'open' | 'paid'
}

export class BillingClient {
  constructor(private readonly baseUrl: string) {}

  async openInvoices(team: string): Promise<Invoice[]> {
    const res = await fetch(`${this.baseUrl}/teams/${team}/invoices?status=open`)
    return (await res.json()) as Invoice[]
  }
}
```

A provider binds it during `register`:

```ts
// app/providers/billing-provider.ts
import { defineProvider } from 'kitr/app'
import { BillingClient } from '#app/billing/client'

declare module '@kitr/core' {
  interface ContainerBindings {
    billing: BillingClient
  }
  interface ConfigRegistry {
    billing: { currency: 'usd' | 'eur' }
  }
}

export default defineProvider({
  name: 'billing',
  register(app) {
    app.container.singleton('billing', () => new BillingClient('https://api.acme.com'))
  },
})
```

The `ConfigRegistry` entry types `config/billing.ts` for `useConfig('billing')` and `app.config.get('billing')`, the same way packages type theirs.

List it in `kitrrc.ts`, after the package providers it depends on:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/web'],
  providers: [
    () => import('@kitr/web/provider'),
    () => import('#app/providers/billing-provider'),
  ],
  platforms: { site: web({ mode: 'spa' }) },
})
```

Every component can now use it, typed:

```tsx
// app/components/invoices/open-invoices.tsx
import { useService } from '@kitr/react'
import { useEffect, useState } from 'react'
import type { Invoice } from '#app/billing/client'

export function OpenInvoices({ team }: { team: string }) {
  const billing = useService('billing') // BillingClient
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    billing.openInvoices(team).then(setInvoices)
  }, [billing, team])

  return (
    <ul>
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          {invoice.id}: ${invoice.total}
        </li>
      ))}
    </ul>
  )
}
```

`kitr make:provider billing` writes the provider file for you, at `app/providers/billing-provider.ts`, with `register`, `boot` and a commented `wrap`, and lists it in `providers` in `kitrrc.ts`.

Augment `'@kitr/core'`, the module that declares `ContainerBindings`. Don't augment `'kitr/app'`: it re-exports `@kitr/core` with `export *`, and TypeScript does not merge an interface through a re-export, so `useService('billing')` stays `unknown`.

## Bind async services

`useService` is synchronous. A factory that returns a promise works because `app.boot()` resolves every binding before the first render, so by the time a component asks, the instance is cached:

```ts
// app/providers/billing-provider.ts
import { defineProvider } from 'kitr/app'
import { BillingClient } from '#app/billing/client'

export default defineProvider({
  name: 'billing',
  register(app) {
    app.container.singleton('billing', async () => {
      const res = await fetch('https://app.acme.com/billing-config.json')
      const { apiUrl } = (await res.json()) as { apiUrl: string }
      return new BillingClient(apiUrl)
    })
  },
})
```

If a component reads an async binding that is still resolving, `useService` throws `[kitr] Binding "billing" has an async factory; await container.make('billing') before use('billing').` That only happens when you render with an app that has not finished booting and you bound the service after boot. Bind in `register`, and boot before rendering.

## Wrap the tree from a provider

A provider can put its own React context around the whole app with `wrap()`. `KitrProvider` composes every provider's `wrap` in `kitrrc.ts` order: the first provider is the outermost. That is how the query client, theme, auth session, translations and error boundary all reach your components while the root stays one line.

```tsx
// app/providers/team-provider.tsx
import { defineProvider } from 'kitr/app'
import { createContext, type ReactNode, useContext } from 'react'

const TeamContext = createContext<{ team: string }>({ team: 'acme' })

export const useTeam = () => useContext(TeamContext)

export default defineProvider({
  name: 'team',
  wrap: (children) => (
    <TeamContext.Provider value={{ team: 'acme' }}>{children as ReactNode}</TeamContext.Provider>
  ),
})
```

With `providers: [query, theme, team]`, the rendered tree is `<QueryClientProvider><ThemeProvider><TeamContext.Provider>{children}`. `wrap` receives the app as its second argument, so it can read config and services:

```tsx
// app/providers/team-provider.tsx
import { defineProvider } from 'kitr/app'
import { createContext, type ReactNode, useContext } from 'react'

const TeamContext = createContext<{ team: string }>({ team: 'acme' })

export const useTeam = () => useContext(TeamContext)

export default defineProvider({
  name: 'team',
  wrap: (children, app) => (
    <TeamContext.Provider value={{ team: app.config.get('team', { slug: 'acme' }).slug }}>
      {children as ReactNode}
    </TeamContext.Provider>
  ),
})
```

Here `config/team.ts` is optional: without it, `app.config.get` returns the fallback. Declare `team` in `ConfigRegistry` as shown for `billing` above to type it.

`wrap` runs on every render of `KitrProvider`'s children, so keep it to rendering context providers. Do I/O in `boot`.

Don't add a second `<QueryClientProvider>` or `<ThemeProvider>` in your root component. The packages' providers already wrap the tree; a second one shadows theirs with a different instance.

## Reach the app outside components

Loaders, `beforeLoad` guards and plain modules are not React components, so they cannot call hooks. In a route, read the app from the router context:

```ts
// app/routes.ts
r.page('/teams/$team/invoices', {
  loader: ({ context, params }) => context.app.container.use('billing').openInvoices(params.team),
  lazy: () => import('./pages/teams/team/invoices'),
})
```

```tsx
// app/pages/teams/team/invoices.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/teams/$team/invoices')

export default function TeamInvoices() {
  const invoices = route.useLoaderData()
  return <p>{invoices.length} open invoices for this team</p>
}
```

On the server, `createKitrRouter` forks the app per request, and `context.app` is that request's fork. Don't import `app` from `#app/app` inside a loader: on the server it is the shared app, and a request-scoped service such as the query cache would leak between visitors.

Outside routes, in client-only code such as an event handler set up at startup, import the app:

```ts
// app/billing/refresh.ts
import { app } from '#app/app'

export async function refreshOpenInvoices(team: string) {
  const billing = await app.container.make('billing')
  return billing.openInvoices(team)
}
```

`make()` awaits an async factory; `use()` does not. Both return the same cached instance.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:component <name>` | Writes a component to `app/components/<kebab-name>.tsx` (or your `directories.components`). `--force` overwrites an existing file. |
| `kitr make:hook <name>` | Writes a hook to `app/hooks/use-<kebab-name>.ts`. `--force` overwrites an existing file. |
| `kitr eject stub component`, `kitr eject stub hook` | Copies the generator's template to `stubs/<kind>.ts`, so `make:*` writes your own starting point. |

`kitr make:component invoice-summary` writes `app/components/invoice-summary.tsx`:

```tsx
// app/components/invoice-summary.tsx
import type { ReactNode } from 'react'

export interface InvoiceSummaryProps {
  children?: ReactNode
  className?: string
}

export function InvoiceSummary({ children, className }: InvoiceSummaryProps) {
  return <div className={className}>{children}</div>
}
```

`kitr make:hook order-filter` writes `app/hooks/use-order-filter.ts`, a toggle you rename and grow:

```ts
// app/hooks/use-order-filter.ts
import { useCallback, useState } from 'react'

export function useOrderFilter(initial = false) {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((v) => !v), [])
  return { value, setValue, toggle }
}
```

React adds no `kitr doctor` checks.

## Errors

These are thrown during render, so React's nearest error boundary receives them. With the router, that is the route's error screen.

| Error | When | What to do |
| --- | --- | --- |
| `[@kitr/react] useApp() must be used inside <KitrProvider>.` | `useApp`, `useService` or `useConfig` ran in a component outside `KitrProvider`. | Render the component under the router, `KitrProvider` or `KitrBoot`. In tests, use `renderWithKitr`. |
| `[kitr] No binding named "billing". Did you add the package that provides it?` | `useService(key)` for a key no provider registered. | `kitr add` the package, or list your provider in `kitrrc.ts`. |
| `[kitr] Binding "billing" has an async factory; await container.make('billing') before use('billing').` | The binding's factory returned a promise that has not resolved yet. | Boot before rendering, or `await app.container.make(key)` first. |
| `[kitr] Missing config "billing". Create config/billing.ts or pass it to createApp().` | `useConfig(key)` for a config file that does not exist. | Create the file, or use `useApp().config.get(key, fallback)`. |
| The provider's own error | A provider's `register` or `boot` threw inside `KitrBoot`. | Fix the provider. `KitrBoot` rethrows it so an error boundary shows it. |

## Testing

`renderWithKitr` from [testing](/packages/testing) renders a component inside `KitrProvider` with a test app. `createTestApp` creates and boots an app with `environment: 'test'`, so you pass it the same providers and config your component needs, or a stand-in service:

```tsx
// app/components/invoices/open-invoices.test.tsx
import { defineProvider } from 'kitr/app'
import { createTestApp, renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import type { BillingClient } from '#app/billing/client'
import { OpenInvoices } from './open-invoices'

describe('OpenInvoices', () => {
  it('lists the team’s open invoices from the billing service', async () => {
    const billing = {
      openInvoices: async (team: string) => [
        { id: 'inv_1', team, total: 120, status: 'open' as const },
        { id: 'inv_2', team, total: 80, status: 'open' as const },
      ],
    } as unknown as BillingClient

    const app = await createTestApp({
      providers: [
        defineProvider({
          name: 'billing',
          register: (a) => void a.container.value('billing', billing),
        }),
      ],
    })

    const screen = renderWithKitr(<OpenInvoices team="acme" />, { app })

    expect(await screen.findByText('inv_1: $120')).toBeTruthy()
    expect(screen.getByText('inv_2: $80')).toBeTruthy()
  })
})
```

`container.value(key, instance)` binds an object you built, which is the simplest way to fake a service. Config works the same way: `createTestApp({ config: { billing: { currency: 'eur' } } })`.

To test a provider's `wrap`, boot an app with it and render under `KitrProvider` from `@kitr/react`:

```tsx
// app/providers/team-provider.test.tsx
import { KitrProvider } from '@kitr/react'
import { createTestApp } from '@kitr/testing'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import teamProvider, { useTeam } from './team-provider'

it('puts the team in context', async () => {
  const app = await createTestApp({ providers: [teamProvider] })
  function TeamName() {
    return <p>{useTeam().team}</p>
  }
  render(
    <KitrProvider app={app}>
      <TeamName />
    </KitrProvider>,
  )
  expect(screen.getByText('acme')).toBeTruthy()
})
```

A component that calls `useApp` with nothing around it throws the `inside <KitrProvider>` error, which is what you want a test to catch:

```tsx
// app/components/environment-badge.test.tsx
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { EnvironmentBadge } from './environment-badge'

it('needs the app in context', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<EnvironmentBadge />)).toThrow(/inside <KitrProvider>/)
})
```

## Next steps

- [API reference](/packages/react/api): every export of `@kitr/react` with its signature.
- [Router](/packages/router): pages, loaders and guards, with `KitrProvider` already in place.
- [Testing](/packages/testing): `createTestApp`, `renderWithKitr` and the API test client.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and `app/env.ts`.
- [React documentation](https://react.dev): Suspense, context and error boundaries.
