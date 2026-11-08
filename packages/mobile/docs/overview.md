---
title: Overview
description: Ship the same app to iPhone and Android, with every kitr package switched to its native version.
order: 0
---

# Mobile

## What it is

`@kitr/mobile` adds a Capacitor platform. `kitr dev` runs your app on a simulator or device with live reload, `kitr build` syncs it into the Xcode and Android Studio projects, and the provider gives [platform](/packages/platform) and [storage](/packages/storage) their native drivers.

The client code also runs in a plain browser. For an installable web app with no store listing, the [web](/packages/web) platform's PWA option is enough.

## Install

```sh
kitr add mobile phone --appId com.acme.orders --appName "Acme Orders"
```

Adds `@kitr/mobile` with Capacitor, a `phone` platform and `platforms/phone/capacitor.config.ts`. Adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first if missing. Needs Xcode or Android Studio. [Every change](/packages/mobile/guide#install).

## Quick start

Build once to create the native projects, then show where the app runs:

```sh
kitr build phone
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

The simulator shows "Running on ios in the native app". The same page in a browser says "in the browser". Next in the guide: [Run the app on a phone](/packages/mobile/guide#run-the-app-on-a-phone).

## Built on

kitr adds the platform contract, the generated Capacitor config, deep link files, the native drivers and the `nativeOnly` helper.

## Problems it solves

- **A second codebase for the phone.** [Ship the same app to the web and the phone](/packages/mobile/guide#ship-the-same-app-to-the-web-and-the-phone).
- **A back button that closes the app.** [Handle the Android back button](/packages/mobile/guide#handle-the-android-back-button).
- **Links that open the browser instead of the app.** [Open deep links](/packages/mobile/guide#open-deep-links).
- **Content under the notch.** [Respect the notch and home indicator](/packages/mobile/guide#respect-the-notch-and-home-indicator).
- **Storage the OS can wipe.** [Keep data in native storage](/packages/mobile/guide#keep-data-in-native-storage).
- **Native projects out of step with the web build.** [Build and open the native projects](/packages/mobile/guide#build-and-open-the-native-projects).

## Further reading

- [Guide](/packages/mobile/guide).
- [API reference](/packages/mobile/api).
- [Capacitor documentation](https://capacitorjs.com/docs).
- [Platform](/packages/platform) and [Storage](/packages/storage).
- [Web](/packages/web), [Desktop](/packages/desktop) and [Tauri](/packages/tauri).
- [Platforms](/docs/platforms).
