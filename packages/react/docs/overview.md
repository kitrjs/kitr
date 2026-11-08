---
title: Overview
description: React with the kitr app in context, so every component can reach services and config.
order: 0
---

# React

## What it is

`@kitr/react` connects the kitr app to React. `KitrProvider` puts the app in context, `KitrBoot` boots it first, and three hooks read it: `useApp`, `useService` and `useConfig`. Every other package's hooks build on these.

Runs in the browser and during server rendering. A server-only project has no React; reach services through `app.container` there.

## Install

```sh
kitr add react
```

Adds `@kitr/react` with React, plus `app/app.ts` and `app/env.ts`. No provider, no config file. Every UI kit includes it. [Every change](/packages/react/guide#install).

## Quick start

With the router installed, every page already renders inside `KitrProvider`:

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

The page shows `3 open invoices (theme: system)`. Both hooks are typed from the packages that declare the binding and the config. For data, prefer [query](/packages/query) over `useEffect`. Next in the guide: [Read a service in your first component](/packages/react/guide#read-a-service-in-your-first-component).

## Built on

kitr adds `createApp`, `KitrProvider`, `KitrBoot` and the three hooks.

## Problems it solves

- **Singletons imported from everywhere.** [Read a service in your first component](/packages/react/guide#read-a-service-in-your-first-component).
- **Rendering before services exist.** [Boot before rendering](/packages/react/guide#boot-before-rendering).
- **Config values hard-coded in components.** [Read config in a component](/packages/react/guide#read-config-in-a-component).
- **Your own services with no home.** [Register your own service](/packages/react/guide#register-your-own-service).
- **Services needed outside components.** [Reach the app outside components](/packages/react/guide#reach-the-app-outside-components).

## Further reading

- [Guide](/packages/react/guide).
- [API reference](/packages/react/api).
- [React documentation](https://react.dev).
- [Router](/packages/router) and [Testing](/packages/testing).
- [Configuration](/docs/configuration).
