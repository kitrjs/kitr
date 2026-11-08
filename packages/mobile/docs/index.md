---
title: Mobile
description: Ship the same app to iPhone and Android, with every kitr package switched to its native version.
order: 1
---

# Mobile

Your customers want the app on their phone, with a home-screen icon, a working Android back button and data that survives the OS clearing its caches. `@kitr/mobile` is the iOS and Android platform: it wraps the same `app/` you ship to the browser in a native shell.

> [!SUMMARY]
> Ship your app to iPhone and Android as a native shell, with native storage and platform hooks. Add it with `kitr add mobile phone`; the overview is at [/packages/mobile](/packages/mobile).

It is built on [Capacitor](https://capacitorjs.com/docs): your client build runs in the system WebView and Capacitor plugins reach native APIs. `kitr dev` runs the app on a simulator with live reload, and `kitr build` syncs the bundle into the Xcode and Android Studio projects.

For an installable web app with no store listing, the PWA option of the [Web](/packages/web) platform is enough. For desktop windows, use [Desktop](/packages/desktop) or [Tauri](/packages/tauri).

The examples ship the Acme orders app to phones: Ada's field team checks orders and invoices with the same code the browser runs at `app.acme.com`.

## Install

Add a mobile platform named `phone`:

```sh
kitr add mobile phone
```

`mobile` is the platform type and `phone` is the name you address it by (`kitr dev phone`).

<details>
<summary>Everything kitr add changes</summary>

What `kitr add mobile phone` does, in order:

- Adds `@kitr/mobile` to `packages` in `kitrrc.ts` and installs it. The mobile package requires [Router](/packages/router) (and [React](/packages/react) before it), [Platform](/packages/platform), which writes `config/platform.ts`, and [Storage](/packages/storage), which writes `config/storage.ts` and `app/storage.ts`, so `kitr add` runs their setup first when they are missing.
- Installs `@capacitor/core`, `@capacitor/app` and `@capacitor/preferences`, `@capacitor/cli` as a dev dependency, and one package per target: `@capacitor/ios` and `@capacitor/android`.
- Adds `() => import('@kitr/mobile/provider')` to `providers` in `kitrrc.ts`.
- Writes `phone: mobile({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { mobile } from '@kitr/mobile'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- Writes `platforms/phone/capacitor.config.ts` (shown under Configure), `platforms/phone/package.json` (generated; see [Sync the plugins](#sync-the-plugins)) and `platforms/phone/.gitignore`, which ignores `ios/App/Pods`, `ios/App/build`, `android/build`, `android/app/build` and `android/.gradle`.
- Adds a `## kitr: platform phone` section to `AGENTS.md`: how to run and build, never to sniff user agents, and to wrap other Capacitor plugins in `nativeOnly()`.

It does not create the `ios/` and `android/` projects; the first `kitr build phone` or `kitr dev phone` runs `cap add` for each target.

`kitr platforms remove phone` takes the platform out of `kitrrc.ts`. It leaves `platforms/phone/`, the Capacitor packages and the provider for you to delete.

</details>

Platform options are flags on the same command:

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

The `mobile` kit already has a `phone` platform next to a `site` web platform with `pwa: true`:

```sh
kitr new acme-orders --kit mobile --targets ios
```

## Configure

`@kitr/mobile` has no config file in `config/`; its options live on the `mobile()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
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
| `appId` | `com.example.<app>` | Reverse-DNS bundle identifier. `acme-orders` gives `com.example.acmeorders`. |
| `appName` | the package name | Name shown on the home screen. `acme-orders` becomes `Acme Orders`. |
| `scheme` | | URL scheme for deep links: `acme` opens `acme://...`. |
| `port` | `3100` | Port of the dev server the device loads with `kitr dev phone`. |
| `capacitor` | | Extra [Capacitor config](https://capacitorjs.com/docs/config), such as `plugins`, merged last into `capacitor.config.ts`. |

An unknown target fails when `kitrrc.ts` loads:

```
[kitr] Invalid options for mobile platform:
  targets: targets must be ios or android, got windows
```

The platform writes the Capacitor config from these options. With `appId: 'com.acme.orders'` and `appName: 'Acme Orders'` it is:

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

`webDir` points at the client build, so `kitr build phone` and `cap sync` agree on where the bundle is. The file is yours once written; kitr never overwrites it.

| Variable | Used for |
| --- | --- |
| `CAP_SERVER_URL` | Set by `kitr dev phone` to the dev server URL. `capacitor.config.ts` turns it into `server.url` so the app loads from your machine. Unset in builds. |
| `KITR_PHONE_<OPTION>` | Overrides one option for one run of the CLI: `KITR_PHONE_PORT=3300 kitr dev phone`, `KITR_PHONE_TARGETS=android kitr build phone`. |
| `KITR_PLATFORM` | Set to `phone` by `kitr dev` and `kitr build`, so the Vite plugin builds this platform into `dist/phone`. |

[Platforms](/docs/platforms) lists every platform type side by side.

## Run the app on a phone

You need Xcode for iOS (macOS only) or Android Studio for Android; see the [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup). Then add the platform and build once to create the native projects:

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

The simulator opens Acme Orders and shows "Running on ios in the native app"; in a browser it says "in the browser".

## Ship the same app to the web and the phone

Both platforms build the same `app/`. Keep a web platform next to the mobile one; each command addresses one or both:

```sh
kitr dev site          # the browser on port 3000
kitr dev phone         # the simulator on port 3100
kitr build             # every platform, one after another
```

Inside the shell, `@kitr/mobile/provider` registers the native drivers; in a plain browser it registers nothing. Components ask [Platform](/packages/platform) instead of checking where they run.

## Run on a simulator or device

`kitr dev phone` does four things:

1. Picks the target: `--target ios` or `--target android`. With both and no flag, it runs `ios` on macOS and `android` elsewhere.
2. Creates the native project with `cap add <target>` if it does not exist yet.
3. Starts Vite on your machine's LAN address, so the device can reach it.
4. Runs `cap run <target> --no-sync` with `CAP_SERVER_URL` set to that address.

> [!WARNING] Same network
> The phone and your machine must be on the same network.

To pick a connected device or simulator, pass its id with `--device`; `npx cap run ios --list` from `platforms/phone` prints the ids:

```sh
kitr dev phone --target android --device emulator-5554
```

<details>
<summary>Wrong LAN address</summary>

With a VPN or a second network card, kitr may pick the wrong address. Set the host and port yourself:

```sh
kitr dev phone --target android --host 192.168.1.20 --port 3300
```

</details>

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

From the IDE you run on devices, set signing and produce the archive for the stores. The projects in `platforms/phone/ios` and `platforms/phone/android` are yours: edit `Info.plist`, `AndroidManifest.xml`, icons and splash screens there. `kitr build` only syncs the bundle and plugin list into them.

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

`kitr config` only edits `kitrrc.ts`; install `@capacitor/<target>` yourself. `kitr doctor` reports it when missing.

## Set the bundle id and app name

Set `appId` and `appName` before the first `kitr build`, because `cap add` copies them into the native projects:

```sh
kitr config phone appId com.acme.orders
kitr config phone appName "Acme Orders"
```

> [!WARNING] The config file is written once
> After changing the options, edit `platforms/phone/capacitor.config.ts` too, or delete it and run `kitr platforms scaffold phone`. Once the native projects exist, change the bundle id in Xcode and `android/app/build.gradle` as well.

## Add Capacitor plugin config

Plugin settings go in the `capacitor` option, merged last into `capacitor.config.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
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

`capacitor` is read when the file is written; for an existing project, edit `capacitor.config.ts` directly.

## Sync the plugins

Capacitor finds plugins in the `package.json` of the folder it runs in, so kitr regenerates `platforms/phone/package.json` from the app's `dependencies` before each `cap` command. A plugin you install with `pnpm add @capacitor/camera` appears on the next build.

> [!WARNING] Don't edit platforms/phone/package.json
> It is regenerated.

`cap sync` prints what it found:

```sh
kitr build phone
# [info] Found 12 Capacitor plugins for android:
#        @capacitor/clipboard@8.0.1
#        @capacitor/share@8.0.3
#        ...
```

The device packages ([Native](/packages/native), [Notifications](/packages/notifications), [Files](/packages/files), [Secure storage](/packages/secure-storage) and [Updater](/packages/updater)) use these plugins; `kitr add <package>` installs the ones it needs. If you added one before the mobile platform, run it again.

## Check whether the app runs in the shell

Most code should ask [Platform](/packages/platform). Where you need Capacitor itself, `@kitr/mobile/client` reads its runtime:

```ts
// app/lib/orders/where.ts
import { capacitorPlatform, isCapacitor, isPluginAvailable } from '@kitr/mobile/client'

capacitorPlatform()
// => 'ios' on an iPhone, 'android' on Android, 'web' in a browser

isCapacitor()
// => true inside the iOS or Android shell

isPluginAvailable('App')
// => true when the native side registered the plugin
```

In a browser and on the server they return `'web'` and `false`.

## Call a Capacitor plugin

Other Capacitor plugins are plain dependencies. Install one, sync it, and wrap the call in `nativeOnly()` so the web build keeps working:

```sh
pnpm add @capacitor/share
kitr build phone
```

```ts
// app/lib/orders/share-order.ts
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

`nativeOnly(fn, fallback)` runs `fn` inside the shell and returns `fallback` elsewhere. Import the plugin inside `fn` so the browser bundle never evaluates it.

> [!WARNING] Sync new plugins
> A plugin you installed but did not sync with `kitr build phone` makes `isPluginAvailable('Share')` return `false`.

## Handle the Android back button

On Android, `useBackButton()` from `@kitr/platform/react` receives the hardware back button with `canGoBack`:

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

> [!WARNING] The handler must go back or exit
> Capacitor turns off the default back behaviour once a listener is registered. Wrap the handler in `useCallback`, because the hook resubscribes when the function changes.

The handler never runs in a browser or on iOS.

## Open deep links

To open `acme://orders/1042` in the app, set `scheme: 'acme'` on the platform in `kitrrc.ts`. `https` links need extra setup; see the [Capacitor deep links guide](https://capacitorjs.com/docs/guides/deep-links). Then hand each URL to the router:

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

The second argument is the router path, with the scheme and host removed and any `deepLinkPrefixes` from `config/platform.ts` applied; see [Platform](/packages/platform).

## React to the app going to the background

`useAppState()` is `true` while the app is in the foreground (in a browser it follows page visibility):

```tsx
// app/components/orders/live-orders.tsx
import { useAppState } from '@kitr/platform/react'

export function LiveOrdersBadge() {
  const active = useAppState()
  return <span>{active ? 'Live' : 'Paused'}</span>
}
```

Pause polling and sockets while it is `false`, and refetch when it turns `true`.

## Respect the notch and home indicator

`useSafeArea()` returns the insets in pixels from the CSS `env(safe-area-inset-*)` values:

> [!WARNING] Keep viewport-fit=cover
> iOS reports insets only when the root route's viewport meta opts in.

```tsx
// app/components/bottom-bar.tsx
import { useSafeArea } from '@kitr/platform/react'

export function BottomBar() {
  const insets = useSafeArea()
  return <nav style={{ paddingBottom: 12 + insets.bottom }}>Orders · Invoices · Teams</nav>
}
// insets on an iPhone with a notch, for example => { top: 47, right: 0, bottom: 34, left: 0 }
```

The insets are zero on the server and first render, then update on mount and resize. For layout alone, CSS works without the hook: `pb-[env(safe-area-inset-bottom)]`.

## Keep data in native storage

Inside the shell, every `local` item from [Storage](/packages/storage) lives in [`@capacitor/preferences`](https://capacitorjs.com/docs/apis/preferences), which iOS does not clear the way it can clear WebView `localStorage`:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const lastOrderId = defineStorage('lastOrderId', { default: '' })
```

Your code does not change. Reads stay synchronous and writes go to Preferences in the background. `session` items stay in memory.

## Open links in the system browser

`platform.openExternal()` opens the system browser inside the shell, and a new tab in a browser:

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

The mobile platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add mobile [name]` | Add a mobile platform, named `phone` by default. |
| `kitr dev <name>` | Run the app on a phone or simulator with live reload: `kitr dev phone --target ios`. |
| `kitr build <name>` | Runs `vite build`, `cap add` for missing targets and `cap sync`. Flags: `--target`, `--open`. |
| `kitr config <name> [option] [value]` | Reads or sets an option in `kitrrc.ts`. `--unset` removes one. |
| `kitr platforms` | Lists every platform with its options. |
| `kitr platforms scaffold <name>` | Writes `capacitor.config.ts` and `.gitignore` when they are missing. Existing files are kept. |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`. |

Capacitor's own CLI works from `platforms/phone` for everything else, such as `pnpm exec cap doctor`.

`kitr doctor` reports each missing Capacitor package (fix: `pnpm add <package>`), a missing `capacitor.config.ts` (fix: `kitr platforms scaffold phone`) and any target without a native project yet (fix: `kitr build phone`).

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

Unit tests run where there is no Capacitor runtime. The helpers in `@kitr/mobile/client` read the global `Capacitor` object, so a test sets a fake one and deletes it afterwards. This checks the options, the native driver and the browser fallback:

```ts
// test/mobile.test.ts
import { mobileProvider } from '@kitr/mobile/provider'
import { platformProvider } from '@kitr/platform/provider'
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareOrder } from '#app/lib/orders/share-order'
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

To test code that calls a plugin, mock it with `vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }))`. Test the real native build on a simulator with `kitr dev phone`.

## Next steps

- [API reference](/packages/mobile/api): every export and type.
- [Platform](/packages/platform): app state, back button, deep links and safe areas.
- [Platforms](/docs/platforms): every platform type and the commands they share.
