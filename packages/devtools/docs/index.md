---
title: Devtools
description: A panel that shows what every package is doing, opened by a button, a shortcut or a gesture. On in development; one flag ships it.
order: 1
---

# Devtools

When a page shows stale data or a button does nothing, you want to see which route matched, what is cached, who is signed in and which request failed. `@kitr/devtools` shows that in the page itself, on a laptop and on the phone in your hand: in development, a small round button floats in a corner, and a tap opens a window with one tab per package.

> [!SUMMARY]
> A window inside your running app that shows routes, requests, cache, session, storage and your own log lines, as a dock on a desktop and a sheet on a phone. Add it with `kitr add devtools`; the overview is at [/packages/devtools](/packages/devtools).

It runs in the browser only, and the `kitr()` Vite plugin leaves it out of production builds unless you set `enabled: true`. For React component trees and CPU profiles, keep using [React Developer Tools](https://react.dev/learn/react-developer-tools) and your browser's devtools.

The examples follow one scenario: Acme's app at `app.acme.com` has a cart, and Ada wants to see what is in it, log each change and empty it from a menu.

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
- Adds a `## kitr: devtools` section to `AGENTS.md` telling coding agents how to open the window, to log with `getDevtools(app)?.log(...)`, and to add panels through a provider's `devtools()` method with the parts in `@kitr/devtools/ui`.

`kitr add devtools` asks no questions and adds no env variables. The `desktop`, `mobile` and `tauri` kits include it.

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
  trigger: 'auto', // 'auto' | 'hover' | 'hidden'
  position: 'bottom-left', // where the trigger starts; it can be dragged
  dock: 'bottom', // 'bottom' | 'right' on desktop
  theme: 'auto', // 'auto' | 'light' | 'dark'
  shortcut: 'k', // ctrl/cmd+shift+<key>, or a full combo such as ['Meta', 'Shift', 'K']
  touchGesture: true, // three-finger long press on touch screens
  urlFlag: 'kitr-devtools', // ?kitr-devtools opens it even when the trigger is hidden
  maxEntries: 500,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | on in development | `true` turns it on in production too. `false` turns it off without removing the package. |
| `trigger` | `'auto'` | The floating button: `'auto'` shows it, `'hover'` shows a thin edge tab until the pointer is near, `'hidden'` removes it. |
| `position` | `'bottom-left'` | Where the button starts: `'bottom-left'`, `'bottom-right'`, `'top-left'` or `'top-right'`. Dragging it overrides this. |
| `dock` | `'bottom'` | The edge the window docks to on desktop: `'bottom'` or `'right'`. Phones always use a bottom sheet. |
| `theme` | `'auto'` | `'auto'` follows `data-theme` on `<html>` when it is `light` or `dark`, then the system. `'light'` and `'dark'` force one. |
| `shortcut` | `'k'` | A key that toggles the window with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd>, or an array for a full combination. |
| `touchGesture` | `true` | A three-finger long press on a touch screen toggles the window. `false` turns the gesture off. |
| `urlFlag` | `'kitr-devtools'` | A query parameter that opens the window on load, even with `trigger: 'hidden'`. `false` disables it. |
| `maxEntries` | `500` | Log entries kept per channel. When a channel is full, its oldest entry is dropped. |
| `openByDefault` | `false` | Open the window on first load. After that, it remembers whether you left it open. |

The window also remembers, per browser, the tab you had open, the dock side, the size you dragged it to, the sheet height on a phone, where you left the button, a theme you picked in the palette and your recent palette commands. They live in `localStorage` under `kitr:devtools`; the Log tab keeps its filters under `kitr:devtools:log`. Delete both keys to start fresh. "Hide for this session" lives in `sessionStorage`, so it ends when the tab closes.

### Choose the shortcut

A single string is the key pressed with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> and <kbd>Shift</kbd>. An array is the whole combination, where `'Meta'` means <kbd>Ctrl</kbd> or <kbd>Cmd</kbd>, so it works on every platform:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  position: 'bottom-right',
  shortcut: ['Meta', 'Alt', 'D'],
  maxEntries: 500,
  openByDefault: true,
})
```

The window now toggles on <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Alt</kbd> + <kbd>D</kbd>. Modifier names are `Meta`, `Ctrl`, `Shift` and `Alt`; the last entry is the key. If <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> clashes with your browser or another tool, this is the fix.

### Hide the button but keep the window

On a marketing page or in a screen recording, the floating button gets in the way. Set `trigger: 'hidden'` and open the window with the shortcut, the touch gesture or the URL flag:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  trigger: 'hidden',
  urlFlag: 'debug',
})
```

