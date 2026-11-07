---
title: Devtools
description: Open a panel in development that shows what every package is doing. It is removed from production builds.
order: 1
---

# Devtools

A bottom panel in development, toggled with ctrl/cmd+shift+K, with one tab per package: app state, router, query cache, auth session, storage, platform drivers, errors, analytics events and a log of everything. ctrl/cmd+shift+P opens a command palette with each package's actions (invalidate queries, sign out, clear storage). The Vite plugin drops the provider from production builds, so nothing ships.

## Install

```sh
kitr add devtools
```

Every React kit includes it. `config/devtools.ts` sets `position`, `shortcutKey`, `maxEntries` and `openByDefault`; `enabled: false` turns it off without removing the package.

## Log from your own code

```ts
import { getDevtools } from 'kitr/app'

getDevtools(app)?.log('billing', 'invoice created', { id })
```

`getDevtools` is `null` in production, so the optional call costs nothing. Channels appear in the Log tab as they are first used.

## Add a panel

A provider contributes panels through `devtools(app)`:

```ts
import { definePanel } from 'kitr/devtools'
import { KeyValue } from 'kitr/devtools/ui'

export default defineProvider({
  name: 'billing',
  devtools: (app) => [
    definePanel({
      id: 'billing',
      label: 'Billing',
      render: () => <KeyValue rows={[['plan', app.container.use('billing').plan]]} />,
      actions: [{ id: 'sync', label: 'Sync plans', run: (app) => app.container.use('billing').sync() }],
    }),
  ],
})
```

`kitr/devtools/ui` exports the small components the built-in panels use (`JsonView`, `KeyValue`, `Badge`, `Toolbar`, `Button`, `LogList`) so a custom panel matches.
