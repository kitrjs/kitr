---
title: Overview
description: Tell people a new version is ready and update the app in place, on the web, desktop and mobile.
order: 0
---

# Updater

## What it is

`@kitr/updater` tells people a new version is ready and applies it in place. One `check()` and `apply()` flow, one status, a `useUpdate` hook and a ready-made banner.

Runs in the browser only. The web driver watches the service worker; desktop and mobile plug in their own.

## Install

```sh
kitr add updater
```

Adds `@kitr/updater`, its provider, `config/updater.ts` and a banner in `app/components/update-banner.tsx`. [Every change](/packages/updater/guide#install).

## Quick start

`kitr add` writes this banner:

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

Mount it once in `app/document.tsx`. Deploy a new build and the bar appears: "Version new is ready. **Restart to update** · Later". One click reloads on the new build. Next in the guide: [Show your first update banner](/packages/updater/guide#show-your-first-update-banner).

## Built on

| Where | Driver built on |
| --- | --- |
| Web | The [service worker](https://developer.mozilla.org/docs/Web/API/Service_Worker_API) that the [web](/packages/web) platform's `pwa` option builds with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/). Applying activates the waiting worker and reloads. |
| Desktop | [electron-updater](https://www.electron.build/auto-update) or Tauri's updater, through a driver the shell registers. |
| Mobile | A store or over-the-air driver the shell registers. |

kitr adds the status machine, periodic checks, "remind me later", the hook, the banner and the `UpdaterDriver` interface.

## Problems it solves

- **Stale tabs running old code.** [Show your first update banner](/packages/updater/guide#show-your-first-update-banner).
- **Update UI written per platform.** [Follow the update status](/packages/updater/guide#follow-the-update-status).
- **Interrupting someone mid-task.** [Let people postpone an update](/packages/updater/guide#let-people-postpone-an-update).
- **Kiosks and internal tools that should always be current.** [Apply updates without asking](/packages/updater/guide#apply-updates-without-asking).
- **Updates that fail silently.** [Handle a failed update](/packages/updater/guide#handle-a-failed-update).

## Further reading

- [Guide](/packages/updater/guide).
- [API reference](/packages/updater/api).
- [vite-plugin-pwa: prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update) and [electron-updater](https://www.electron.build/auto-update).
- [Web](/packages/web), [Desktop](/packages/desktop) and [Offline](/packages/offline).