Opening `https://app.acme.com/orders?debug` now opens the window on load. That is the way to open devtools on a phone that has no keyboard: send Ada's QA team the link with the flag. Use `trigger: 'hover'` to keep a 6 pixel tab on the edge that grows into the button when the pointer comes near.

### Turn it off without removing it

Set `enabled: false` to hide the window and stop binding the hub, for example while you record a demo of `app.acme.com`:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  enabled: false,
})
```

The package stays installed, so the panels come back when you remove the line.

### Turn it on in production

Set `enabled: true` and production builds include the window:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  enabled: true,
  trigger: 'hidden',
})
```

To decide at runtime, use an expression such as `enabled: import.meta.env.VITE_DEBUG === '1'`. The window ships in the build and shows only when the expression is true. With `trigger: 'hidden'`, your users never see a button; you open it with the shortcut or the URL flag. To keep a longer history while chasing a bug that takes many steps to reproduce, raise `maxEntries` instead; each channel keeps that many entries.

> **Warning**: Devtools shows config, public env variables, request headers and stored values from the page it runs on. Authorization and cookie headers are redacted and secrets are masked, but a window left open in production still shows your users' data to whoever holds the device.

### Leave devtools out of a development build

The `kitr()` Vite plugin decides whether the provider is in the bundle at all. Production builds (`kitr build`, `vite build`) leave it out unless `config/devtools.ts` sets `enabled`. To leave it out in development too, for example while profiling, pass `devtools: false`:

```ts
// vite.config.ts
import { kitr } from '@kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr({ devtools: false })],
})
```

With the provider left out, `getDevtools(app)` returns `null` and every log call is skipped.

## Open the panel

Start the dev server with `kitr dev` and open the app. A round button sits in the bottom-left corner. Everything below opens the same window; pick the one that fits the device in your hand.

| Way | Where | Notes |
| --- | --- | --- |
| The round button | Any screen | Tap or click it. Drag it to move it. Press and hold for its menu. |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> | Keyboards | Toggles the window. The key follows `shortcut`. |
| Three-finger long press | Touch screens | Hold three fingers on the page for about 0.6 seconds. Moving or lifting a finger cancels it. Set `touchGesture: false` to turn it off. |
| `?kitr-devtools` in the URL | Any screen | Opens the window on load and shows the button again if you hid it for the session. Follows `urlFlag`. |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Keyboards | Opens the command palette, even with the window closed. |

### The button

The button is draggable. Drop it anywhere and it snaps to the nearest side edge, stays clear of the notch and the home indicator, and remembers its place. A small number on it counts the errors logged since you last opened the window. It is 36 pixels wide on desktop and 44 on a phone, so it is easy to hit.

Press and hold it for half a second, without moving, and a menu offers two things:

- **Hide for this session** removes the button until the tab closes. The shortcut, the gesture and the URL flag still open the window.
- **Reset position** puts the button back at `position`.

### The window

On desktop the window is a dock at the bottom of the page, or at the right when `dock` is `'right'`. Drag its edge to resize it; it keeps one size per side. With the edge focused, <kbd>↑</kbd> and <kbd>↓</kbd> (or <kbd>←</kbd> and <kbd>→</kbd> for a right dock) resize it in steps. The dock button in the header, or "Dock right" in the palette, switches sides.

