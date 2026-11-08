---
title: Mobile
description: Ship the same app to iPhone and Android, with every kitr package switched to its native version.
order: 1
---

# Mobile

Your customers want the app on their phone, with an icon on the home screen, the Android back button that works and data that survives the OS clearing its caches. `@kitr/mobile` is the iOS and Android platform. It wraps the same `app/` you ship to the browser in a native shell, and switches the kitr packages that have a native driver (the platform hooks and storage) to it while the app runs on a phone.

It is built on [Capacitor](https://capacitorjs.com/docs): your client build runs in the system WebView, and Capacitor plugins reach native APIs. kitr adds the platform on top: `kitr dev` runs the app on a simulator with live reload, `kitr build` builds the bundle and syncs it into the Xcode and Android Studio projects, and `@kitr/mobile/provider` registers the native drivers.

The provider and `@kitr/mobile/client` run in the app, in the WebView and in a plain browser alike. The platform hooks (`kitr dev`, `kitr build`) run in the CLI on your machine. For an installable web app with no store listing, the PWA option of the [Web](/packages/web) platform is enough. For desktop windows, use [Desktop](/packages/desktop) (Electron) or its alternative, [Tauri](/packages/tauri).

The examples on this page ship the Acme orders app to phones: Ada's field team checks orders and invoices on iPhone and Android, with the same code the browser runs at `app.acme.com`.

## Install

Add a mobile platform named `phone`:

```sh
kitr add mobile phone
```

`mobile` is the platform type and `phone` is the name you address it by (`kitr dev phone`). `kitr add mobile` with no name uses the usual name for the type and prints `No name given: calling the mobile platform "phone".`

What `kitr add mobile phone` does, in order:

- Adds `@kitr/mobile` to `packages` in `kitrrc.ts` and installs it. The mobile package requires [Router](/packages/router) (and [React](/packages/react) before it), [Platform](/packages/platform), which writes `config/platform.ts`, and [Storage](/packages/storage), which writes `config/storage.ts` and `app/storage.ts`, so `kitr add` runs their setup first when they are missing.
- Installs `@capacitor/core`, `@capacitor/app` and `@capacitor/preferences`, `@capacitor/cli` as a dev dependency, and one package per target: `@capacitor/ios` and `@capacitor/android`.
- Adds `() => import('@kitr/mobile/provider')` to `providers` in `kitrrc.ts`.
- Writes `phone: mobile({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { mobile } from '@kitr/mobile'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- Writes `platforms/phone/capacitor.config.ts` (shown under Configure) and `platforms/phone/.gitignore`, which ignores `ios/App/Pods`, `ios/App/build`, `android/build`, `android/app/build` and `android/.gradle`.
- Adds a `## kitr: platform phone` section to `AGENTS.md`: how to run and build, never to sniff user agents, and to wrap other Capacitor plugins in `nativeOnly()`.

It does not create the `ios/` and `android/` projects. The first `kitr build phone` or `kitr dev phone` runs `cap add` for each target.

Platform options are flags on the same command. Option names are the flag names, in camelCase:

```sh
kitr add mobile phone --targets ios,android --appId com.acme.orders --appName "Acme Orders"
```

| Flag | Default | Effect |
| --- | --- | --- |
| `--targets` | `ios,android` | Comma-separated native projects to create. |
| `--appId` | `com.example.<app>` | Reverse-DNS bundle identifier. |
| `--appName` | the package name | Name under the home-screen icon. |
| `--scheme` | | Custom URL scheme for deep links. |
| `--port` | `3100` | Dev server port the device loads from. |
| `--no-scaffold` | | Register the platform without writing `platforms/phone/`. |
| `--no-install` | | Edit `package.json` without running the package manager. |
| `--dry-run` | | Print what would change. |

The `mobile` kit already has a `phone` platform next to a `site` web platform with `pwa: true`. Start a new project from it, picking the targets:

```sh
kitr new acme-orders --kit mobile --targets ios
```

`kitr platforms remove phone` takes the platform out of `kitrrc.ts`. It leaves `platforms/phone/`, the Capacitor packages and the provider in place; delete them yourself when you no longer ship to phones.

## Configure

`@kitr/mobile` has no config file in `config/`. Its options live on the `mobile()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { mobile } from '@kitr/mobile'
import { web } from '@kitr/web'

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
    phone: mobile({ appId: 'com.acme.orders', appName: 'Acme Orders' }),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `targets` | `['ios', 'android']` | Native projects to create and build. Each must be `ios` or `android`. |
| `appId` | `com.example.<app>` | Reverse-DNS bundle identifier. The default lower-cases the app name and drops everything but letters and digits: `acme-orders` gives `com.example.acmeorders`. |
| `appName` | the package name | Name shown on the home screen. `acme-orders` becomes `Acme Orders`. |
| `scheme` | | Custom URL scheme for deep links (`acme` opens `acme://...`). `kitr build` and `kitr dev` register it in the iOS `Info.plist` and the Android manifest; `kitr doctor` warns when a native project lacks it. |
| `port` | `3100` | Port of the dev server the device loads with `kitr dev phone`. |
| `capacitor` | | Extra [Capacitor config](https://capacitorjs.com/docs/config), such as `plugins`, merged last into `capacitor.config.ts`. |

An unknown target fails when `kitrrc.ts` loads:

```
[kitr] Invalid options for mobile platform:
  targets: targets must be ios or android, got windows
```

The platform writes the Capacitor config next to the native projects, from the options above. With `appId: 'com.acme.orders'` and `appName: 'Acme Orders'` it is:

```ts
// platforms/phone/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Written by kitr from `phone: mobile({...})` in kitrrc.ts. Native projects live next to this file;
 * `kitr dev phone` sets `server.url` for live reload, `kitr build phone` syncs the built bundle.
 */
const config: CapacitorConfig = {
  appId: 'com.acme.orders',
  appName: 'Acme Orders',
  webDir: '../../dist/phone/client',
  ios: { path: 'ios' },
  android: { path: 'android' },
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } } : {}),
}

export default config
```

`webDir` points at the client build of this platform, so `kitr build phone` and `cap sync` agree on where the bundle is. The file is yours after it is written: kitr never overwrites it.

| Variable | Used for |
| --- | --- |
| `CAP_SERVER_URL` | Set by `kitr dev phone` to the dev server URL. `capacitor.config.ts` turns it into `server.url` so the app loads from your machine. Unset in builds. |
| `KITR_PHONE_<OPTION>` | Overrides one option for one run of the CLI: `KITR_PHONE_PORT=3300 kitr dev phone`, `KITR_PHONE_TARGETS=android kitr build phone`. |
| `KITR_PLATFORM` | Set to `phone` by `kitr dev` and `kitr build`, so the Vite plugin builds this platform into `dist/phone`. |

The other platform types each have their own guide and options table: [Web](/packages/web), [Server](/packages/server), [Desktop](/packages/desktop) (Electron) and [Tauri](/packages/tauri). [Platforms](/docs/platforms) lists them side by side.

## Run the app on a phone

You need Xcode for iOS (macOS only) or Android Studio for Android, as the [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) describes. Then add the platform and build once, which creates the native projects:

```sh
kitr add mobile phone --appId com.acme.orders --appName "Acme Orders"
kitr build phone
```

Show where the app runs on the home page:

```ts
// app/routes.ts
r.page('/', { lazy: () => import('./pages/index') })
```

```tsx
// app/pages/index.tsx
import { usePlatform } from '@kitr/platform/react'

export default function OrdersHome() {
  const platform = usePlatform()
  return (
    <main>
      <h1>Acme orders</h1>
      <p>
        Running on {platform.os}
        {platform.native ? ' in the native app' : ' in the browser'}.
      </p>
    </main>
  )
}
```

Start it on a simulator:

```sh
kitr dev phone --target ios
# phone: dev server on http://192.168.1.20:3100, the ios app loads it live
```

The iOS simulator opens Acme Orders and shows "Running on ios in the native app". The same page in a browser at `kitr dev site` says "in the browser".

## Ship the same app to the web and the phone

Both platforms build the same `app/`. Keep a web platform next to the mobile one, and each command addresses one of them or both:

```sh
kitr dev site          # the browser on port 3000
kitr dev phone         # the simulator on port 3100
kitr build             # every platform, one after another
```

Inside the shell, `@kitr/mobile/provider` registers the native drivers. In a plain browser it registers nothing, so the web build of the same bundle keeps the browser behaviour. Components ask [Platform](/packages/platform) instead of checking where they run.

## Run on a simulator or device

`kitr dev phone` does four things:

1. Picks the target: `--target ios` or `--target android`. With both targets and no flag, it runs `ios` on macOS and `android` elsewhere, and says so.
2. Creates the native project with `cap add <target>` if `platforms/phone/<target>` does not exist yet.
3. Starts Vite on your machine's LAN address and the platform's port, so the device can reach it.
4. Waits for the dev server, then runs `cap run <target> --no-sync` with `CAP_SERVER_URL` set to that address.

To pick a connected device or a specific simulator, pass its id with `--device`. `npx cap run ios --list` from `platforms/phone` prints the ids:

```sh
kitr dev phone --target android --device emulator-5554
```

When the LAN address kitr picks is the wrong one (a VPN or a second network card), set the host and port yourself:

```sh
kitr dev phone --target android --host 192.168.1.20 --port 3300
```

The phone and your machine must be on the same network. `cleartext: true` in the Capacitor config lets Android load the `http://` dev server.

## Build and open the native projects

`kitr build phone` runs `vite build` into `dist/phone`, creates any missing native project, then runs `cap sync` in `platforms/phone`:

```sh
kitr build phone
# ✔ phone: synced dist/phone/client into platforms/phone/{ios,android}. Open with `pnpm exec cap open ios` from platforms/phone.
```

Pass `--open` to open each project in Xcode or Android Studio after the sync, and `--target` to build one:

```sh
kitr build phone --target ios --open
```

From the IDE you run on devices, set signing and produce the archive for the stores. The projects in `platforms/phone/ios` and `platforms/phone/android` are yours: edit `Info.plist`, `AndroidManifest.xml`, icons and splash screens there. `kitr build` only syncs the web bundle and plugin list into them.

The mobile platform has no production server, so `kitr start phone` prints `phone: the mobile platform has no start step` and returns.

## Pick the targets

Ship to one store first by listing one target:

```sh
kitr config phone targets ios
# ✔ phone.targets = ["ios"]
```

To add Android later, set both targets, install the package and build:

```sh
kitr config phone targets ios,android
pnpm add @capacitor/android
kitr build phone --target android
```

`kitr config` only edits `kitrrc.ts`. Install `@capacitor/<target>` yourself when you add one; `kitr doctor` reports it when it is missing. A `--target` the platform does not list fails with `phone has no android target (targets: ios)`.

## Set the bundle id and app name

`appId` and `appName` are written into `capacitor.config.ts` when the platform is added. Set them before the first `kitr build`, because `cap add` copies them into the native projects:

```sh
kitr config phone appId com.acme.orders
kitr config phone appName "Acme Orders"
```

`capacitor.config.ts` is written once and never overwritten, and `kitr platforms scaffold phone` skips files that exist. After changing the options, edit `appId` and `appName` in `platforms/phone/capacitor.config.ts` too, or delete the file and run `kitr platforms scaffold phone` to write it again. Once the native projects exist, change the bundle id in Xcode and in `android/app/build.gradle` as well.

## Add Capacitor plugin config

Plugin settings go in the `capacitor` option. They are merged last into the generated `capacitor.config.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { mobile } from '@kitr/mobile'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/platform', '@kitr/storage', '@kitr/mobile'],
  providers: [() => import('@kitr/mobile/provider'), () => import('@kitr/platform/provider')],
  platforms: {
    phone: mobile({
      appId: 'com.acme.orders',
      capacitor: { plugins: { SplashScreen: { launchShowDuration: 0 } } },
    }),
  },
})
```

The generated file then ends with:

```ts
// platforms/phone/capacitor.config.ts
// ...
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } } : {}),
  ...{
    "plugins": {
      "SplashScreen": {
        "launchShowDuration": 0
      }
    }
  },
}
```

Like `appId`, `capacitor` is read when the file is written. For an existing project, edit `capacitor.config.ts` directly.

## Check whether the app runs in the shell

Most code should ask [Platform](/packages/platform) (`usePlatform()`, `platform.is('ios')`). For the few places that need Capacitor itself, `@kitr/mobile/client` reads the Capacitor runtime directly:

```ts
// app/features/orders/where.ts
import { capacitorPlatform, isCapacitor, isPluginAvailable } from '@kitr/mobile/client'

capacitorPlatform()
// => 'ios' on an iPhone, 'android' on Android, 'web' in a browser

isCapacitor()
// => true inside the iOS or Android shell

isPluginAvailable('App')
// => true when the native side registered the plugin
```

These read the global `Capacitor` object the native shell injects, so they are correct before any import resolves. In a browser, and on the server, they return `'web'` and `false`.

## Call a Capacitor plugin

Other Capacitor plugins are plain dependencies. Install one, sync it into the native projects, and wrap the call in `nativeOnly()` so the web build keeps working:

```sh
pnpm add @capacitor/share
kitr build phone
```

```ts
// app/features/orders/share-order.ts
import { nativeOnly } from '@kitr/mobile/client'

export async function shareOrder(order: { id: string; customer: string }) {
  const url = `https://app.acme.com/orders/${order.id}`
  const shared = await nativeOnly(async () => {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: `Order ${order.id}`, text: `${order.customer}'s order`, url })
    return 'shared' as const
  }, 'copy' as const)
  if (shared === 'copy') await navigator.clipboard.writeText(url)
  return shared
}

