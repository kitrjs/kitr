---
title: Platform
description: Know where your app is running, whether it is online or in the background, and handle the back button and deep links.
order: 1
---

# Platform

An app that ships to the browser, a phone and a desktop window keeps asking the same questions: where am I running, am I online, did the user press back, which link opened me, how big is the notch. `kitr/platform` answers them once, with one `platform` service and a set of React hooks, so components never sniff user agents or check for `window.Capacitor`.

It is built on the kitr driver registry: each platform package registers a `PlatformDriver` for the place it runs, and `kitr/platform` wraps whichever one is active, filling every gap with a browser default. [Web](/packages/web) registers the browser driver, [Mobile](/packages/mobile) the Capacitor driver and [Desktop](/packages/desktop) the Tauri and Electron drivers.

It runs on both sides. In the browser and in native shells it reports the real device; during server rendering it returns safe defaults (online, in the foreground, no insets), so the first render matches the HTML. For device features such as the camera, biometrics or haptics, use [Native](/packages/native) instead.

The examples on this page follow the Acme orders app at `app.acme.com`, which runs in the browser, as an installed PWA and in the Capacitor shell Ada's field team uses on their phones.

## Install

```sh
kitr add platform
```

What `kitr add platform` does:

- Installs `@kitr/platform`.
- Runs the [React](/packages/react) recipe first if it is missing.
- Adds `() => import('@kitr/platform/provider')` to `providers` in `kitrrc.ts`.
- Adds `@kitr/platform` to `packages` in `kitrrc.ts`.
- Writes `config/platform.ts` (shown under Configure) and regenerates `config/index.ts`.
- Adds a `kitr: platform` section to `AGENTS.md`: use the hooks from `kitr/platform/react` instead of user agents or `window.__TAURI__`, and `platform.is()` to match a type or an OS.

`kitr add platform` asks no questions and adds no env variables.

You rarely run it by hand. `kitr add mobile` and `kitr add desktop` add it for you, because both platforms need it, and the `mobile` and `desktop` kits include it.

`kitr remove platform` reverses every step above: it removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/platform.ts`, then lists the files that still import `kitr/platform`.

## Configure

`kitr add platform` writes this file:

```ts
// config/platform.ts
import { defineConfig } from 'kitr/platform'

export default defineConfig({
  // Deep links are routed after stripping these prefixes.
  deepLinkPrefixes: [],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `deepLinkPrefixes` | `[]` | Path prefixes to strip from deep links before routing, such as `'/open'` for `acme://open/orders/1042`. The scheme and host are always dropped first. Pass them to `deepLinkPath()`, as shown in "Route deep links". |

The provider does not read `deepLinkPrefixes` on its own. Read it with `useConfig('platform')` and hand it to `deepLinkPath()` where you route links.

The `platform` service has no other options. Which driver it wraps depends on the platform providers listed in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { mobile } from 'kitr/mobile'
import { web } from 'kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/platform', '@kitr/storage', '@kitr/web', '@kitr/mobile'],
  providers: [
    () => import('@kitr/mobile/provider'),
    () => import('@kitr/web/provider'),
    () => import('@kitr/platform/provider'),
    () => import('@kitr/storage/provider'),
  ],
  platforms: {
    site: web({ mode: 'spa', pwa: true }),
    phone: mobile({ appId: 'com.acme.orders' }),
  },
})
```

The `platform` service is created the first time something reads it, after every provider has registered, so the place of `@kitr/platform/provider` in the list does not matter. The highest-priority driver wins (see "How the driver is chosen").

## Show where the app runs

`usePlatform()` returns the `platform` service. Render it to see what kitr detected:

```tsx
// app/components/platform-badge.tsx
import { usePlatform } from 'kitr/platform/react'

export function PlatformBadge() {
  const platform = usePlatform()
  return (
    <span>
      {platform.type} · {platform.os}
      {platform.native ? ' · native' : ''}
    </span>
  )
}
```

Put `<PlatformBadge />` in a page and run `kitr dev site`. On a Mac in Chrome it shows `web · macos`. In the iOS simulator through `kitr dev phone` it shows `mobile · ios · native`.

## Read the platform outside React

The service lives in the app container, so loaders, stores and plain modules read the same object:

```ts
// app/features/orders/receipt.ts
import { app } from '#app/app'

