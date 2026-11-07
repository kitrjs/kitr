---
title: Devtools
description: Open a panel in development that shows what every package is doing. It is removed from production builds.
order: 1
---

# Devtools

When a page shows stale data or a button does nothing, the first question is what the app is doing right now: which route matched, what is in the query cache, who is signed in, which request failed. `kitr/devtools` answers it in the page itself. In development a small "k" button sits in a corner; open it and a panel shows the route, the cache, the session, saved values, errors, analytics calls and one log that every kitr package writes to. Your own providers can add panels and log lines with a few lines of code.

The examples on this page follow one scenario: Acme's app at `app.acme.com` has a cart for orders, and Ada wants to see what is in it, log each change, and empty it from a button while she builds the checkout.

`kitr/devtools` runs in the browser, in development only. It renders nothing on the server, binds nothing in production, and the `kitr()` Vite plugin leaves it out of production builds, so it adds no bytes for your users. It is a view onto kitr; for React component trees and network timing, keep using [React Developer Tools](https://react.dev/learn/react-developer-tools) and your browser's devtools next to it.

## Install

```sh
kitr add devtools
```

What `kitr add` does:

- Installs `@kitr/devtools`.
- Adds `() => import('@kitr/devtools/provider')` to `providers` and `'@kitr/devtools'` to `packages` in `kitrrc.ts`.
- Writes `config/devtools.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: devtools` section to `AGENTS.md` telling coding agents how to open the overlay, to log with `getDevtools(app)?.log(...)`, and to add panels through a provider's `devtools()` method with the parts in `kitr/devtools/ui`.

`kitr add devtools` asks no questions and adds no env variables. To edit `package.json` without running the package manager, pass the global flag:

```sh
kitr add devtools --no-install
```

Every kit except `blank` and `server` includes devtools: `app`, `fullstack`, `saas`, `site`, `realtime`, `desktop` and `mobile`. It is a client package, so in a server-only project `kitr add devtools` prints a warning and skips it.

`kitr remove devtools` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/devtools.ts`. Calls to `getDevtools(app)?.log(...)` can stay: without the package they return `null` and do nothing. Panels you wrote in your own providers stay too, and are never shown.

## Configure

`kitr add devtools` writes this file:

```ts
// config/devtools.ts
import { defineConfig } from 'kitr/devtools'

/** Development only. The kitr() Vite plugin drops the provider from production builds. */
export default defineConfig({
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | on in development in the browser | `false` turns devtools off without removing the package. `true` turns it on in any mode, but production builds still leave the provider out. |
| `position` | `'bottom-left'` | The corner for the "k" button: `'bottom-left'`, `'bottom-right'`, `'top-left'` or `'top-right'`. |
| `shortcutKey` | `'k'` | The key that toggles the panel together with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd>. |
| `maxEntries` | `500` | Log entries kept per channel. When a channel is full, its oldest entry is dropped. |
| `openByDefault` | `false` | Open the panel on first load. After that, the panel remembers whether you left it open. |

The panel also remembers, per browser, the tab you had open and the height you dragged it to. It keeps them in `localStorage` under `kitr:devtools`; delete that key to start fresh.

### Turn it off without removing it

Set `enabled: false` to hide the overlay and stop binding the hub, for example while you record a demo of `app.acme.com`:

```ts
// config/devtools.ts
import { defineConfig } from 'kitr/devtools'

export default defineConfig({
  enabled: false,
  position: 'bottom-left',
  shortcutKey: 'k',
  maxEntries: 500,
})
```

The package stays installed, so the panels come back when you remove the line. To keep a longer history while chasing a bug that takes many steps to reproduce, raise `maxEntries` instead; each channel keeps that many entries.

### Leave devtools out of a development build

The `kitr()` Vite plugin decides whether the provider is in the bundle at all. Production builds (`kitr build`, `vite build`) never include it. To leave it out in development too, for example while profiling, pass `devtools: false`:

```ts
// vite.config.ts
import { kitr } from 'kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr({ devtools: false })],
})
```

With the provider left out, `getDevtools(app)` returns `null` and every log call is skipped.

## Open the panel

Start the dev server with `kitr dev` and open the app. A round "k" button sits in the bottom-left corner. Click it, or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>, and the panel opens along the bottom of the page.

- The tabs along the top are the panels. A tab's badge shows a count or a state, such as the number of errors in the log.
- The buttons under the tabs are the current panel's actions, such as "Invalidate all queries".
- Drag the top edge to resize the panel. Press the shortcut again, or the close button, to hide it.
- When the panel is closed, a red number on the "k" button counts the errors logged so far.

Keyboard shortcuts:

| Shortcut | What it does |
| --- | --- |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> | Open or close the panel. The key follows `shortcutKey`. |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Open or close the command palette. |
| <kbd>↑</kbd> / <kbd>↓</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd> | Move, run and close in the command palette. |

If <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> clashes with your browser or another tool, pick another key:

```ts
// config/devtools.ts
import { defineConfig } from 'kitr/devtools'

export default defineConfig({
  position: 'bottom-right',
  shortcutKey: 'j',
  maxEntries: 500,
  openByDefault: true,
})
```

## Panels

Three panels are always there. The others appear when their package is installed, because each package's provider contributes its own.

| Panel | Comes from | Shows | Actions |
| --- | --- | --- | --- |
| App | devtools | Mode, environment, boot status and installed packages; every provider with the hooks it implements (`register`, `boot`, `wrap`, `ready`, `shutdown`, `devtools`); every container binding; every config file; public env variables (`VITE_*`, `PUBLIC_*`). | Reload page |
| Router | devtools | The current pathname, search, hash and status; every matched route with its params and loader data; the navigation log. Shows "n/a" without a [router](/packages/router). | Invalidate router (re-run loaders), Navigate to / |
| Log | devtools | Every entry every package logged, newest last, filterable by channel and text. | Clear log |
| Query | [query](/packages/query) | Every cached query with its data and state. | Invalidate all queries, Clear cache |
| Auth | [auth](/packages/auth) | The session and the signed-in user. | Reload session, Refresh token, Sign out |
| Storage | [storage](/packages/storage) | Saved values and cookies. | Clear localStorage, Clear sessionStorage |
| Platform | [platform](/packages/platform) | Platform name, type, OS, whether it is native or standalone, online state, and which driver serves each capability. | |
| Errors | [monitoring](/packages/monitoring) | Every error and message monitoring captured. | Clear errors, Throw a test error |
| Analytics | [analytics](/packages/analytics) | Whether tracking is enabled or queued, the active adapters, and the last 200 calls with their props. | Enable (consent given), Disable, Clear events |

A panel that throws while rendering shows "Panel crashed:" and the error message in its own area. The rest of the overlay and your app keep working.

## Read the log

The Log panel is one timeline for the whole app. Each entry has a time, a channel, a label and optional data you can expand. Pick a channel from the drop-down to see only that package, or type in the filter box to search labels and data.

The channels kitr packages write to:

| Channel | Written by | Example label |
| --- | --- | --- |
| `http` | [http](/packages/http) | `GET /api/orders → 200 (84ms)`; 4xx is a warning, 5xx an error |
| `router` | [router](/packages/router) | `navigated /orders/1042` |
| `query` | [query](/packages/query) | `mutation failed: ["orders","create"]` |
| `auth` | [auth](/packages/auth) | `signed in` |
| `logger` | [logger](/packages/logger) | every log line, at its level |
| `errors`, `breadcrumbs` | [monitoring](/packages/monitoring) | `TypeError: total is undefined` |
| `analytics` | [analytics](/packages/analytics) | `track order.placed` |
| `consent` | [consent](/packages/consent) | `decided` |
| `storage` | [storage](/packages/storage) | `driver: web:local` |
| `platform` | [platform](/packages/platform) | `running as web (macos)` |
| `cache` | [cache](/packages/cache) | `driver: memory` |
| `devtools` | devtools | `ran Clear cache`, or `orders: devtools() failed` |

The `files`, `native`, `notifications`, `offline`, `secure-storage` and `updater` packages log under their own names too.

## Log from your code

To see what your own code does, log to a channel of your own. `getDevtools(app)` returns the hub in development and `null` everywhere else, so the optional call costs nothing in production:

```tsx
// app/features/orders/add-to-cart-button.tsx
import { getDevtools } from 'kitr/devtools'
import { useApp } from 'kitr/react'
import { cart } from './cart'

export function AddToCartButton({ sku }: { sku: string }) {
  const app = useApp()
  return (
    <button
      type="button"
      onClick={() => {
        cart.add(sku, 1)
        getDevtools(app)?.log('orders', `added ${sku}`, { items: cart.items.length })
      }}
    >
      Add to order
    </button>
  )
}
```

Click the button and the Log panel shows a new entry:

```
14:02:31.118  orders  added sku_desk_oak   {1}
```

Expand `{1}` to see `items: 1`. The fourth argument is the level, `'info'` by default:

```ts
// app/features/orders/checkout.ts
import { getDevtools } from 'kitr/devtools'
import type { KitrApp } from 'kitr/app'

export function reportCheckoutProblem(app: KitrApp, orderId: string, reason: string) {
  getDevtools(app)?.log('orders', `checkout blocked for ${orderId}`, { reason }, 'warn')
}
```

Logging is cheap enough to time slow work. Here the checkout logs how long the order request took, as an error when it fails:

```ts
// app/features/orders/place-order.ts
import { getDevtools } from 'kitr/devtools'
import type { KitrApp } from 'kitr/app'

export async function placeOrder(app: KitrApp, orderId: string) {
  const started = performance.now()
  const response = await fetch(`/api/orders/${orderId}/place`, { method: 'POST' })
  const ms = Math.round(performance.now() - started)
  getDevtools(app)?.log(
    'orders',
    `placed ${orderId} in ${ms}ms`,
    { status: response.status },
    response.ok ? 'info' : 'error',
  )
  return response.ok
}
```

| Level | Shown as |
| --- | --- |
| `'debug'` | Grey label. |
| `'info'` | Plain label. The default. |
| `'warn'` | Yellow label. |
| `'error'` | Red label; counted in the Log tab's badge and on the "k" button. |

Don't log with `console.log` and leave it in. Log calls through `getDevtools(app)?.log` are skipped in production without you removing them, and they sit next to the HTTP requests and navigations that caused them.

To check whether devtools is active, for example to skip building a costly debug summary, test the return value once:

```ts
// app/features/orders/debug-summary.ts
import { getDevtools } from 'kitr/devtools'
import type { KitrApp } from 'kitr/app'
import { cart } from './cart'

export function logCartSummary(app: KitrApp) {
  const hub = getDevtools(app)
  if (!hub) return
  const units = cart.items.reduce((sum, item) => sum + item.qty, 0)
  hub.log('orders', `cart has ${cart.items.length} lines, ${units} units`, cart.items, 'debug')
}
```

## Run an action from the command palette

Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>. The palette lists "Open" for every panel, then every action of every panel, labelled with its panel. Type to filter, use the arrow keys to pick, and press <kbd>Enter</kbd> to run.

Each run is logged under the `devtools` channel: `ran Clear cache` at the debug level when it works, `Clear cache failed` with the error at the error level when it throws. Actions you add to your own panels appear in the palette automatically.

## Add a panel

A provider contributes panels through a `devtools(app)` method that returns them. Lazy-import the panel module inside it, so the React code never reaches your main bundle:

```ts
// app/providers/orders.ts
import { defineProvider } from 'kitr/app'

export default defineProvider({
  name: 'orders',
  devtools: () => import('./orders-devtools').then((m) => m.panels()),
})
```

Register the provider in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  // ...
  providers: [
    // ...
    () => import('@kitr/devtools/provider'),
    () => import('#app/providers/orders'),
  ],
})
```

Then write the panel. `definePanel()` gives it types; `KeyValue`, `Badge` and the other parts from `kitr/devtools/ui` match the built-in panels:

```tsx
// app/providers/orders-devtools.tsx
import { definePanel } from 'kitr/devtools'
import { Badge, KeyValue } from 'kitr/devtools/ui'
import { cart } from '#app/features/orders/cart'

export const panels = () => [
  definePanel({
    id: 'orders',
    label: 'Orders',
    badge: () => cart.items.length || null,
    render: () => (
      <div className="kitr-dt-stack">
        <p>
          <Badge tone={cart.items.length ? 'ok' : 'muted'}>{cart.items.length} items</Badge>
        </p>
        <KeyValue rows={cart.items.map((item) => [item.sku, item.qty])} />
      </div>
    ),
    actions: [
      {
        id: 'clear-cart',
        label: 'Empty cart',
        run: (app) => {
          cart.clear()
          app.container.use('devtools').log('orders', 'cart emptied')
        },
      },
    ],
  }),
]
```

Reload the app and an Orders tab appears after the built-in and package panels. The tab's badge shows the item count, and "Empty cart" is a button in the panel and an entry in the command palette. When the provider's `devtools()` method throws, the panel is skipped and the Log shows `orders: devtools() failed` with the error.

What each field does:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique id. A panel registered with an existing id replaces it. |
| `label` | yes | The tab text. |
| `render(app)` | yes | Returns the panel body as a React node. Called on every render of the overlay. |
| `badge(app)` | no | Text or a count next to the label. `null`, `undefined`, `0` and `''` show nothing; a badge that throws is hidden. |
| `actions` | no | Buttons under the tabs and entries in the command palette: `{ id, label, run(app) }`. `run` may return a promise. |

The built-in panels have icons in their tabs; panels you add show the label only.

## Refresh a panel when data changes

The overlay re-renders when the hub changes: a new log entry, a panel added or removed, or a call to `notify()`. Data that changes without a log entry, such as the cart above, needs a `notify()`:

```ts
// app/features/orders/cart.ts
export interface CartItem {
  sku: string
  qty: number
}

const listeners = new Set<() => void>()

export const cart = {
  items: [] as CartItem[],
  add(sku: string, qty: number) {
    const line = cart.items.find((item) => item.sku === sku)
    if (line) line.qty += qty
    else cart.items.push({ sku, qty })
    for (const listener of listeners) listener()
  },
  clear() {
    cart.items = []
    for (const listener of listeners) listener()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
```

```ts
// app/providers/orders.ts
import { defineProvider, getDevtools } from 'kitr/app'
import { cart } from '#app/features/orders/cart'

export default defineProvider({
  name: 'orders',
  boot(app) {
    const hub = getDevtools(app)
    if (!hub) return
    cart.subscribe(() => hub.notify())
  },
  devtools: () => import('./orders-devtools').then((m) => m.panels()),
})
```

`notify()` calls in the same tick are merged into one re-render, so a burst of changes does not redraw the panel a dozen times. `getDevtools(app)` is `null` in production, so the subscription only exists in development.

## Build panel bodies

`kitr/devtools/ui` exports the parts the built-in panels use. They are plain React components with no dependencies:

| Component | Props | Renders |
| --- | --- | --- |
| `JsonView` | `value`, `open?`, `depth?` | Any value as an expandable tree. Dates show as ISO strings, errors as `Name: message`. |
| `KeyValue` | `rows: Array<[string, unknown]>` | A two-column table; each value is a `JsonView`. |
| `LogList` | `entries`, `empty?` | Hub entries with time, channel, label and expandable data. |
| `Badge` | `children`, `tone?` | A pill. Tones: `'ok'`, `'warn'`, `'error'`, `'muted'` (default), `'info'`. |
| `Toolbar` | `children` | A row of buttons. |
| `Button` | `children`, `onClick`, `title?` | A small button. |

`styles` is the overlay's stylesheet as a string, already on the page while the overlay is mounted; class names such as `kitr-dt-stack` and `kitr-dt-h` come from it.

A panel that shows the orders log next to the cart:

```tsx
// app/providers/orders-devtools.tsx
import { definePanel } from 'kitr/devtools'
import { JsonView, LogList } from 'kitr/devtools/ui'
import { cart } from '#app/features/orders/cart'

export const panels = () => [
  definePanel({
    id: 'orders',
    label: 'Orders',
    render: (app) => (
      <div className="kitr-dt-stack">
        <section>
          <h4 className="kitr-dt-h">Cart</h4>
          <JsonView value={cart.items} open />
        </section>
        <section>
          <h4 className="kitr-dt-h">Log</h4>
          <LogList entries={app.container.use('devtools').entries('orders')} empty="No cart changes yet" />
        </section>
      </div>
    ),
  }),
]
```

## Read the hub directly

The hub is bound as `devtools` in the container while devtools is active. Besides `log()` and `notify()`, it can read and clear entries and register panels at run time:

```ts
// app/features/orders/debug.ts
import { getDevtools } from 'kitr/devtools'
import type { KitrApp } from 'kitr/app'

export function ordersLog(app: KitrApp) {
  const hub = getDevtools(app)
  if (!hub) return []
  return hub.entries('orders').map((entry) => `${entry.level} ${entry.label}`)
  // => ['info added sku_desk_oak', 'warn checkout blocked for ord_1042']
}
```

| Member | Description |
| --- | --- |
| `log(channel, label, data?, level?)` | Add an entry. Drops the channel's oldest entry past `maxEntries`. |
| `entries(channel?)` | Entries for one channel, or all of them, oldest first. |
| `clear(channel?)` | Remove one channel's entries, or all of them. |
| `register(panel)` | Add a panel now; returns a function that removes it. Providers use `devtools()` instead. |
| `panels` | The registered panels, in tab order. |
| `subscribe(listener)` | Called after changes, once per tick. Returns the unsubscribe function. |
| `notify()` | Ask the overlay to re-render. |

Use `register()` for a panel that only makes sense while a page is open:

```tsx
// app/routes/_app/orders/$orderId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getDevtools } from 'kitr/devtools'
import { KeyValue } from 'kitr/devtools/ui'
import { useApp } from 'kitr/react'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app/orders/$orderId')({
  component: OrderPage,
})

function OrderPage() {
  const app = useApp()
  const { orderId } = Route.useParams()
  useEffect(() => {
    const hub = getDevtools(app)
    return hub?.register({
      id: 'order-page',
      label: `Order ${orderId}`,
      render: () => <KeyValue rows={[['orderId', orderId]]} />,
    })
  }, [app, orderId])
  return <h1>Order {orderId}</h1>
}
```

The effect returns the function `register()` gave back, so the tab disappears when Ada leaves the page.

## Testing

Devtools is only active in the browser in development, so a test app built with `createTestApp()` has no hub and `getDevtools(app)` returns `null`. Code that logs keeps working in tests and logs nothing. To assert on what your code logs, bind a hub of your own with `createDevtoolsHub()`:

```ts
// app/features/orders/checkout.test.ts
import { createDevtoolsHub, getDevtools } from 'kitr/devtools'
import { createTestApp } from 'kitr/testing'
import { expect, it } from 'vitest'
import { reportCheckoutProblem } from './checkout'

it('logs a blocked checkout as a warning', async () => {
  const app = await createTestApp()
  app.container.value('devtools', createDevtoolsHub({ maxEntries: 50 }))

  reportCheckoutProblem(app, 'ord_1042', 'card declined')

  expect(getDevtools(app)?.entries('orders')).toEqual([
    expect.objectContaining({
      channel: 'orders',
      label: 'checkout blocked for ord_1042',
      data: { reason: 'card declined' },
      level: 'warn',
    }),
  ])
})
```

To check that a provider contributes its panel, boot the real devtools provider in a client app in development mode, and call the panel's action:

```ts
// app/providers/orders.test.ts
import { createApp, getDevtools } from 'kitr/app'
import { devtoolsProvider } from 'kitr/devtools/provider'
import { expect, it } from 'vitest'
import { cart } from '#app/features/orders/cart'
import ordersProvider from './orders'

it('adds the Orders panel and empties the cart', async () => {
  const app = createApp({
    environment: 'client',
    mode: 'development',
    providers: [devtoolsProvider, ordersProvider],
  })
  await app.boot()
  const hub = getDevtools(app)!

  expect(hub.panels.map((p) => p.id)).toEqual(['app', 'router', 'log', 'orders'])

  cart.add('sku_desk_oak', 2)
  const orders = hub.panels.find((p) => p.id === 'orders')!
  expect(orders.badge?.(app)).toBe(1)
  await orders.actions?.find((a) => a.id === 'clear-cart')?.run(app)
  expect(cart.items).toEqual([])
  expect(hub.entries('orders').map((e) => e.label)).toEqual(['cart emptied'])
})
```

Run tests that render the overlay or touch `localStorage` in a DOM environment (`happy-dom` or `jsdom`).

## Extend

Panels follow the `DevtoolsPanel` interface from `kitr/devtools`. A panel is an object, so you can also build one from a function and share it between providers:

```ts
// The interfaces, from kitr/devtools
export interface DevtoolsPanel {
  id: string
  label: string
  badge?: (app: KitrApp) => string | number | null | undefined
  render: (app: KitrApp) => KitrNode
  actions?: DevtoolsAction[]
}

export interface DevtoolsAction {
  id: string
  label: string
  run: (app: KitrApp) => MaybePromise<void>
}
```

This helper turns any log channel into its own panel, with a clear action:

```tsx
// app/devtools/channel-panel.tsx
import { type DevtoolsPanel, definePanel } from 'kitr/devtools'
import { LogList } from 'kitr/devtools/ui'

export function channelPanel(channel: string, label: string): DevtoolsPanel {
  return definePanel({
    id: `channel-${channel}`,
    label,
    badge: (app) => app.container.use('devtools').entries(channel).length || null,
    render: (app) => <LogList entries={app.container.use('devtools').entries(channel)} />,
    actions: [
      {
        id: `clear-${channel}`,
        label: `Clear ${label}`,
        run: (app) => app.container.use('devtools').clear(channel),
      },
    ],
  })
}
```

Return it from any provider's `devtools()` method:

```ts
// app/providers/invoices.ts
import { defineProvider } from 'kitr/app'

export default defineProvider({
  name: 'invoices',
  devtools: () =>
    import('#app/devtools/channel-panel').then((m) => [m.channelPanel('invoices', 'Invoices')]),
})
```

See [`DevtoolsPanel`](/packages/devtools/api#devtoolspanel) and [`DevtoolsHub`](/packages/devtools/api#devtoolshub) in the API reference.

## Next steps

- [API reference](/packages/devtools/api) for every export and type.
- [Configuration](/docs/configuration) for providers and `kitrrc.ts`, where panels are registered.
- [Analytics](/packages/analytics) and [monitoring](/packages/monitoring), whose panels show what would be sent.
- [Logger](/packages/logger), whose output lands in the Log panel.
- [TanStack Router devtools](https://tanstack.com/router/latest/docs/framework/react/devtools) and [TanStack Query devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) for deeper views of each library.
