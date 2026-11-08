---
title: Overview
description: Ship the same app to iPhone and Android, with every kitr package switched to its native version.
order: 0
---

# Mobile

Your customers want the app on their phone: an icon on the home screen, an Android back button that works, data that survives the OS clearing its caches. A separate native codebase doubles the work. A web view alone leaves the back button, deep links and storage behaving like a browser tab.

`@kitr/mobile` is the iOS and Android platform. It wraps the `app/` you already ship to the browser and switches kitr's packages to their native drivers while it runs on a phone.

## What it is

`@kitr/mobile` adds a mobile platform to `kitrrc.ts`. `kitr dev` runs the app on a simulator or device with live reload, `kitr build` builds the bundle and syncs it into the Xcode and Android Studio projects, and the provider registers the native drivers: [platform](/packages/platform) learns about the back button, deep links, app state and safe areas, and [storage](/packages/storage) moves to native preferences. Components call Capacitor plugins through `isPluginAvailable` and stay working in a plain browser.

The provider and `@kitr/mobile/client` run in the app, in the WebView and in a plain browser alike. The platform hooks run in the CLI on your machine. For an installable web app with no store listing, the PWA option of the [web](/packages/web) platform is enough.

## Install

```sh
kitr add mobile phone --appId com.acme.orders --appName "Acme Orders"
```

This installs `@kitr/mobile` with Capacitor and its iOS and Android packages, registers the provider and a `phone` platform in `kitrrc.ts`, and writes `platforms/phone/capacitor.config.ts`. It adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first when they are missing. You need Xcode or Android Studio on the machine. The guide's [Install](/packages/mobile/guide#install) section lists every change.

## Quick start

Build once to create the native projects, then show where the app runs on the home page:

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

The iOS simulator opens Acme Orders and shows "Running on ios in the native app". Edit the component and the app updates in place. The same page in a browser at `kitr dev site` says "in the browser". The guide continues from here: [Run the app on a phone](/packages/mobile/guide#run-the-app-on-a-phone).

## Built on

`@kitr/mobile` is built on [Capacitor](https://capacitorjs.com/docs). Your client build runs in the system WebView, and Capacitor plugins reach native APIs: `@capacitor/app` for app state, the back button and deep links, `@capacitor/preferences` for storage, and any other plugin you add.

kitr adds the platform contract (`kitr dev`, `kitr build`, `kitr doctor`), the generated Capacitor config from `kitrrc.ts`, the custom URL scheme files for deep links, the native drivers for platform and storage, and the `nativeOnly` and `isCapacitor` helpers.

## Problems it solves

- **A second codebase for the phone.** The same `app/` ships to the browser and the phone; only `kitrrc.ts` changes. See [Ship the same app to the web and the phone](/packages/mobile/guide#ship-the-same-app-to-the-web-and-the-phone).
- **A back button that closes the app.** The platform driver routes it to the router, and `useBackButton` lets a screen take over. See [Handle the Android back button](/packages/mobile/guide#handle-the-android-back-button).
- **Links that open the browser instead of the app.** Deep links with your scheme land on the right route. See [Open deep links](/packages/mobile/guide#open-deep-links).
- **Content under the notch.** Safe area insets reach your layout through the platform hooks. See [Respect the notch and home indicator](/packages/mobile/guide#respect-the-notch-and-home-indicator).
- **Storage the OS can wipe.** Storage items move to native preferences on a phone. See [Keep data in native storage](/packages/mobile/guide#keep-data-in-native-storage).
- **Native projects out of step with the web build.** `kitr build` syncs the bundle into Xcode and Android Studio. See [Build and open the native projects](/packages/mobile/guide#build-and-open-the-native-projects).

## Further reading

- [Guide](/packages/mobile/guide): install, configure and every task.
- [API reference](/packages/mobile/api): every export with its signature.
- [Capacitor documentation](https://capacitorjs.com/docs): plugins, native project setup and store publishing.
- [Platform](/packages/platform) and [Storage](/packages/storage): the packages the native drivers plug into.
- [Web](/packages/web), [Desktop](/packages/desktop) and [Tauri](/packages/tauri): the other platforms for the same app.
- [Platforms](/docs/platforms): every platform type and the commands they share.
