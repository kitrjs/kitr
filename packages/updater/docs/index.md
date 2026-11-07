---
title: Updater
description: Tell people a new version is ready and update the app in place, on the web, desktop and mobile.
order: 1
---

# Updater

`updater.check()` and `updater.apply()` with one state machine wherever the app runs. On the web the driver watches the service worker and applies by activating the waiting worker and reloading. Desktop packages register the Tauri or Electron updater, which downloads and restarts; mobile packages report the store version or a live-update bundle.

## Install

```sh
kitr add updater
```

```ts
// config/updater.ts
import { defineConfig } from 'kitr/updater'

export default defineConfig({
  checkOnBoot: true,
  interval: 60 * 60 * 1000, // look again every hour while open
  auto: false, // true: apply as soon as one is ready, without asking
})
```

## In a component

```tsx
import { useUpdate } from 'kitr/updater/react'

function UpdateBanner() {
  const { available, update, status, progress, apply, dismiss } = useUpdate()
  if (!available) return null
  return (
    <div role="status">
      Version {update?.version} is ready.
      <button onClick={apply} disabled={status === 'downloading'}>
        {status === 'downloading' ? `Updating ${Math.round(progress * 100)}%` : 'Restart to update'}
      </button>
      <button onClick={dismiss}>Later</button>
    </div>
  )
}
```

`dismiss()` hides that version until a newer one appears. `status` runs `idle → checking → available → downloading → ready`, with `up-to-date` and `error` as end states.

## Drivers

Platform packages register under the `updater` capability. Tests pass `createMemoryUpdaterDriver({ next })` and call `driver.announce(info)` to simulate a background update.

## Where it runs

| Where it runs | Driver |
| --- | --- |
| Browser | The service worker from the [web](/packages/web) platform's `pwa` option. Applying activates the new worker and reloads. |
| Desktop | The Tauri or Electron updater, through the [desktop](/packages/desktop) package. It downloads, installs and restarts. |
| iOS, Android | The store version, or a live-update bundle, through the [mobile](/packages/mobile) package |

| Option | Default | Description |
| --- | --- | --- |
| `checkOnBoot` | `true` | Check as soon as the app starts. |
| `interval` | none | Check again every N milliseconds while the app is open. |
| `auto` | `false` | Apply as soon as an update is ready, without asking. Fine for a kiosk, surprising for anyone halfway through a form. |
| `driver` | the platform's | Replace the driver, for tests. |
