---
title: Devtools
description: Open a panel that shows what every package is doing. On in development; turn it on in production with one flag.
order: 1
---

# Devtools

When a page shows stale data or a button does nothing, you want to see which route matched, what is cached, who is signed in and which request failed. `@kitr/devtools` shows that in the page itself: in development, click the small "k" button in a corner to open the panel.

> [!SUMMARY]
> A panel inside your running app that shows routes, cache, session, requests and your own log lines. Add it with `kitr add devtools`; the overview is at [/packages/devtools](/packages/devtools).

It runs in the browser only, and the `kitr()` Vite plugin leaves it out of production builds unless you set `enabled: true`. For React component trees and network timing, keep using [React Developer Tools](https://react.dev/learn/react-developer-tools) and your browser's devtools.

The examples follow one scenario: Acme's app at `app.acme.com` has a cart, and Ada wants to see what is in it, log each change and empty it from a button.

## Install

```sh
kitr add devtools
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/devtools`.
- Adds `() => import('@kitr/devtools/provider')` to `providers` and `'@kitr/devtools'` to `packages` in `kitrrc.ts`.
- Writes `config/devtools.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: devtools` section to `AGENTS.md` telling coding agents how to open the overlay, to log with `getDevtools(app)?.log(...)`, and to add panels through a provider's `devtools()` method with the parts in `@kitr/devtools/ui`.

`kitr add devtools` asks no questions and adds no env variables. Every kit except `blank` and `server` includes it.

`kitr remove devtools` undoes all of this and deletes `config/devtools.ts`. Calls to `getDevtools(app)?.log(...)` can stay: without the package they return `null`. Panels in your own providers stay but are never shown.

</details>

> [!WARNING] Client packages only
> In a server-only project `kitr add devtools` prints a warning and skips it.

## Configure

`kitr add devtools` writes this file:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  // Default: development only. true also ships it in production builds.
  // enabled: true,
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | on in development | `true` turns it on in production too. `false` turns it off without removing the package. |
| `position` | `'bottom-left'` | The corner for the "k" button: `'bottom-left'`, `'bottom-right'`, `'top-left'` or `'top-right'`. |
| `shortcutKey` | `'k'` | The key that toggles the panel together with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd>. |
| `maxEntries` | `500` | Log entries kept per channel. When a channel is full, its oldest entry is dropped. |
| `openByDefault` | `false` | Open the panel on first load. After that, the panel remembers whether you left it open. |

The panel remembers its open tab and height in `localStorage` under `kitr:devtools`; delete that key to start fresh.

### Turn it off without removing it

Set `enabled: false` to hide the overlay and stop binding the hub, for example while you record a demo. The package stays installed:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  enabled: false,
  position: 'bottom-left',
  shortcutKey: 'k',
  maxEntries: 500,
})
```

### Turn it on in production

Set `enabled: true` and production builds include the panel:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  enabled: true,
})
```

To decide at runtime, use an expression such as `enabled: import.meta.env.VITE_DEBUG === '1'`. The panel ships in the build and shows only when the expression is true.

### Leave devtools out of a development build