export function receiptFileName(orderId: string) {
  const platform = app.container.use('platform')
  return platform.is('windows') ? `Acme ${orderId}.pdf` : `acme-${orderId}.pdf`
}
// receiptFileName('ord_1042') on macOS => 'acme-ord_1042.pdf'
```

Read it after `app.boot()`. Before boot, or in an app without `@kitr/platform/provider`, `use('platform')` throws `[kitr] No binding named "platform". Did you add the package that provides it?`.

## What the platform service knows

| Member | Type | Description |
| --- | --- | --- |
| `type` | `'web' \| 'mobile' \| 'desktop' \| 'server' \| string` | The kind of platform the driver belongs to. |
| `os` | `'ios' \| 'android' \| 'macos' \| 'windows' \| 'linux' \| 'server' \| 'unknown'` | The operating system. Read each time you access it. |
| `native` | `boolean` | `true` inside a native shell (Capacitor, Tauri, Electron). |
| `standalone` | `boolean` | `true` when installed: a PWA in standalone display mode, or any native shell. |
| `name` | `string \| undefined` | The platform name from `kitrrc.ts` this bundle was built for, such as `'site'` or `'phone'`. |
| `driver` | `PlatformDriver` | The active driver, for anything the service does not wrap. |
| `is(what)` | `boolean` | `true` when `what` equals the type or the OS. |
| `isOnline()` | `boolean` | Whether the device reports a connection. |
| `appVersion()` | `Promise<string>` | The native app version, or `'0.0.0'` where there is none. |
| `onAppState(fn)` | unsubscribe | Foreground (`true`) and background (`false`). |
| `onBackButton(fn)` | unsubscribe | Hardware or window back button, with `{ canGoBack }`. |
| `onDeepLink(fn)` | unsubscribe | URLs opened while the app runs. |
| `onOnline(fn)` | unsubscribe | Connection changes. |
| `safeArea()` | `{ top, right, bottom, left }` | Safe-area insets in pixels. |
| `openExternal(url)` | `Promise<void>` | Opens a URL in the system browser, or a new tab on the web. |
| `exit()` | `Promise<void>` | Closes the app where the platform allows it. |

## Subscribe to changes outside React

Every `on*` method returns a function that removes the listener. Use them in stores, sync engines and anything else that lives outside a component:

```ts
// app/features/orders/order-sync.ts
import { app } from '#app/app'

export function startOrderSync(flush: () => Promise<void>) {
  const platform = app.container.use('platform')
  const stopOnline = platform.onOnline((online) => {
    if (online) void flush()
  })
  const stopAppState = platform.onAppState((active) => {
    if (active) void flush()
  })
  return () => {
    stopOnline()
    stopAppState()
  }
}
```

```ts
// app/features/orders/start.ts
import { startOrderSync } from './order-sync'

const stop = startOrderSync(async () => {
  // ...send queued orders
})

// later, on sign-out
stop()
```

The listeners fire with the new value only; read the current one with `platform.isOnline()` when you start.

## Check whether the app is installed

`platform.standalone` is `true` when the app runs installed: a PWA opened from the home screen, or any native shell. Use it to hide install prompts and "open in app" banners:

```tsx
// app/components/open-in-app.tsx
import { usePlatform } from 'kitr/platform/react'

export function OpenInApp() {
  const platform = usePlatform()
  const phone = platform.is('ios') || platform.is('android')
  if (platform.standalone || !phone) return null
  return <a href="acme://orders">Open in the Acme app</a>
}
```

In the browser, the web driver reads the `(display-mode: standalone)` media query and Safari's `navigator.standalone`.

## Match a platform or an OS

`platform.is()` takes a type or an OS, so one call covers both questions:

```ts
// app/features/orders/print.ts
import { app } from '#app/app'

const platform = app.container.use('platform')

