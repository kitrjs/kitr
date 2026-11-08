---
title: Overview
description: React with the kitr app in context, so every component can reach services and config.
order: 0
---

# React

Every component in a real app needs something from outside itself: the HTTP client, the signed-in user, a feature flag, the theme. The usual answers are singletons imported from everywhere, props drilled through five layers, or a hand-written context per service. All three make components hard to test and hard to move.

`@kitr/react` puts the kitr app object in React context, so any component reaches a service or a config file with one hook.

## What it is

`@kitr/react` is the bridge between the kitr app and React. `KitrProvider` puts the app in context; `KitrBoot` boots it (runs every provider, binds every service) before rendering, or lets you render first with Suspense. Three hooks do the rest: `useApp` for the app itself, `useService` for anything bound in the container, `useConfig` for a config file. Other packages build on it: [router](/packages/router) renders inside `KitrProvider`, and every package's hooks call `useService` underneath.

It runs on the client, and on the server during server rendering. A server-only project has no React at all; use [server](/packages/server) and reach services through `app.container` there.

## Install

```sh
kitr add react
```

This installs `@kitr/react` with React and the Vite React plugin, adds the package to `kitrrc.ts` and writes `app/app.ts` and `app/env.ts`. There is no provider and no config file. Every UI kit includes it. The guide's [Install](/packages/react/guide#install) section lists every change.

## Quick start

With the router installed there is nothing to wire: every page already renders inside `KitrProvider`. A component reads a service with `useService` and a config file with `useConfig`:

```tsx
// app/features/invoices/invoice-count.tsx
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

Render `<InvoiceCount />` on a page and it shows `3 open invoices (theme: system)`. Both hooks are typed: `useService('http')` returns ky's `KyInstance` because [http](/packages/http) declares that binding, and `useConfig('theme')` returns `ThemeConfig` because [theme](/packages/theme) declares that config. For data, prefer [query](/packages/query) over `useEffect`; this example only shows where the service comes from. The guide continues from here: [Read a service in your first component](/packages/react/guide#read-a-service-in-your-first-component).

## Built on

`@kitr/react` is built on [React](https://react.dev) context and Suspense, and on the kitr core's app object: the container, the provider lifecycle and the config loader. It is included in every kit that renders a UI. kitr adds `createApp` for the browser entry, `KitrProvider`, `KitrBoot` and the three hooks.

## Problems it solves

- **Singletons imported from everywhere.** Components ask `useService('http')` and tests swap the service. See [Read a service in your first component](/packages/react/guide#read-a-service-in-your-first-component).
- **Rendering before services exist.** `KitrBoot` waits for boot, or renders a fallback with Suspense. See [Boot before rendering](/packages/react/guide#boot-before-rendering).
- **Config values hard-coded in components.** `useConfig('theme')` returns the typed config file. See [Read config in a component](/packages/react/guide#read-config-in-a-component).
- **Your own services with no home.** Register them in a provider and read them with the same hook. See [Register your own service](/packages/react/guide#register-your-own-service).
- **Services needed outside components.** The app object is reachable from plain code. See [Reach the app outside components](/packages/react/guide#reach-the-app-outside-components).

## Further reading

- [Guide](/packages/react/guide): install, configure and every task.
- [API reference](/packages/react/api): every export with its signature.
- [React documentation](https://react.dev): Suspense, context and error boundaries.
- [Router](/packages/router) and [Testing](/packages/testing): pages inside the provider, and `createTestApp` with `renderWithKitr`.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and `app/env.ts`.