Production builds leave the provider out unless `config/devtools.ts` sets `enabled`. To leave it out in development too, for example while profiling, pass `devtools: false`:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr({ devtools: false })],
})
```

## Open the panel

Run `kitr dev` and open the app. Click the round "k" button in the bottom-left corner, or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>.

- Tabs along the top are the panels; a badge shows a count or state, such as errors in the log.
- Buttons under the tabs are the panel's actions, such as "Invalidate all queries".
- Drag the top edge to resize. When the panel is closed, a red number on the "k" button counts logged errors.

Keyboard shortcuts:

| Shortcut | What it does |
| --- | --- |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> | Open or close the panel. The key follows `shortcutKey`. |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Open or close the command palette. |
| <kbd>↑</kbd> / <kbd>↓</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd> | Move, run and close in the command palette. |

If the shortcut clashes with your browser or another tool, pick another key:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

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
| App | devtools | Mode, packages, providers, container bindings, config and public env variables. | Reload page |
| Router | devtools | The current pathname, search, hash and status; every matched route with its params and loader data; the navigation log. Shows "n/a" without a [router](/packages/router). | Invalidate router (re-run loaders), Navigate to / |
| Log | devtools | Every entry every package logged, newest last, filterable by channel and text. | Clear log |
| Query | [query](/packages/query) | Every cached query with its data and state. | Invalidate all queries, Clear cache |
| Auth | [auth](/packages/auth) | The session and the signed-in user. | Reload session, Refresh token, Sign out |
| Storage | [storage](/packages/storage) | Saved values and cookies. | Clear localStorage, Clear sessionStorage |
| Platform | [platform](/packages/platform) | Platform name, type, OS, whether it is native or standalone, online state, and which driver serves each capability. | |
| Errors | [monitoring](/packages/monitoring) | Every error and message monitoring captured. | Clear errors, Throw a test error |
| Analytics | [analytics](/packages/analytics) | Whether tracking is enabled or queued, the active adapters, and the last 200 calls with their props. | Enable (consent given), Disable, Clear events |

A panel that throws while rendering shows "Panel crashed:" and the error in its own area; the rest keeps working.

## Read the log

The Log panel is one timeline for the whole app. Each entry has a time, a channel, a label and expandable data. Filter by channel or search labels and data.

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

The `files`, `native`, `notifications`, `offline`, `secure-storage` and `updater` packages log under their own names.

## Log from your code

Log to a channel of your own. `getDevtools(app)` returns the hub when devtools is on and `null` otherwise, so the optional call costs nothing in production:

```tsx
// app/components/orders/add-to-cart-button.tsx
import { getDevtools } from '@kitr/devtools'
import { useApp } from '@kitr/react'
import { cart } from '#app/lib/orders/cart'

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

Clicking the button adds an entry to the Log panel:

```
14:02:31.118  orders  added sku_desk_oak   {1}
```

The fourth argument is the level, `'info'` by default:

```ts
// app/lib/orders/checkout.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from 'kitr/app'

export function reportCheckoutProblem(app: KitrApp, orderId: string, reason: string) {
  getDevtools(app)?.log('orders', `checkout blocked for ${orderId}`, { reason }, 'warn')
}
```

Log how long a slow request took, as an error when it fails:

```ts
// app/lib/orders/place-order.ts
import { getDevtools } from '@kitr/devtools'
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

> [!WARNING] Prefer the hub to console.log
> `getDevtools(app)?.log` calls are skipped in production without removal, and sit next to the requests and navigations that caused them.

To skip building a costly debug summary when devtools is off, test the return value once:

```ts
// app/lib/orders/debug-summary.ts
import { getDevtools } from '@kitr/devtools'
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

Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>. The palette lists "Open" for every panel, then every panel action. Type to filter, pick with the arrow keys, and press <kbd>Enter</kbd>.

Each run is logged under the `devtools` channel, as an error if it throws. Actions on your own panels appear automatically.

## Add a panel

A provider contributes panels through a `devtools(app)` method. Lazy-import the panel module so the React code stays out of your main bundle:

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

Then write the panel. `definePanel()` gives it types; `KeyValue`, `Badge` and the other parts from `@kitr/devtools/ui` match the built-in panels:

