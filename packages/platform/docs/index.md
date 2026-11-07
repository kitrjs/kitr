---
title: Platform
description: Know where your app is running, whether it is online or in the background, and handle the back button and deep links.
order: 1
---

# Platform

Apps that ship to the web, a desktop shell and a phone keep asking the same questions: where am I running, am I online, did the user press back, what URL opened me, how big are the safe areas. `kitr/platform` answers them once, through a driver the current platform package registers.

## Install

```sh
kitr add platform
```

The [desktop](/packages/desktop) and [mobile](/packages/mobile) platforms add it for you and register their drivers; in a plain browser the default driver uses `navigator.onLine`, `visibilitychange` and `history`.

## Hooks

```tsx
import { useAppState, useBackButton, useDeepLink, useOnline, usePlatform, useSafeArea } from 'kitr/platform/react'

function Shell() {
  const platform = usePlatform() // { type: 'mobile', os: 'ios', native: true, ... }
  const online = useOnline()
  const active = useAppState()
  useBackButton(({ canGoBack }) => { if (!canGoBack) closeSheet() })
  useDeepLink((url) => router.navigate({ to: deepLinkPath(url) }))
  const insets = useSafeArea()
  // ...
}
```

Outside React, `app.container.use('platform')` is the same object, and `perPlatform(platform, { ios: () => ..., default: () => ... })` picks an implementation by OS, type or nativeness.

## Devtools

The Platform panel in the devtools overlay shows the detected platform, the registered drivers, the app state and the last deep link.