// => 'shared' in the shell, 'copy' in a browser
```

`nativeOnly(fn, fallback)` runs `fn` inside the shell and returns `fallback` everywhere else, without calling `fn`. Import the plugin inside `fn` so the browser bundle never evaluates it. Without a fallback it returns `undefined` on the web.

`kitr build phone` runs `cap sync`, which registers the new plugin in the native projects. A plugin you installed but did not sync makes `isPluginAvailable('Share')` return `false`.

## Handle the Android back button

On Android, `useBackButton()` from `@kitr/platform/react` receives the hardware back button with `canGoBack` from the WebView history:

```tsx
// app/components/back-button.tsx
import { usePlatform, useBackButton } from '@kitr/platform/react'
import { useCallback } from 'react'

export function BackButtonHandler({ onCloseSheet }: { onCloseSheet: () => boolean }) {
  const platform = usePlatform()
  useBackButton(
    useCallback(
      ({ canGoBack }) => {
        if (onCloseSheet()) return
        if (canGoBack) window.history.back()
        else void platform.exit()
      },
      [onCloseSheet, platform],
    ),
  )
  return null
}
```

Capacitor turns off the default back behaviour as soon as a listener is registered, so the handler must go back or exit itself, as above. `platform.exit()` closes the app on Android. Wrap the handler in `useCallback`: the hook subscribes again whenever the function changes. In a browser and on iOS the handler never runs.

## Open deep links

To open `acme://orders/1042` in the app, set `scheme: 'acme'` on the platform in `kitrrc.ts`. The next `kitr build` or `kitr dev` adds it to `CFBundleURLSchemes` in the iOS `Info.plist` and as an `intent-filter` on the main activity in the Android manifest, once; edits you make to those files stay. `https` links (`https://app.acme.com/orders/1042`) need Associated Domains on iOS and an App Links `intent-filter` on Android, which you add yourself: the [Capacitor deep links guide](https://capacitorjs.com/docs/guides/deep-links) has both. Then hand each URL to the router:

