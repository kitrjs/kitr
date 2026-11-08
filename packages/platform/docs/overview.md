---
title: Overview
description: Know where your app is running, whether it is online or in the background, and handle the back button and deep links.
order: 0
---

# Platform

## What it is

`@kitr/platform` tells components where they run: web, desktop or mobile, which OS, online or not, in the foreground or not, with which safe areas. Hooks like `usePlatform` and `useOnline` replace user-agent checks; `<Only>` and `perPlatform()` pick what to render.

Runs on both sides, with safe defaults during server rendering. For the camera or biometrics, use [native](/packages/native).

## Install

```sh
kitr add platform
```

Adds `@kitr/platform`, its provider and `config/platform.ts`. The desktop, tauri and mobile packages add it for you. [Every change](/packages/platform/guide#install).

## Quick start

`usePlatform()` returns the `platform` service. Render it to see what kitr detected:

```tsx
// app/components/platform-badge.tsx
import { usePlatform } from '@kitr/platform/react'

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

In Chrome on a Mac it shows `web · macos`. In the iOS simulator, `mobile · ios · native`. In an Electron window, `desktop · macos · native`. Next in the guide: [Show where the app runs](/packages/platform/guide#show-where-the-app-runs).

## Built on

`@kitr/platform` is built on the kitr driver registry. Each platform package registers a `PlatformDriver` for the place it runs, and the service wraps whichever one is active, filling every gap with a browser default:

| Platform package | Driver |
| --- | --- |
| [Web](/packages/web) | The browser: `navigator.onLine`, visibility, the History API. |
| [Mobile](/packages/mobile) | [Capacitor](https://capacitorjs.com/docs/apis/app): app state, back button, deep links, safe areas. |
| [Desktop](/packages/desktop) | Electron: app version, external links, exit. |
| [Tauri](/packages/tauri) | Tauri: the same through its plugins. |

kitr adds the service, the hooks, the server defaults, form-factor breakpoints and a devtools panel.

## Problems it solves

- **User-agent sniffing in components.** [Show where the app runs](/packages/platform/guide#show-where-the-app-runs).
- **Different code per platform.** [Pick an implementation per platform](/packages/platform/guide#pick-an-implementation-per-platform).
- **Phone and desktop layouts.** [Adapt to the form factor](/packages/platform/guide#adapt-to-the-form-factor).
- **Work that keeps running in the background.** [Pause work in the background](/packages/platform/guide#pause-work-in-the-background).
- **A back button that closes the app.** [Handle the back button](/packages/platform/guide#handle-the-back-button).
- **Deep links and the notch.** [Route deep links](/packages/platform/guide#route-deep-links).

## Further reading

- [Guide](/packages/platform/guide).
- [API reference](/packages/platform/api).
- [Capacitor App plugin](https://capacitorjs.com/docs/apis/app).
- [Web](/packages/web), [Mobile](/packages/mobile), [Desktop](/packages/desktop) and [Tauri](/packages/tauri).
- [Platforms](/docs/platforms).