```tsx
// app/providers/orders-devtools.tsx
import { definePanel } from '@kitr/devtools'
import { Badge, KeyValue } from '@kitr/devtools/ui'
import { cart } from '#app/lib/orders/cart'

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

Reload and an Orders tab appears, with the item count as its badge. "Empty cart" is a button and a palette entry. If `devtools()` throws, the panel is skipped and the Log shows `orders: devtools() failed`.

What each field does:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique id. A panel registered with an existing id replaces it. |
| `label` | yes | The tab text. |
| `render(app)` | yes | Returns the panel body as a React node. Called on every render of the overlay. |
| `badge(app)` | no | Text or a count next to the label. `null`, `undefined`, `0` and `''` show nothing; a badge that throws is hidden. |
| `actions` | no | Buttons under the tabs and entries in the command palette: `{ id, label, run(app) }`. `run` may return a promise. |

## Refresh a panel when data changes

The overlay re-renders on a new log entry, a panel change or a call to `notify()`. Data that changes without a log entry, such as the cart, needs `notify()`:

```ts
// app/lib/orders/cart.ts
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
import { cart } from '#app/lib/orders/cart'

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

`notify()` calls in the same tick merge into one re-render. `getDevtools(app)` is `null` in production, so the subscription exists only in development.

## Build panel bodies

`@kitr/devtools/ui` exports the plain React components the built-in panels use:

| Component | Props | Renders |
| --- | --- | --- |
| `JsonView` | `value`, `open?`, `depth?` | Any value as an expandable tree. Dates show as ISO strings, errors as `Name: message`. |
| `KeyValue` | `rows: Array<[string, unknown]>` | A two-column table; each value is a `JsonView`. |
| `LogList` | `entries`, `empty?` | Hub entries with time, channel, label and expandable data. |
| `Badge` | `children`, `tone?` | A pill. Tones: `'ok'`, `'warn'`, `'error'`, `'muted'` (default), `'info'`. |
| `Toolbar` | `children` | A row of buttons. |
| `Button` | `children`, `onClick`, `title?` | A small button. |

Class names such as `kitr-dt-stack` and `kitr-dt-h` come from the overlay's stylesheet, already on the page. A panel that shows the orders log next to the cart:

```tsx
// app/providers/orders-devtools.tsx
import { definePanel } from '@kitr/devtools'
import { JsonView, LogList } from '@kitr/devtools/ui'
import { cart } from '#app/lib/orders/cart'

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

The hub is bound as `devtools` in the container while devtools is active. It can also read and clear entries and register panels at run time:

```ts
// app/lib/orders/debug.ts
import { getDevtools } from '@kitr/devtools'
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

<details>
<summary>Register a panel only while a page is open</summary>

Use `register()` for a panel that only makes sense on one page:

```ts
// app/routes.ts
app.page('/orders/$orderId', { lazy: () => import('./pages/orders/orderId') })
```

```tsx
// app/pages/orders/orderId.tsx
import { getDevtools } from '@kitr/devtools'
import { KeyValue } from '@kitr/devtools/ui'
import { useApp } from '@kitr/react'
import { useEffect } from 'react'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/_app/orders/$orderId')

export default function OrderPage() {
  const app = useApp()
  const { orderId } = route.useParams()
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

</details>

## Testing

A test app built with `createTestApp()` has no hub, so `getDevtools(app)` returns `null` and logging does nothing. To assert on what your code logs, bind a hub with `createDevtoolsHub()`:

```ts
// app/lib/orders/checkout.test.ts
import { createDevtoolsHub, getDevtools } from '@kitr/devtools'
import { createTestApp } from '@kitr/testing'
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

To check that a provider contributes its panel, boot the devtools provider in a development client app and call the panel's action:

```ts
// app/providers/orders.test.ts
import { createApp, getDevtools } from 'kitr/app'
import { devtoolsProvider } from '@kitr/devtools/provider'
import { expect, it } from 'vitest'
import { cart } from '#app/lib/orders/cart'
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

A panel is a plain object following `DevtoolsPanel`, so you can build one from a function and share it:

```ts
// The interfaces, from @kitr/devtools
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
import { type DevtoolsPanel, definePanel } from '@kitr/devtools'
import { LogList } from '@kitr/devtools/ui'

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

- [API reference](/packages/devtools/api): every export and type.
- [Configuration](/docs/configuration): providers and `kitrrc.ts`, where panels are registered.
- [Logger](/packages/logger): its output lands in the Log panel.