platform.is('mobile') // => true in the Capacitor shell
platform.is('ios') // => true on an iPhone, in the shell or in Safari
platform.is('desktop') // => false in the browser
```

Don't read `navigator.userAgent` or `window.Capacitor` in components. The driver already knows, and tests can replace it (see Testing).

## Pick an implementation per platform

When the same action works differently in each place, `perPlatform()` picks the implementation without an `if` chain. Keys are OS names, platform types or `native`; `default` is required:

```ts
// app/features/invoices/save-invoice.ts
import { app } from '#app/app'
import { perPlatform } from 'kitr/platform'

export function saveInvoice(invoiceId: string) {
  const platform = app.container.use('platform')
  return perPlatform(platform, {
    ios: () => `share ${invoiceId}`,
    desktop: () => `save dialog for ${invoiceId}`,
    native: () => `write ${invoiceId} to the documents folder`,
    default: () => `download ${invoiceId}`,
  })
}
```

The most specific key wins: the OS first, then the type, then `native`, then `default`.

| Running on | Result |
| --- | --- |
| iPhone, Capacitor shell | `'share inv_7'` (the `ios` key) |
| Android, Capacitor shell | `'write inv_7 to the documents folder'` (`native`) |
| Windows, Electron | `'save dialog for inv_7'` (`desktop`) |
| Chrome on macOS | `'download inv_7'` (`default`) |

`perPlatform()` takes anything with `type`, `os` and `native`, so you can pass a plain object in tests.

## Show an offline banner

`useOnline()` is `true` while the device reports a connection, and re-renders when it changes:

```tsx
// app/components/offline-banner.tsx
import { useOnline } from 'kitr/platform/react'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return <div role="status">You are offline. New orders will sync when you reconnect.</div>
}
```

The hook is hydration-safe: the server and the first client render say online, and the real value follows. In the browser it follows the `online` and `offline` events. For queued writes and a query cache that pauses offline, add [Offline](/packages/offline).

## Pause work in the background

`useAppState()` is `true` in the foreground. In the browser it follows page visibility; inside Capacitor it follows the app state; the desktop drivers follow window focus:

```tsx
// app/features/orders/live-orders.tsx
import { useAppState } from 'kitr/platform/react'
import { useEffect } from 'react'

export function LiveOrders({ poll }: { poll: () => void }) {
  const active = useAppState()
  useEffect(() => {
    if (!active) return
    const timer = setInterval(poll, 10_000)
    return () => clearInterval(timer)
  }, [active, poll])
  return <p>{active ? 'Live' : 'Paused'}</p>
}
```

It starts as `true`, so the server render and the first client render agree.

## Handle the back button

`useBackButton()` receives the Android hardware back button, and on desktop whatever the desktop driver reports (the window closing). The handler gets `{ canGoBack }`:

```tsx
// app/components/order-sheet.tsx
import { useBackButton, usePlatform } from 'kitr/platform/react'
import { useCallback } from 'react'

export function OrderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const platform = usePlatform()
  useBackButton(
    useCallback(
      ({ canGoBack }) => {
        if (open) onClose()
        else if (canGoBack) window.history.back()
        else void platform.exit()
      },
      [open, onClose, platform],
    ),
  )
  return open ? <aside>Order ord_1042</aside> : null
}
```

Wrap the handler in `useCallback`: the hook subscribes again whenever the function changes. On Android, Capacitor stops its default back behaviour while any listener is registered, so the handler must go back or exit itself. The browser driver has no back button, so the handler never runs on the web.

## Route deep links

`useDeepLink()` receives URLs the OS hands the app while it runs: custom schemes (`acme://orders/1042`) and app links (`https://app.acme.com/orders/1042`). `deepLinkPath()` turns them into a router path:

```tsx
// app/components/deep-links.tsx
import { useNavigate } from '@tanstack/react-router'
import { useConfig } from 'kitr/react'
import { deepLinkPath } from 'kitr/platform'
import { useDeepLink } from 'kitr/platform/react'
import { useCallback } from 'react'

export function DeepLinks() {
  const navigate = useNavigate()
  const { deepLinkPrefixes } = useConfig('platform')
  useDeepLink(
    useCallback(
      (url) => void navigate({ to: deepLinkPath(url, deepLinkPrefixes) }),
      [navigate, deepLinkPrefixes],
    ),
  )
  return null
}
```