```tsx
// app/components/deep-links.tsx
import { useNavigate } from '@tanstack/react-router'
import { useDeepLink } from '@kitr/platform/react'
import { useCallback } from 'react'

export function DeepLinks() {
  const navigate = useNavigate()
  useDeepLink(useCallback((_url, path) => void navigate({ to: path }), [navigate]))
  return null
}

// acme://orders/1042                      => /orders/1042
// https://app.acme.com/orders/1042?tab=invoices => /orders/1042?tab=invoices
```

The mobile driver listens to Capacitor's `appUrlOpen` event, which fires when the OS hands the app a URL while it runs. The second argument is the router path: the scheme and host removed, then any `deepLinkPrefixes` from `config/platform.ts`. [Platform](/packages/platform) documents the prefixes.

## React to the app going to the background

`useAppState()` is `true` while the app is in the foreground. Inside the shell it follows Capacitor's `appStateChange`; in a browser it follows page visibility:

```tsx
// app/features/orders/live-orders.tsx
import { useAppState } from '@kitr/platform/react'

export function LiveOrdersBadge() {
  const active = useAppState()
  return <span>{active ? 'Live' : 'Paused'}</span>
}
```

Pause polling and sockets while it is `false`, and refetch when it turns `true` again.

## Respect the notch and home indicator

