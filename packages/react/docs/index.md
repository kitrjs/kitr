---
title: React
description: React with the kitr app in context, so every component can reach services and config.
order: 1
---

# React

A kitr app is one object: `app`, created in `app/app.ts` from the providers in `kitrrc.ts` and the files in `config/`. `kitr/react` is how components reach it. Put `<KitrProvider app={app}>` at the root, and any component below it can read services and config without importing them, prop-drilling them or setting up a context of its own.

Every package with a React side builds on this, so it's part of every UI app. You never add it by hand: the [router](/packages/router) brings it in.

## Where the provider lives

With the router, `createKitrRouter({ routeTree, app })` renders `<KitrProvider>` around the whole tree for you. There is nothing to add.

Without the router, wrap the root yourself:

```tsx
// app/main.tsx
import { createRoot } from 'react-dom/client'
import { KitrBoot } from 'kitr/react'
import { app } from './app'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <KitrBoot app={app} fallback={<p>Loading…</p>}>
    <App />
  </KitrBoot>,
)
```

`KitrBoot` boots the app, which runs every provider's `register` and `boot`, shows `fallback` until that's done, and then renders `KitrProvider`. If you have already called `await app.boot()`, use `<KitrProvider app={app}>` directly.

## Provider wrappers

Packages that need a React provider of their own declare a `wrap()` method, and `KitrProvider` nests them for you in the order of `kitrrc.ts`. That covers the query client, theme, auth session, translations and error boundary. Your root component stays this short however many packages you add:

```tsx
<KitrProvider app={app}>
  <App />
</KitrProvider>
```

## Reading from the app

```tsx
import { useApp, useConfig, useService } from 'kitr/react'

function Projects() {
  const http = useService('http') // typed: the HttpClient from kitr/http
  const theme = useConfig('theme') // config/theme.ts, typed
  const app = useApp() // everything else: app.env, app.mode, app.container
  // ...
}
```

| Hook | Returns |
| --- | --- |
| `useApp()` | The app: `container`, `config`, `env`, `mode`, `environment`, `platform`. |
| `useService(name)` | A container binding, such as `http`, `queryClient`, `auth`, `monitoring` or `analytics`. |
| `useConfig(name)` | One package's config from `config/<name>.ts`. |

Names and types come from the packages you've installed. Each one extends kitr's registry by declaration merging, so `useService('http')` is a type error until `kitr/http` is added.

Most packages wrap these in a hook of their own, like `useAnalytics()` or `useTheme()`, so you'll reach for `useService` mostly for your own services.

## Your own services

Register a service in a provider, and every component can use it:

```ts
// app/providers/billing_provider.ts
import { defineProvider } from 'kitr/app'
import { createBillingClient, type BillingClient } from '#app/billing'

declare module 'kitr/app' {
  interface ContainerBindings {
    billing: BillingClient
  }
}

export default defineProvider({
  name: 'billing',
  register(app) {
    app.container.singleton('billing', () => createBillingClient(app.env.VITE_BILLING_URL))
  },
})
```

```tsx
const billing = useService('billing')
```

`kitr make:provider billing` writes `app/providers/billing_provider.ts` for you. List it under `providers` in `kitrrc.ts` to turn it on.

## Tests

`renderWithKitr` from [testing](/packages/testing) renders a component inside a test app's `KitrProvider`, with the query cache filled in.
