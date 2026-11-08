---
title: Overview
description: Tell people a new version is ready and update the app in place, on the web, desktop and mobile.
order: 0
---

# Updater

You ship a fix, but someone keeps a tab open all week and never reloads it. Installed apps are worse: they run the old version until someone thinks to update. Each platform has its own update mechanism, and each needs the same UI: notice, banner, apply, retry.

`@kitr/updater` notices when a new version is ready, tells people, and updates the app in place, with one status whatever does the updating.

## What it is

`@kitr/updater` is one `check()` and `apply()` flow with one status: idle, checking, ready, applying, failed. The provider checks periodically, `useUpdate` gives a component the status and the new version, and a ready-made banner shows "Version 2.4.0 is ready" with an update button and "later". Apply moves the app to the new version without losing the person's place.

It runs in the browser only; on the server the provider binds nothing. To keep data fresh between versions, use [query](/packages/query); this package is about the app's own code.

## Install

```sh
kitr add updater
```

This installs `@kitr/updater`, registers the provider in `kitrrc.ts`, writes `config/updater.ts` and a ready-made banner in `app/components/update-banner.tsx`. The guide's [Install](/packages/updater/guide#install) section lists every change.

## Quick start

`kitr add` writes this component. `useUpdate()` reports what the driver found and offers `apply` and `dismiss`:

```tsx
// app/components/update-banner.tsx
import { useUpdate } from '@kitr/updater/react'

/** Mount once in the root layout. Hidden until the updater has something ready. */
export function UpdateBanner() {
  const { available, update, status, progress, apply, dismiss } = useUpdate()
  if (!available) return null
  return (
    <div role="status">
      <span>Version {update?.version} is ready.</span>
      <button type="button" onClick={apply} disabled={status === 'downloading'}>
        {status === 'downloading' ? `Updating ${Math.round(progress * 100)}%` : 'Restart to update'}
      </button>
      <button type="button" onClick={dismiss}>
        Later
      </button>
    </div>
  )
}
```

Mount `<UpdateBanner />` once in `app/document.tsx`, next to `<Outlet />`. Deploy a new build while Ada has the app open. Within the hour, or at her next visit, the bar appears: "Version new is ready. **Restart to update** · Later". She clicks **Restart to update**, the page reloads on the new build, and the bar is gone. A desktop or mobile updater plugs in as a driver and reports `progress` while it downloads. The guide continues from here: [Show your first update banner](/packages/updater/guide#show-your-first-update-banner).

## Built on

| Where | Driver built on |
| --- | --- |
| Web | The [service worker](https://developer.mozilla.org/docs/Web/API/Service_Worker_API) that the [web](/packages/web) platform's `pwa` option builds with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/). Applying activates the waiting worker and reloads. |
| Desktop | [electron-updater](https://www.electron.build/auto-update) or Tauri's updater, through a driver the shell registers. |
| Mobile | A store or over-the-air driver the shell registers. |

kitr adds the status machine, periodic checks, "remind me later", the React hook, the banner, a memory driver for tests and the `UpdaterDriver` interface.

## Problems it solves

- **Stale tabs running old code.** The banner appears when a new version is ready. See [Show your first update banner](/packages/updater/guide#show-your-first-update-banner).
- **Update UI written per platform.** One status and one hook on every platform. See [Follow the update status](/packages/updater/guide#follow-the-update-status).
- **Interrupting someone mid-task.** "Later" postpones, and you decide for how long. See [Let people postpone an update](/packages/updater/guide#let-people-postpone-an-update).
- **Kiosks and internal tools that should always be current.** Apply updates without asking. See [Apply updates without asking](/packages/updater/guide#apply-updates-without-asking).
- **Updates that fail silently.** The failed status carries the error, and a retry is one call. See [Handle a failed update](/packages/updater/guide#handle-a-failed-update).

## Further reading

- [Guide](/packages/updater/guide): install, configure and every task.
- [API reference](/packages/updater/api): every export and type.
- [vite-plugin-pwa: prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update) and [electron-updater](https://www.electron.build/auto-update): the mechanisms the drivers wrap.
- [Web](/packages/web), [Desktop](/packages/desktop) and [Offline](/packages/offline): the service worker, the installed-app shell, and data kept across versions.