`useSafeArea()` returns the insets in pixels, read from the CSS `env(safe-area-inset-*)` values. iOS reports them only when the viewport opts in, so keep `viewport-fit=cover` in the root route's viewport meta:

```tsx
// app/components/bottom-bar.tsx
import { useSafeArea } from '@kitr/platform/react'

export function BottomBar() {
  const insets = useSafeArea()
  return <nav style={{ paddingBottom: 12 + insets.bottom }}>Orders · Invoices · Teams</nav>
}
// insets on an iPhone with a notch, for example => { top: 47, right: 0, bottom: 34, left: 0 }
```

The insets are zero on the server and on the first render, then update on mount and on every resize. For layout alone, the CSS `env()` values work without the hook: `pb-[env(safe-area-inset-bottom)]`.

## Keep data in native storage

Inside the shell, `@kitr/mobile/provider` registers a storage driver on [`@capacitor/preferences`](https://capacitorjs.com/docs/apis/preferences). Every `local` item from [Storage](/packages/storage) then lives in native preferences, which iOS does not clear the way it can clear WebView `localStorage`:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const lastOrderId = defineStorage('lastOrderId', { default: '' })
```

Nothing changes in the code that reads or writes the item. The driver loads every key at boot, so reads stay synchronous, and writes go to Preferences in the background. `session` items stay in memory.

The storage provider looks for a native driver again when the app boots, after every provider has registered, so the order of `@kitr/mobile/provider` and `@kitr/storage/provider` in `kitrrc.ts` does not matter.

## Open links in the system browser

Links to other sites should leave the app. `platform.openExternal()` opens the system browser inside the shell, and a new tab in a browser:

```tsx
// app/components/invoice-link.tsx
import { usePlatform } from '@kitr/platform/react'

export function InvoiceLink({ invoiceId }: { invoiceId: string }) {
  const platform = usePlatform()
  const url = `https://billing.acme.com/invoices/${invoiceId}`
  return (
    <button type="button" onClick={() => void platform.openExternal(url)}>
      Open invoice {invoiceId}
    </button>
  )
}
```

## Show the app version

`platform.appVersion()` resolves to the version from the native project (`CFBundleShortVersionString` on iOS, `versionName` on Android). In a browser it resolves to `'0.0.0'`:

```tsx
// app/components/about-version.tsx
import { usePlatform } from '@kitr/platform/react'
import { useEffect, useState } from 'react'

export function AboutVersion() {
  const platform = usePlatform()
  const [version, setVersion] = useState('')
  useEffect(() => {
    void platform.appVersion().then(setVersion)
  }, [platform])
  return <p>Acme Orders {version}</p>
}
// with versionName 1.4.0 => Acme Orders 1.4.0
```

## Commands

`@kitr/mobile` adds no generators. The mobile platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add mobile [name]` | Adds a mobile platform (named `phone` when you leave the name out): installs Capacitor, writes `platforms.<name>`, runs the router, platform and storage recipes, writes `platforms/<name>/capacitor.config.ts`. |
| `kitr dev <name>` | Creates the native project if needed, starts Vite on the LAN and runs `cap run <target> --no-sync` against it. Flags: `--target`, `--device`, `--host`, `--port`. |
| `kitr build <name>` | Runs `vite build`, `cap add` for missing targets and `cap sync`. Flags: `--target`, `--open`. |
| `kitr config <name> [option] [value]` | Reads or sets an option in `kitrrc.ts`. `--unset` removes one. |
| `kitr platforms` | Lists every platform with its options. |
| `kitr platforms scaffold <name>` | Writes `capacitor.config.ts` and `.gitignore` when they are missing. Existing files are kept. |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`. |

Capacitor's own CLI works from `platforms/phone` for everything else: `pnpm exec cap open android`, `pnpm exec cap run ios --list`, `pnpm exec cap doctor`.

`kitr doctor` checks each mobile platform and reports:

- an error for each missing package: `@capacitor/core`, `@capacitor/cli`, `@capacitor/app`, `@capacitor/preferences` and `@capacitor/<target>`. Fix: `pnpm add <package>`.
- an error when `platforms/phone/capacitor.config.ts` is missing. Fix: `kitr platforms scaffold phone`.
- an info line for each target whose native project does not exist yet. Fix: `kitr build phone`, which runs `cap add`.

## Errors

| Message | When | What to do |
| --- | --- | --- |
| `[kitr] Invalid options for mobile platform: targets: targets must be ios or android, got windows` | `targets` lists something other than `ios` or `android`. | Use `ios`, `android` or both. |
| `phone has no ios target (targets: android)` | `--target` names a target the platform does not list. | Add it to `targets` or drop the flag. |
| `mobile has no option "<flag>" (options: targets, appId, appName, scheme, port)` | `kitr add mobile` got an unknown flag. | Use one of the listed options; names are camelCase. |
| `No platform named "<name>" in kitrrc.ts (have: site, phone)` | A command got an unknown platform name. | Use a name from `kitr platforms`. |
| `<path>/cap run android --no-sync exited with code 1` | Capacitor could not build or launch the app. kitr logs it and keeps the dev server running. | Read Capacitor's output above it; `pnpm exec cap doctor` in `platforms/phone` checks the toolchain. |
| `phone: the mobile platform has no start step` | `kitr start` ran for a mobile platform. Not an error. | Ship through Xcode or Android Studio. |

## Testing

Unit tests run in Node or `happy-dom`, where there is no Capacitor runtime. The helpers in `@kitr/mobile/client` read the global `Capacitor` object, so a test sets a fake one to play the native shell and deletes it afterwards.

This test checks the platform options, that the app picks the native driver inside the shell, and that `shareOrder()` from "Call a Capacitor plugin" falls back in the browser:

```ts
// test/mobile.test.ts
import { mobileProvider } from '@kitr/mobile/provider'
import { platformProvider } from '@kitr/platform/provider'
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareOrder } from '#app/features/orders/share-order'
import rc from '../kitrrc'