On a phone it is a bottom sheet; see [On a phone](#on-a-phone). Which layout you get depends on the screen: a viewport up to 640 pixels wide, or a touch screen up to 500 pixels tall (a phone on its side), uses the sheet. Everything else uses the dock.

The theme follows the page. With `theme: 'auto'` the window reads `data-theme="light"` or `"dark"` on `<html>`, so it matches a theme switcher in your app, and falls back to the system setting when the attribute is missing or has another value. "Toggle theme" in the palette overrides it and remembers the choice.

### The header

The header stays visible while the body scrolls.

- **Tabs**, one per panel, each with an icon and a label. A badge shows a count or a state. On desktop, tabs that do not fit collapse into a "+N" menu; the active tab always stays visible. On a phone the strip scrolls sideways.
- **Unread counts.** A warning or error that arrives while its panel is not on screen adds a yellow or red number to that tab. Viewing the tab clears it. The Log tab counts everything, Network counts `http` entries, and a panel you add counts entries logged to a channel named like its id.
- **The ⋯ menu** lists the current panel's actions, such as "Invalidate all" on Query. It is a menu on desktop and an action sheet on a phone. Destructive actions are red.
- **The ⌘ button** opens the command palette.
- **The dock button** switches between bottom and right (desktop only).
- **The × button** closes the window.

Press <kbd>Esc</kbd> to close the topmost layer: an open menu first, then the palette, then the window. Closing the window returns keyboard focus to the button.

## On a phone

On a phone there is no keyboard and little room, so the window is built for a thumb.

- **Open it** with the round button, a three-finger long press anywhere on the page, or a link that ends in `?kitr-devtools`.
- **Drag the handle** at the top of the sheet. The sheet has two heights: half the visible screen and almost all of it. Drag up past the middle, or flick up, to go full; drag down, or flick down, to go back to half. Drag it down by about 80 pixels below half, and it closes.
- **Open the keyboard** in the Log search or the palette and the sheet shrinks to the space that is left, so the input stays visible.
- **Scroll the tabs** sideways in the header. The ⌘ and × buttons stay put. Tabs that are off screen are also in the palette under Panels.
- **Press and hold a log row** for its menu. It is the touch version of a right-click.
- **Tap targets** are at least 44 pixels, and the sheet keeps clear of the notch and the home indicator.

Ada tests the cart on her phone this way: she opens `https://app.acme.com/orders?kitr-devtools`, drags the sheet to full height, opens the Log tab and taps "Add to order" in the page behind it. The page stays visible above the half-height sheet, so she watches the entry arrive.

## Panels

Three panels are always there. The others appear when their package is installed, because each package's provider contributes its own. Tabs are ordered by group: app, data, platform, then custom panels, each in registration order.

| Panel | Comes from | Shows | Actions |
| --- | --- | --- | --- |
| App | devtools | Stats, providers, container bindings, config and public env variables. | Reload, Copy state |
| Router | devtools | The location, the matched route chain, the route tree and the navigation marks. | Invalidate, Back, Home |
| Log | devtools | Every entry every package logged, with filters, search and a row menu. | Clear |
| Network | [http](/packages/http) | Each request with status, timing, headers and a body preview. | Clear |
| Query | [query](/packages/query) | Every cached query with its data and state. | Invalidate all, Clear cache |
| Auth | [auth](/packages/auth) | The session and the signed-in user. | Reload, Refresh, Sign out |
| Storage | [storage](/packages/storage) | Saved values and cookies, with edit and remove. | Clear local, Clear session |
| Errors | [monitoring](/packages/monitoring) | Every error and message monitoring captured. | Clear, Test error |
| Analytics | [analytics](/packages/analytics) | Whether tracking is enabled or queued, the adapters and the recent calls. | Enable, Disable, Clear |
| Platform | [platform](/packages/platform) | The platform, OS, online state and which driver serves each capability. | |

A panel that throws while rendering shows its error message with a Retry button in its own area. The rest of the window and your app keep working. A panel with nothing to show, such as Router without a [router](/packages/router), shows a short empty state or hides itself.

### App

Stats at the top give the mode, environment, status, platform and the number of providers and packages. Below, Providers lists each provider with the lifecycle hooks it has (`register`, `boot`, `ready`, `devtools` and so on) and its config. Container lists every binding by key. Config and Env are collapsed to start with. Env shows only `VITE_` and `PUBLIC_` variables, and any name containing `KEY`, `SECRET`, `TOKEN` or `PASSWORD` is masked until you press "show".

"Copy state" puts the mode, providers and config on the clipboard as JSON, which is handy in a bug report.

### Router

Stats show the path, the status and the number of matches. Matches is the chain of routes that rendered the page, each with its status, params and loader data; a failed match shows its error. Search appears when the URL has search params. Routes is the whole route tree with the active routes highlighted; tap a route to navigate to it (routes with `$` params cannot be opened without a value). Navigation lists the dividers the router added to the log for each navigation.

### Network

Network needs [`@kitr/http`](/packages/http). It lists each request with its method, URL, status and time in milliseconds. Tap a request to see its request and response headers and a preview of the body. The `Authorization` and `Cookie` headers are redacted before they are stored. "Copy as curl" puts a command for the request on the clipboard, without the redacted headers, so you add your own token to replay it. Requests that fail before a response arrives, such as a dropped connection, appear in the Log with the error.

### Query, Auth, Storage, Errors, Analytics and Platform

- **Query** shows the cache: filter chips for fetching, stale, fresh, inactive and error, and a row per key with its state and data. Each row has Invalidate, Refetch and Remove buttons.
- **Auth** shows the status, how long the token has left and the user, with the token masked. "Sign out" is red because it ends the session.
- **Storage** shows `localStorage`, `sessionStorage` and cookies. Open a row to edit its value and press Save, or Remove to delete the key.
- **Errors** shows what [monitoring](/packages/monitoring) captured. "Test error" throws one in a timeout so you can see the pipeline work.
- **Analytics** shows whether tracking is enabled or queued, the adapters and every call with its props.
- **Platform** shows the platform, type, OS, online state, safe area and which driver backs each capability.

Packages decide what their panel shows; the guide of each package has the details under its own Devtools heading.

## Read the log

The Log panel is one timeline for the whole app. It is the place to start when you do not know where something went wrong.

- **Level chips** (`debug`, `info`, `warn`, `error`) each show how many entries they hold. Tap a chip to hide or show that level.
- **Channel chips** appear for every channel that has logged. Tap one to show only that channel; tap more to add them. Tap a channel name on a row to filter to it.
- **Search** matches the channel, the label and the data of each entry.
- **Follow** keeps the newest entry in view. Scroll up and it switches itself off; tap it to jump back to the end.
- **Relative** swaps clock times for offsets from the first visible entry, such as `+4.2s`, which makes it easy to see how long things took.
- **Clear** removes the visible channels' entries, or everything when no channel is selected.
- **Bursts** collapse. When the same entry (channel, level, label and data) arrives again within 50 milliseconds, the row gets a count, such as `×12`, instead of twelve rows.
- **Marks** are dividers. The router adds one for each navigation, and you can add your own with `mark()`.
- **Older entries.** The panel shows the newest 300 rows; "+N older" loads more.

Press and hold a row, or right-click it, for a menu: Copy puts the entry on the clipboard as JSON, "Only this channel" and "Hide this channel" change the channel filters. Your level, channel, Follow and Relative choices are remembered.

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
| `devtools` | devtools | `ran Reload`, or `orders: devtools() failed` |

The `files`, `native`, `notifications`, `offline`, `secure-storage` and `updater` packages log under their own names too.

## Log from your code

To see what your own code does, log to a channel of your own. `getDevtools(app)` returns the hub when devtools is on and `null` otherwise, so the optional call costs nothing in production:

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

Click the button and the Log panel shows a new entry:

```
14:02:31.118  orders  added sku_desk_oak   {1}
```

Expand `{1}` to see `items: 1`. The fourth argument is the level, `'info'` by default:

```ts
// app/lib/orders/checkout.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from '@kitr/kitr/app'

export function reportCheckoutProblem(app: KitrApp, orderId: string, reason: string) {
  getDevtools(app)?.log('orders', `checkout blocked for ${orderId}`, { reason }, 'warn')
}
```

Logging is cheap enough to time slow work. Here the checkout logs how long the order request took, as an error when it fails:

```ts
// app/lib/orders/place-order.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from '@kitr/kitr/app'

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
| `'warn'` | Yellow label; counts as unread on the tab it belongs to. |
| `'error'` | Red label; counted in the Log tab's badge and on the round button. |

To split a long log into stretches, drop a divider with `mark()`. The router does this on every navigation; do it before a step you want to find again:

```ts
// app/lib/orders/checkout.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from '@kitr/kitr/app'

export function startCheckout(app: KitrApp, orderId: string) {
  getDevtools(app)?.mark(`checkout ${orderId}`)
  // ...
}
```

The Log shows a labelled line across the list, so everything under it came after the click. Marks ignore the level and channel filters.

> [!WARNING] Prefer the hub to console.log
> `getDevtools(app)?.log` calls are skipped in production without removal, and sit next to the requests and navigations that caused them.

To check whether devtools is active, for example to skip building a costly debug summary, test the return value once:

```ts
// app/lib/orders/debug-summary.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from '@kitr/kitr/app'
import { cart } from './cart'

export function logCartSummary(app: KitrApp) {
  const hub = getDevtools(app)
  if (!hub) return
  const units = cart.items.reduce((sum, item) => sum + item.qty, 0)
  hub.log('orders', `cart has ${cart.items.length} lines, ${units} units`, cart.items, 'debug')
}
```

## Run an action from the command palette

Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>, or the ⌘ button in the header. The palette works with the window closed. On a phone it is a sheet above the keyboard.

Type to search. The search is fuzzy: `cq` finds "Clear cache", and matches at the start of words rank higher. Without a query the palette shows these groups:

| Group | Contents |
| --- | --- |
| Recent | The last five actions and commands you ran. |
| Panels | One entry per panel. Choosing it opens the window on that tab. |
| One group per panel | That panel's actions, such as "Invalidate all" under Query, with each action's `hint` next to it. |
| Devtools | "Toggle theme", "Dock right" or "Dock bottom" (desktop), and "Hide trigger for this session". |

Use <kbd>↑</kbd> and <kbd>↓</kbd> to move, <kbd>Enter</kbd> to run and <kbd>Esc</kbd> to close. Destructive actions are red.

Each run is logged under the `devtools` channel: `ran Clear cache` at the debug level when it works, `Clear cache failed` with the error at the error level when it throws. When an action returns a string, that string is logged instead, at the info level. Actions you add to your own panels appear in the palette automatically.

## Add a panel

A provider contributes panels through a `devtools(app)` method that returns them. Lazy-import the panel module inside it, so the React code never reaches your main bundle:

```ts
// app/providers/orders.ts
import { defineProvider } from '@kitr/kitr/app'

export default defineProvider({
  name: 'orders',
  devtools: () => import('./orders-devtools').then((m) => m.panels()),
})
```

Register the provider in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'

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

Reload the app and an Orders tab appears after the built-in and package panels. The tab's badge shows the item count, and "Empty cart" is an entry in the tab's ⋯ menu and in the command palette. When the provider's `devtools()` method throws, the panel is skipped and the Log shows `orders: devtools() failed` with the error.

A package that ships panels without depending on `@kitr/devtools` takes the same parts from the second argument of `devtools()` instead of importing them, so a project that leaves devtools out still builds. `@kitr/http`, `@kitr/query` and the other kitr packages do this:

```ts
// packages/orders/src/provider.ts
devtools: (app, ui) => import('./devtools').then((m) => m.panels(ui)),
```

```tsx
// packages/orders/src/devtools.tsx
import type { DevtoolsPanel, DevtoolsUi } from '@kitr/core'

export function panels(ui: DevtoolsUi): DevtoolsPanel[] {
  const { Badge, KeyValue } = ui as typeof import('@kitr/devtools/ui')
  // ...
}
```

A panel can also say how it looks and where it sits. This version has an SVG icon, joins the data group and shows a tone on its badge:

```tsx
// app/providers/orders-devtools.tsx
import { definePanel } from '@kitr/devtools'
import { cart } from '#app/lib/orders/cart'

export const panels = () => [
  definePanel({
    id: 'orders',
    label: 'Orders',
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <title>Orders</title>
        <path d="M3 4h2l2 12h11l2-8H6" />
      </svg>
    ),
    group: 'data',
    badge: () => (cart.items.length ? { value: cart.items.length, tone: 'info' } : null),
    render: () => <p>{cart.items.length} items</p>,
    actions: [
      {
        id: 'clear-cart',
        label: 'Empty cart',
        hint: 'removes every line',
        danger: true,
        when: () => cart.items.length > 0,
        run: () => {
          const lines = cart.items.length
          cart.clear()
          return `emptied ${lines} lines`
        },
      },
    ],
  }),
]
```

The action is red, hidden while the cart is empty, and its returned string lands in the Log as `emptied 2 lines`.

What each field does:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique id. A panel registered with an existing id replaces it. |
| `label` | yes | The tab text. |
| `render(app)` | yes | Returns the panel body as a React node. It is mounted as a component, so `useState` and effects work. |
| `icon` | no | Any React node, such as an inline SVG, or an icon element from [hugeicons](https://hugeicons.com). Shown in the tab. |
| `group` | no | `'app'`, `'data'`, `'platform'` or `'custom'` (the default). Tabs sort by group, then by registration. |
| `badge(app)` | no | A string, a count, or `{ value, tone }`. `null`, `undefined`, `0` and `''` show nothing; a badge that throws is hidden. |
| `actions` | no | Entries in the ⋯ menu and the command palette. See the next table. |

Each action takes these fields:

| Field | Required | Description |
| --- | --- | --- |
| `id`, `label` | yes | The label is one to three words. Put the detail in `hint`. |
| `hint` | no | Secondary text next to the label in the palette, such as `removes every line`. |
| `icon` | no | A hugeicons icon. |
| `danger` | no | Shows the action in red. |
| `when(app)` | no | Return `false` to hide the action. Read on every render; a throw hides it. |
| `run(app)` | yes | May be async. A returned string is logged as the result. A throw is logged as an error. |

Keep a panel's body free of explanation. The window has little room, so a panel shows values and short labels, and the explanation lives in your package's guide.

## Refresh a panel when data changes

The window re-renders when the hub changes: a new log entry, a panel added or removed, or a call to `notify()`. Panels are components, so `render` can also use hooks. The hub's `version` goes up on every change, which is what `useSyncExternalStore` needs. Data that changes without a log entry, such as the cart above, needs a `notify()`:

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
import { defineProvider } from '@kitr/kitr/app'
import { getDevtools } from '@kitr/devtools'
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

`notify()` calls in the same frame are merged into one re-render, so a burst of changes does not redraw the panel a dozen times. `getDevtools(app)` is `null` in production, so the subscription only exists in development.

## Build panel bodies

`@kitr/devtools/ui` exports the parts the built-in panels use. They are plain React components, and they match the window's look and its dark theme:

| Export | Props | Renders |
| --- | --- | --- |
| `JsonView` | `value`, `open?`, `depth?` | Any value as an expandable tree. Dates show as ISO strings, errors as `Name: message`. |
| `KeyValue` | `rows: Array<[string, unknown]>` | A two-column table; each value is a `JsonView`. |
| `Badge` | `children`, `tone?` | A pill. Tones: `'ok'`, `'warn'`, `'error'`, `'muted'` (default), `'info'`. |
| `Button` | `children`, `onClick`, `icon?`, `danger?`, `title?`, `disabled?` | A small button, red when `danger`. |
| `Toolbar` | `children` | A row of controls that wraps on narrow screens. |
| `LogList` | `entries`, `empty?`, `relative?`, `onChannel?` | Hub entries with time, channel, label, count and expandable data. Marks show as dividers. |
| `Chip`, `Chips` | `on?`, `tone?`, `count?`, `icon?`, `onClick?` | Toggle chips for filters, in a wrapping row. |
| `Stat`, `Stats` | `label`, `value`, `tone?` | Big-number tiles in a row. |
| `Section` | `title`, `count?`, `open?` | A collapsible group with a heading. |
| `Row` | `head`, `open?` | An expandable row: a head line you tap, details underneath. |
| `Empty` | `children`, `code?` | The empty state, with an optional snippet. |
| `Masked` | `value` | A secret shown as dots until the reader presses "show". |
| `preview` | `(value, max?)` | A function: one line of JSON cut to `max` characters. |
| `tones` | | The list of tone names. `Tone` is its type. |
| `styles` | | The window's stylesheet as a string. Class names such as `kitr-dt-stack` come from it. |

Use `Section` and `Row` to keep a long panel short, and `Chips` for filters, as the Log and Query panels do. Keep rows tappable: the window gives them a 44 pixel target on a phone.

A panel that shows the orders log next to the cart:

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
          <LogList
            entries={app.container.use('devtools').entries('orders')}
            empty="No cart changes yet"
          />
        </section>
      </div>
    ),
  }),
]
```

