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
