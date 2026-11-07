---
title: Devtools
description: Open a panel in development that shows what every package is doing. It is removed from production builds.
order: 1
---

# Devtools

While you build, a small "k" button sits in the corner of your app. Click it, or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>, and a panel opens showing what every kitr package is doing: the current route, the query cache, the signed-in user, saved values, errors, analytics events and logs. None of it ships to production.

## Install

```sh
kitr add devtools
```

It writes `config/devtools.ts`. The `kitr()` Vite plugin removes the package from production builds, so it costs your users nothing.

## Panels

| Panel | Shows | Actions |
| --- | --- | --- |
| App | Mode, environment, status, providers and what each one does, container bindings and config. | Reload page |
| Router | The current route, its params and search, and recent navigations. | Re-run loaders, go to `/` |
| Query | Every cached [query](/packages/query) with its data and state. | Invalidate all, clear cache |
| Auth | The [auth](/packages/auth) session and signed-in user. | Reload session, refresh token, sign out |
| Storage | Saved values and cookies from [storage](/packages/storage). | Remove one, clear all |
| Platform | What [platform](/packages/platform) reports: type, OS, online state, safe areas. | |
| Errors | Everything [monitoring](/packages/monitoring) caught. | Clear errors, throw a test error |
| Analytics | Every event [analytics](/packages/analytics) sent, with its properties. | Enable, disable, clear events |
| Log | One searchable timeline of what every package logged, including [logger](/packages/logger) output and every [http](/packages/http) request. | Clear log |

A panel only appears when its package is installed.

## Command palette

<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> opens a palette with every panel's actions in one searchable list.

## Log your own things

```ts
import { getDevtools } from 'kitr/devtools'

getDevtools(app)?.log('checkout', 'cart updated', { items: cart.items.length })
```

`getDevtools` returns `null` in production, so the call costs nothing there.

## Add a panel

A provider can add its own panel with a `devtools(app)` method:

```tsx
// providers/flags.ts
import { defineProvider } from 'kitr/app'

export const flagsProvider = defineProvider({
  name: 'flags',
  devtools: () => import('./flags-devtools').then((m) => m.panels()),
})
```

```tsx
// providers/flags-devtools.tsx
import { definePanel } from 'kitr/devtools'
import { KeyValue } from 'kitr/devtools/ui'

export const panels = () => [
  definePanel({
    id: 'flags',
    label: 'Flags',
    badge: (app) => Object.keys(app.container.use('flags').all()).length,
    render: (app) => <KeyValue rows={Object.entries(app.container.use('flags').all())} />,
    actions: [{ id: 'reset-flags', label: 'Reset flags', run: (app) => app.container.use('flags').reset() }],
  }),
]
```

Import the panel file lazily as above, so it never ends up in your main bundle or in production. `JsonView`, `KeyValue` and `LogList` from `kitr/devtools/ui` match the look of the built-in panels, and each panel's actions show up in the command palette.

## Config

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | development | Set `false` to turn it off without removing it. |
| `position` | `bottom-left` | Corner for the button: `bottom-left`, `bottom-right`, `top-left` or `top-right`. |
| `shortcutKey` | `k` | The key pressed with Ctrl/Cmd + Shift. |
| `maxEntries` | `500` | Entries kept per channel. |
| `openByDefault` | `false` | Open on first load. |