## Read the hub directly

The hub is bound as `devtools` in the container while devtools is active. Besides `log()` and `notify()`, it can read and clear entries, count them and register panels at run time:

```ts
// app/lib/orders/debug.ts
import { getDevtools } from '@kitr/devtools'
import type { KitrApp } from '@kitr/kitr/app'

export function ordersLog(app: KitrApp) {
  const hub = getDevtools(app)
  if (!hub) return []
  return hub.entries('orders').map((entry) => `${entry.level} ${entry.label}`)
  // => ['info added sku_desk_oak', 'warn checkout blocked for ord_1042']
}
```

| Member | Description |
| --- | --- |
| `log(channel, label, data?, level?)` | Add an entry. Drops the channel's oldest entry past `maxEntries`. Identical entries within 50ms fold into one with a count. |
| `mark(label)` | Add a divider to the log. |
| `entries(channel?)` | Entries for one channel, or all of them, oldest first. Treat the result as read-only. |
| `channels()` | Every channel logged to so far, in first-seen order. |
| `counts()` | Entries kept per level: `{ debug, info, warn, error }`. Cheap enough for a badge. |
| `clear(channel?)` | Remove one channel's entries, or all of them. |
| `register(panel)` | Add a panel now; returns a function that removes it. Providers use `devtools()` instead. |
| `panels` | The registered panels, in tab order. |
| `version` | A number that goes up on every change. Read it with `useSyncExternalStore`. |
| `subscribe(listener)` | Called after changes, at most once per frame. Returns the unsubscribe function. |
| `notify()` | Ask the window to re-render. |