Render `<DeepLinks />` once in the root route. `deepLinkPath()` drops the scheme and host, keeps the query and hash, then strips the first prefix that matches:

```ts
// app/features/links.ts
import { deepLinkPath } from 'kitr/platform'

deepLinkPath('acme://orders/1042') // => '/orders/1042'
deepLinkPath('https://app.acme.com/orders/1042?tab=invoices#notes') // => '/orders/1042?tab=invoices#notes'
deepLinkPath('acme://open/orders/7', ['/open']) // => '/orders/7'
deepLinkPath('https://acme.com/app/projects/3', ['/app']) // => '/projects/3'
deepLinkPath('orders/3') // => '/orders/3'
```

For a custom scheme, the part after `://` up to the next `/` is the URL's host, so `acme://orders/1042` becomes `/orders/1042`, not `/1042`. Prefixes are paths: `'https://app.acme.com'` as a prefix never matches, and it is not needed because the host is always dropped. Registering the scheme in the native projects is the platform's job; see [Mobile](/packages/mobile).

## Respect the notch and home indicator

`useSafeArea()` returns the safe-area insets in pixels, read from the CSS `env(safe-area-inset-*)` values:

```tsx
// app/components/tab-bar.tsx
import { useSafeArea } from 'kitr/platform/react'

export function TabBar() {
  const insets = useSafeArea()
  return <nav style={{ paddingBottom: 8 + insets.bottom }}>Orders · Invoices · Projects</nav>
}
```

The insets are `{ top: 0, right: 0, bottom: 0, left: 0 }` on the server and the first render, then update on mount and on every window resize. iOS reports non-zero values only when the viewport meta has `viewport-fit=cover`. For layout alone, CSS can use `env(safe-area-inset-bottom)` directly; the hook is for values you compute in JavaScript.

## Open links outside the app

Inside a native shell a plain link replaces the app's own page. `platform.openExternal()` opens the system browser there, and a new tab (`noopener`) on the web:

```tsx
// app/components/status-link.tsx
import { usePlatform } from 'kitr/platform/react'

export function StatusLink() {
  const platform = usePlatform()
  return (
    <button type="button" onClick={() => void platform.openExternal('https://status.acme.com')}>
      Service status
    </button>
  )
}
```

## Read the app version

`platform.appVersion()` resolves to the version of the native app, from the driver. Where there is none, such as the browser, it resolves to `'0.0.0'`:

```ts
// app/features/support/report.ts
import { app } from '#app/app'

export async function supportReport() {
  const platform = app.container.use('platform')
  return `${platform.type}/${platform.os} ${await platform.appVersion()}`
}
// in Chrome on macOS => 'web/macos 0.0.0'
```

## Exit the app

`platform.exit()` closes the app where the driver supports it: Android at the root of the back stack, and the desktop shells. In the browser it resolves and does nothing. Apple discourages apps that quit themselves, so don't offer it on iOS:

```ts
// app/features/session/sign-out.ts
import { app } from '#app/app'

export async function signOutAndExit() {
  // ...
  await app.container.use('platform').exit()
}
```

## Know which build is running

`platform.name` is the platform name from `kitrrc.ts` the bundle was built for. One codebase with `site` and `phone` platforms can tell them apart at run time:

```tsx
// app/components/store-badge.tsx
import { usePlatform } from 'kitr/platform/react'

export function StoreBadge() {
  const platform = usePlatform()
  if (platform.name === 'phone') return null
  return <a href="https://apps.apple.com/app/acme-orders">Get the iPhone app</a>
}
```

`kitr dev` and `kitr build` set it from `KITR_PLATFORM`, through `import.meta.env.KITR_PLATFORM`. To drop code from a bundle entirely, compare `import.meta.env.KITR_PLATFORM` itself so the bundler can remove the dead branch; see [Web](/packages/web).

## Render on the server

During server rendering there is no `window`, so the default driver reports type `server`, OS `server`, online, and zero insets. With `kitr/web/provider` registered, the type is `web` and the OS is still `server`. Every hook starts from a value the server can produce:

| Hook | Server and first render |
| --- | --- |
| `useOnline()` | `true` |
| `useAppState()` | `true` |
| `useSafeArea()` | `{ top: 0, right: 0, bottom: 0, left: 0 }` |
| `usePlatform()` | The service; `os` is `'server'` on the server. |

Branch on `platform.os` only after mount (in an effect or event handler) when the server and the client could disagree, or the first render will not match the HTML.

## How the driver is chosen

Platform providers register a driver for the `platform` capability. The registry keeps the one with the highest priority:

| Provider | Registers when | Type | Priority |
| --- | --- | --- | --- |
| `kitr/web/provider` | always | `web` | 0 |
| `kitr/mobile/provider` | inside Capacitor | `mobile` | 10 |
| `kitr/desktop/provider` | inside Tauri or Electron | `desktop` | 10 |
| none | no driver registered | `web` in a browser, `server` without `window` | |

So the same bundle answers `web` in a browser and `mobile` in the iOS shell. A driver may leave methods out; the service fills them in:

| Method | When the driver leaves it out |
| --- | --- |
| `isOnline()`, `onOnline()` | `navigator.onLine` and the `online`/`offline` events. |
| `onAppState()` | `document.visibilityState`. |
| `safeArea()` | The CSS `env(safe-area-inset-*)` values. |
| `openExternal()` | `window.open(url, '_blank', 'noopener')`. |
| `onBackButton()`, `onDeepLink()` | Never fire. |
| `appVersion()` | `'0.0.0'`. |
| `exit()` | Does nothing. |
| `standalone` | The driver's `native` value. |

## Devtools

With [Devtools](/packages/devtools) installed, the provider adds a Platform panel and logs one line at boot, such as `running as mobile (ios), native`. The panel shows:

- the platform `name`, `type`, `os`, `native`, `standalone` and `online` values;
- every capability with a registered driver (`platform`, `storage` and others) and who supplied it, such as `mobile (priority 10)`. In a plain browser it reads "No platform drivers registered (browser defaults)" until a provider registers one.

## Errors

| Message | When | What to do |
| --- | --- | --- |
| `[kitr] No binding named "platform". Did you add the package that provides it?` | `use('platform')` in an app without `@kitr/platform/provider`, or before boot. | `kitr add platform`, or read it after `app.boot()`. |
| `[kitr/react] useApp() must be used inside <KitrProvider>.` | A hook from `kitr/platform/react` rendered outside the kitr provider tree. | Render inside `KitrProvider`, or use `renderWithKitr` in tests. |
| `[kitr] Missing config "platform". Create config/platform.ts or pass it to createApp().` | `useConfig('platform')` without `config/platform.ts`. | Run `kitr add platform`, or read it with `useApp().config.get('platform', { deepLinkPrefixes: [] })`. |

## Testing

Tests replace the driver. Register a fake one from a small provider, then render with `renderWithKitr` from [Testing](/packages/testing). Your components never know the difference:

```tsx
// test/order-sheet.test.tsx
import { act, screen } from '@testing-library/react'
import { defineProvider } from 'kitr/app'
import type { PlatformDriver } from 'kitr/platform'
import { platformProvider } from 'kitr/platform/provider'
import { usePlatform, useBackButton } from 'kitr/platform/react'
import { createTestApp, renderWithKitr } from 'kitr/testing/react'
import { useCallback, useState } from 'react'
import { describe, expect, it } from 'vitest'

function fakeAndroid() {
  const backListeners = new Set<(info: { canGoBack: boolean }) => void>()
  const driver: PlatformDriver = {
    type: 'mobile',
    native: true,
    os: () => 'android',
    onBackButton(listener) {
      backListeners.add(listener)
      return () => backListeners.delete(listener)
    },
  }
  const provider = defineProvider({
    name: 'fake-android',
    register(app) {
      app.drivers.register('platform', driver)
    },
  })
  const pressBack = () => {
    for (const listener of backListeners) listener({ canGoBack: false })
  }
  return { provider, pressBack }
}

function OrderSheet() {
  const platform = usePlatform()
  const [open, setOpen] = useState(true)
  useBackButton(useCallback(() => setOpen(false), []))
  return (
    <div>
      <p>{platform.is('android') ? 'Android' : 'Other'}</p>
      {open ? <aside>Order ord_1042 for Ada</aside> : <p>Sheet closed</p>}
    </div>
  )
}

describe('OrderSheet on Android', () => {
  it('closes the sheet on the hardware back button', async () => {
    const android = fakeAndroid()
    const app = await createTestApp({ providers: [android.provider, platformProvider] })
    renderWithKitr(<OrderSheet />, { app })

    expect(screen.getByText('Android')).toBeTruthy()
    expect(screen.getByText('Order ord_1042 for Ada')).toBeTruthy()

    act(() => android.pressBack())
    expect(await screen.findByText('Sheet closed')).toBeTruthy()
  })
})
```