function fakeShell(os: 'ios' | 'android') {
  ;(globalThis as any).Capacitor = {
    getPlatform: () => os,
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
  }
}

afterEach(() => {
  delete (globalThis as any).Capacitor
})

describe('the phone platform', () => {
  it('ships Acme Orders to both stores', () => {
    expect(rc.platforms!.phone!.options).toMatchObject({
      appId: 'com.acme.orders',
      targets: ['ios', 'android'],
    })
  })

  it('uses the native driver inside the shell', async () => {
    fakeShell('android')
    const app = await createTestApp({ providers: [mobileProvider, platformProvider] })
    const platform = app.container.use('platform')
    expect(platform.type).toBe('mobile')
    expect(platform.native).toBe(true)
    expect(platform.is('android')).toBe(true)
  })

  it('keeps the browser behaviour without the shell', async () => {
    const app = await createTestApp({ providers: [mobileProvider, platformProvider] })
    expect(app.container.use('platform').native).toBe(false)
  })

  it('copies the order link in a browser', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await shareOrder({ id: 'ord_1042', customer: 'Ada' })).toBe('copy')
    expect(writeText).toHaveBeenCalledWith('https://app.acme.com/orders/ord_1042')
    vi.unstubAllGlobals()
  })
})
```

The fake shell is enough for the drivers kitr registers, because they reach the Capacitor plugins only when a listener or method is used. To test code that calls a plugin, mock it with `vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }))`. Test the real native build on a simulator or device with `kitr dev phone`.

## Next steps

- [API reference](/packages/mobile/api)
- [Platform](/packages/platform): app state, back button, deep links and safe areas on every platform
- [Storage](/packages/storage): typed items that move to native preferences on a phone
- [Web](/packages/web): the browser build of the same app, installable as a PWA
- [Platforms](/docs/platforms): every platform type and the commands they share
- [Capacitor documentation](https://capacitorjs.com/docs)