For a contributed panel that must re-render on hub changes, subscribe like this:

```tsx
// app/providers/orders-devtools.tsx
import { getDevtools } from '@kitr/devtools'
import { useSyncExternalStore } from 'react'
import type { KitrApp } from '@kitr/kitr/app'

export function OrdersErrors({ app }: { app: KitrApp }) {
  const hub = getDevtools(app)!
  useSyncExternalStore(hub.subscribe, () => hub.version, () => 0)
  return <p>{hub.counts().error} errors logged</p>
}
```

Use `register()` for a panel that only makes sense while a page is open:

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

## Testing

Devtools is only active in the browser in development, so a test app built with `createTestApp()` has no hub and `getDevtools(app)` returns `null`. Code that logs keeps working in tests and logs nothing. To assert on what your code logs, bind a hub of your own with `createDevtoolsHub()`:

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

To check that a provider contributes its panel, boot the real devtools provider in a client app in development mode, and call the panel's action:

```ts
// app/providers/orders.test.ts
import { createApp, getDevtools } from '@kitr/kitr/app'
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

Panels follow the `DevtoolsPanel` interface from `@kitr/devtools`. A panel is an object, so you can also build one from a function and share it between providers:

```ts
// The interfaces, from @kitr/devtools
export interface DevtoolsPanel {
  id: string
  label: string
  icon?: unknown
  group?: 'app' | 'data' | 'platform' | 'custom'
  badge?: (app: KitrApp) => string | number | null | undefined | { value: string | number; tone?: DevtoolsTone }
  render: (app: KitrApp) => KitrNode
  actions?: DevtoolsAction[]
}

export interface DevtoolsAction {
  id: string
  label: string
  hint?: string
  icon?: unknown
  danger?: boolean
  when?: (app: KitrApp) => boolean
  run: (app: KitrApp) => MaybePromise<void | string>
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
import { defineProvider } from '@kitr/kitr/app'

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
- [Http](/packages/http), [query](/packages/query) and [router](/packages/router): the panels you will open most.
- [Logger](/packages/logger): its output lands in the Log panel.