The driver above leaves out everything the test does not need; the service fills the rest with browser defaults. Pure helpers need no app at all:

```ts
// test/save-invoice.test.ts
import { perPlatform } from 'kitr/platform'
import { describe, expect, it } from 'vitest'

const impls = {
  ios: () => 'share',
  desktop: () => 'save dialog',
  native: () => 'documents folder',
  default: () => 'download',
}

describe('saving an invoice', () => {
  it('picks the most specific implementation', () => {
    expect(perPlatform({ type: 'mobile', os: 'ios', native: true }, impls)).toBe('share')
    expect(perPlatform({ type: 'mobile', os: 'android', native: true }, impls)).toBe('documents folder')
    expect(perPlatform({ type: 'desktop', os: 'windows', native: true }, impls)).toBe('save dialog')
    expect(perPlatform({ type: 'web', os: 'macos', native: false }, impls)).toBe('download')
  })
})
```

## Extend

A new place to run (a kiosk browser, a TV, a browser extension) gets its own driver. Implement `PlatformDriver` and register it from a provider. Only `type`, `native` and `os` are required:

```ts
// app/providers/kiosk-platform.ts
import { defineProvider } from 'kitr/app'
import type { PlatformDriver } from 'kitr/platform'

/** The order-pickup kiosks in Acme warehouses run the web build in a locked-down browser. */
function kioskDriver(): PlatformDriver {
  return {
    type: 'kiosk',
    native: false,
    os: () => 'linux',
    standalone: () => true,
    appVersion: async () => '2.3.0',
    onBackButton(listener) {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') listener({ canGoBack: window.history.length > 1 })
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    },
    // The kiosk never leaves the app.
    openExternal: async () => {},
  }
}

export default defineProvider({
  name: 'kiosk-platform',
  register(app) {
    if (typeof navigator === 'undefined' || !navigator.userAgent.includes('AcmeKiosk')) return
    app.drivers.register('platform', kioskDriver(), { platform: 'kiosk', priority: 20 })
  },
})
```

List it in `kitrrc.ts` next to the other providers:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/platform', '@kitr/web'],
  providers: [
    () => import('@kitr/web/provider'),
    () => import('./app/providers/kiosk-platform'),
    () => import('@kitr/platform/provider'),
  ],
  platforms: {
    site: web({ mode: 'spa' }),
  },
})
```

On a kiosk, `platform.is('kiosk')` is `true`, `perPlatform(platform, { kiosk: () => ..., default: () => ... })` picks the kiosk branch, and the devtools panel lists the driver as `kiosk (priority 20)`. Priority 20 beats the web driver (0) and the native drivers (10). Register only when you are sure you run there, as above, because the highest priority wins everywhere. See [`PlatformDriver`](/packages/platform/api) for every member.

To make the kiosk a platform that `kitr dev` and `kitr build` can run, write a platform package with `definePlatform()`; [Platforms](/docs/platforms) shows one.

## Next steps

- [API reference](/packages/platform/api)
- [Web](/packages/web): the browser driver and installable apps
- [Mobile](/packages/mobile): the Capacitor driver, deep link registration and native storage
- [Desktop](/packages/desktop): the desktop shells
- [Offline](/packages/offline): queued writes and a cache that pauses without a connection
- [Platforms](/docs/platforms): every platform type and the commands they share
