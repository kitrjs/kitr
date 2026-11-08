---
title: Overview
description: Know where your app is running, whether it is online or in the background, and handle the back button and deep links.
order: 0
---

# Platform

An app that ships to the browser, a phone and a desktop window keeps asking the same questions: where am I running, am I online, did the user press back, which link opened me, how big is the notch. Answered ad hoc, those questions become user-agent sniffing and `window.Capacitor` checks scattered through components, each one wrong on at least one platform.

`@kitr/platform` answers them once, with one service and a set of hooks, whatever the app is running in.

## What it is

`@kitr/platform` is a `platform` service and React hooks: `usePlatform`, `useOnline`, `useAppState`, `useBackButton`, `useDeepLink`, `useSafeArea` and `useFormFactor`. Components ask the service and never check where they run. `<Only>` and `<Except>` render a piece on some platforms, `perPlatform()` picks an implementation per platform, and `forPlatform()` matches a platform or an operating system.

It runs on both sides. In the browser and in native shells it reports the real device; during server rendering it returns safe defaults (online, in the foreground, no insets), so the first render matches the HTML. For device features such as the camera, biometrics or haptics, use [native](/packages/native) instead.

## Built on

`@kitr/platform` is built on the kitr driver registry. Each platform package registers a `PlatformDriver` for the place it runs, and the service wraps whichever one is active, filling every gap with a browser default:

| Platform package | Driver |
| --- | --- |
| [Web](/packages/web) | The browser: `navigator.onLine`, visibility, the History API. |
| [Mobile](/packages/mobile) | [Capacitor](https://capacitorjs.com/docs/apis/app): app state, back button, deep links, safe areas. |
| [Desktop](/packages/desktop) | Electron: app version, external links, exit. |
| [Tauri](/packages/tauri) | Tauri: the same through its plugins. |

kitr adds the service, the hooks, the server defaults, the form-factor breakpoints, the platform-matching helpers and a devtools panel that shows what the driver reports.

## Problems it solves

- **User-agent sniffing in components.** `usePlatform()` tells you the type and OS from the active driver. See [Show where the app runs](/packages/platform/guide#show-where-the-app-runs).
- **Different code per platform.** `perPlatform()` and `<Only>` keep the branches declarative. See [Pick an implementation per platform](/packages/platform/guide#pick-an-implementation-per-platform).
- **Phone and desktop layouts.** `useFormFactor()` gives width class, orientation and input kind. See [Adapt to the form factor](/packages/platform/guide#adapt-to-the-form-factor).
- **Work that keeps running in the background.** `useAppState()` pauses polling when the app is hidden. See [Pause work in the background](/packages/platform/guide#pause-work-in-the-background).
- **A back button that closes the app.** `useBackButton()` lets the current screen handle it first. See [Handle the back button](/packages/platform/guide#handle-the-back-button).
- **Deep links and the notch.** `useDeepLink()` routes the opening URL; `useSafeArea()` gives the insets. See [Route deep links](/packages/platform/guide#route-deep-links) and [Respect the notch and home indicator](/packages/platform/guide#respect-the-notch-and-home-indicator).

## Further reading

- [Guide](/packages/platform/guide): install, configure and every task.
- [API reference](/packages/platform/api): every export and type.
- [Capacitor App plugin](https://capacitorjs.com/docs/apis/app): what the mobile driver reports.
- [Web](/packages/web), [Mobile](/packages/mobile), [Desktop](/packages/desktop) and [Tauri](/packages/tauri): the drivers.
- [Platforms](/docs/platforms): every platform type and the commands they share.
