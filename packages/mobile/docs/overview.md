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
