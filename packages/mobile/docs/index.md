---
title: Mobile
description: Ship the same app to iPhone and Android, with every kitr package switched to its native version.
order: 1
---

# Mobile

The mobile platform wraps your `app/` in a Capacitor shell for iOS and Android. The web build goes into the native project, and every kitr package that has a native driver (storage, the platform hooks) switches to it automatically.

```ts
import { mobile } from 'kitr/mobile'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'spa', pwa: true }),
    phone: mobile({ appId: 'com.acme.app', appName: 'Acme' }),
  },
})
```

## Install

```sh
kitr add mobile phone
```

This installs `@kitr/mobile` and Capacitor, adds the [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) packages if missing, writes `platforms.phone` into `kitrrc.ts`, registers the Capacitor drivers through `kitr/mobile/provider`, and scaffolds `platforms/phone/capacitor.config.ts`.

## Run it

```sh
kitr dev phone --target ios
kitr build phone
```

`kitr dev phone` builds the app, creates the native project the first time (`cap add ios|android`), and runs it on a simulator or a connected device with live reload from the Vite dev server. `kitr build phone` builds the bundle and runs `cap sync`; open `platforms/phone/ios` in Xcode or `platforms/phone/android` in Android Studio to ship.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `targets` | `ios,android` | Native projects to create |
| `appId` | | Bundle identifier (reverse DNS) |
| `appName` | | Display name on the home screen |
| `scheme` | | Custom URL scheme for deep links |
| `port` | `3100` | Dev server port for live reload |

## In the app

Nothing changes in your components. `usePlatform()`, `useBackButton()`, `useDeepLink()` and `useSafeArea()` from `kitr/platform/react` answer the native way inside the shell and the browser way on the web. `kitr/mobile/client` has the low-level checks when you need them: `isCapacitor()`, `isPluginAvailable('Camera')`, `nativeOnly(fn, fallback)`.
