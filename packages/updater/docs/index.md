---
title: Updater
description: Tell people a new version is ready and update the app in place, on the web, desktop and mobile.
order: 1
---

# Updater

You ship a fix, but Ada keeps a tab on `app.acme.com` open all week and never reloads it, and installed apps run the old version until someone updates. `@kitr/updater` notices when a new version is ready, tells people with a banner, and updates the app in place when they click it.

> [!SUMMARY]
> Tells people a new version is ready and updates the app in place on web, desktop and mobile. Add it with `kitr add updater`; the overview is at [/packages/updater](/packages/updater).

It is one `check()` and `apply()` flow with one status, whatever does the updating. In the browser the driver watches the [service worker](https://developer.mozilla.org/docs/Web/API/Service_Worker_API) that the [Web](/packages/web) platform's `pwa` option builds; desktop and mobile shells plug in their own driver. kitr adds periodic checks, "remind me later", a React hook, a ready-made banner and a memory driver for tests. It runs in the browser only; to keep data fresh between versions, use [Query](/packages/query).

This guide follows Acme's orders app: version 2.4.0 ships, Ada sees "Version 2.4.0 is ready", and one click moves her to it.

## Install

```sh
kitr add updater
```

<details>
<summary>Everything kitr add changes</summary>

- Installs `@kitr/updater` and adds it and its provider to `kitrrc.ts`.
- Writes `config/updater.ts` (see [Configure](#configure)).
- Writes `app/components/update-banner.tsx`, a banner hidden until an update is ready (see [Show your first update banner](#show-your-first-update-banner)).
- Adds a `## kitr: updater` section to `AGENTS.md`.

It adds no environment variables or scripts and asks no questions. No kit includes it. Preview with `kitr add updater --dry-run`.

`kitr remove updater` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/updater.ts`. It leaves `app/components/update-banner.tsx` because you may have edited it, and lists the files that still import `@kitr/updater`.

</details>

## Configure

`kitr add` writes this file:

```ts
// config/updater.ts
import { defineConfig } from '@kitr/updater'

export default defineConfig({
  checkOnBoot: true,
  interval: 60 * 60 * 1000, // look again every hour while the app is open
  auto: false, // true applies as soon as an update is ready, without asking
})
```

| Option | Default | Description |
| --- | --- | --- |
| `checkOnBoot` | `true` | Check once as the app starts. |
| `interval` | none | Check again every this many milliseconds while the app is open. Without it the app checks at start only. The generated file sets one hour. |
| `auto` | `false` | Apply as soon as an update is found, without asking. |
| `driver` | registered, else the driver for the runtime | An `UpdaterDriver` that replaces the one the service would pick. For tests and custom shells. |
| `fallbackToWeb` | `false` | In Electron, Tauri or Capacitor with no updater driver, use the service-worker driver inside the webview instead of throwing `E_DRIVER_UNAVAILABLE`. |

The service picks its driver in this order: `driver` from the config, a driver a provider registered under `updater`, then the runtime's default: the service-worker driver in a browser, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set. The generated file only adds the hourly `interval` to the defaults.

For the browser to have something to update, turn on the service worker in the web platform. `registerType: 'prompt'` is the default and what the updater expects: the new worker waits until you apply it.

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'

export default defineKitrConfig({
  // ...
  platforms: {
    site: web({ mode: 'spa', pwa: true }),
  },
})
```

## Show your first update banner

`kitr add` writes this component:

```tsx
// app/components/update-banner.tsx
import { useUpdate } from '@kitr/updater/react'

/** Mount once in the root layout. Hidden until the updater has something ready. */
export function UpdateBanner() {
  const { available, update, status, progress, apply, dismiss } = useUpdate()
  if (!available) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-foreground p-3 text-sm text-background">
      <span>Version {update?.version} is ready.</span>
      <button type="button" className="rounded-md bg-background px-3 py-1 text-foreground" onClick={apply} disabled={status === 'downloading'}>
        {status === 'downloading' ? `Updating ${Math.round(progress * 100)}%` : 'Restart to update'}
      </button>
      <button type="button" className="underline" onClick={dismiss}>
        Later
      </button>
    </div>
  )
}
```

Mount it once, in the root route:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { UpdateBanner } from '#app/components/update-banner'

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <UpdateBanner />
        <Scripts />
      </body>
    </html>
  )
}
```

Deploy a new build while Ada has the app open. Within the hour (or at her next visit) a bar appears: "Version new is ready. **Restart to update** · Later". She clicks, the page reloads on the new build, and the bar is gone. The service-worker driver does not know version numbers, so it reports `new` until you give it one; see [Show version numbers on the web](#show-version-numbers-on-the-web).

On the server `useUpdate()` reports `idle` with nothing available, so the banner renders nothing until the browser finds an update.

## Follow the update status

`useUpdate()` returns the updater's state plus three actions:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `UpdateStatus` | Where the flow is; see below. |
| `available` | `boolean` | `true` while `status` is `available` or `ready`. Show the banner on this. |
| `update` | `UpdateInfo \| null` | `{ version, notes?, date?, size? }` of the update found. |
| `progress` | `number` | `0` to `1` while downloading. |
| `error` | `Error \| null` | Why the last check or apply failed. |
| `currentVersion` | `string \| null` | The running version, when the driver knows it. |
| `check` | `() => Promise<UpdateInfo \| null>` | Look now. |
| `apply` | `() => Promise<void>` | Download and install. |
| `dismiss` | `() => void` | Hide this version. |

`status` moves through these values:

| Status | Meaning |
| --- | --- |
| `idle` | Nothing has happened yet. Also what the first render sees. |
| `checking` | A check is running. |
| `available` | An update was found and not applied. |
| `downloading` | `apply()` is running; `progress` moves. |
| `ready` | Installed. The driver usually restarts or reloads the app at this point. |
| `up-to-date` | The last check found nothing, or the person dismissed the update. |
| `error` | The last check or apply failed; `error` says why. |

A typical run is `idle → checking → available → downloading → ready`. A check during `downloading` or `ready` is skipped, so the hourly check never interrupts a download.

## Check for updates by hand

Add a "Check for updates" item to a settings page. `check()` resolves to the update, or `null` when the app is current:

```tsx
// app/components/settings/check-for-updates.tsx
import { useUpdate } from '@kitr/updater/react'

export function CheckForUpdates() {
  const { status, check, currentVersion } = useUpdate()
  return (
    <section>
      <p>Acme Orders {currentVersion ?? ''}</p>
      <button type="button" onClick={check} disabled={status === 'checking'}>
        {status === 'checking' ? 'Checking…' : 'Check for updates'}
      </button>
      {status === 'up-to-date' && <p>You're on the latest version.</p>}
    </section>
  )
}
```

When something is found, `status` becomes `available` and the root-layout banner shows it. A check never throws: a failure sets `status: 'error'` and `error`, and resolves to `null`.

## Apply an update

`apply()` downloads (where the driver needs to) and installs, moving `progress` from 0 to 1. Repeat calls while an apply is running or done do nothing, so a double click installs once.

```tsx
// app/components/settings/update-now.tsx
import { useUpdate } from '@kitr/updater/react'

export function UpdateNow() {
  const { status, update, progress, apply } = useUpdate()
  if (status !== 'available' && status !== 'downloading') return null
  return (
    <div>
      <p>Version {update?.version} is ready.</p>
      {update?.notes && <p>{update.notes}</p>}
      <progress value={progress} max={1} />
      <button type="button" onClick={apply} disabled={status === 'downloading'}>
        Install now
      </button>
    </div>
  )
}
```

What "install" means depends on the driver: the service-worker driver activates the waiting worker (waiting up to two seconds) and reloads; a desktop driver downloads the installer and restarts. With no update found, `apply()` does nothing.

> [!WARNING] Unsaved work is lost
> Applying reloads or restarts the app. Don't call `apply()` while someone is halfway through a form; let them choose the moment.

## Let people postpone an update

`dismiss()` hides the current update until a different version appears:

```tsx
// app/components/settings/remind-me-later.tsx
import { useUpdate } from '@kitr/updater/react'

export function RemindMeLater() {
  const { update, dismiss } = useUpdate()
  if (!update) return null
  return (
    <button type="button" onClick={dismiss}>
      Remind me about {update.version} later
    </button>
  )
}
```

After Ada dismisses 2.4.0, the hourly check still finds it but keeps the banner hidden until 2.4.1 ships. The dismissal lives in memory, so a reload shows 2.4.0 again at the next check.

## Apply updates without asking

For a kiosk or a wall display nobody touches, set `auto: true`: every update found, or announced by the driver, is applied at once:

```ts
// config/updater.ts
import { defineConfig } from '@kitr/updater'

export default defineConfig({
  checkOnBoot: true,
  interval: 15 * 60 * 1000,
  auto: true,
})
```

> [!WARNING] Keep auto off for forms
> On the web, `auto: true` reloads the page by itself when a new build is deployed. Keep `auto: false` for anything people type into.

## Show version numbers on the web

A service worker does not know your version numbers, so the default web driver reports `update.version` as `'new'` and `currentVersion` as `'0.0.0'`. Give it the running version and it reports `'2.3.0'` and `'2.3.0+'` for the waiting build. Set the driver yourself in the config:

```ts
// config/updater.ts
import { createServiceWorkerUpdaterDriver, defineConfig } from '@kitr/updater'
import { env } from '#app/env'

export default defineConfig({
  driver: createServiceWorkerUpdaterDriver({ version: env.VITE_APP_VERSION }),
  checkOnBoot: true,
  interval: 60 * 60 * 1000,
  auto: false,
})
```

Declare `VITE_APP_VERSION` in `app/env.ts` and set it in your build ([Offline](/packages/offline) adds the same variable). For real version strings, serve a small JSON file with each deploy and write a driver that reads it, as under [Extend](#extend). Without a registered worker, `check()` resolves to `null` and the status is `up-to-date`.

## Handle a failed update

Neither `check()` nor `apply()` throws. A failure sets `status: 'error'` and keeps the reason in `error`; a later `check()` clears it:

```tsx
// app/components/settings/update-error.tsx
import { useUpdate } from '@kitr/updater/react'

export function UpdateError() {
  const { status, error, check } = useUpdate()
  if (status !== 'error') return null
  return (
    <p role="alert">
      Couldn't update: {error?.message}.{' '}
      <button type="button" onClick={check}>
        Try again
      </button>
    </p>
  )
}
```


## Use it outside React

Outside components, read the service from the app's container with `useUpdater(app)`:

```ts
// app/lib/settings/updates-on-focus.ts
import type { KitrApp } from 'kitr/app'
import { useUpdater } from '@kitr/updater'

export function checkWhenFocused(app: KitrApp) {
  const updater = useUpdater(app) // same as app.container.use('updater')
  const onFocus = () => void updater.check()
  window.addEventListener('focus', onFocus)
  const off = updater.subscribe(() => {
    if (updater.state.status === 'available') console.info('Update', updater.state.update?.version)
  })
  return () => {
    window.removeEventListener('focus', onFocus)
    off()
  }
}
```

`updater.state` is a fresh object after every change; `subscribe(listener)` returns an unsubscribe function. `updater.stop()` ends the interval and the driver's listener; the provider calls it at shutdown. To build a service with no app, call `createUpdater(config)`. With [Devtools](/packages/devtools) installed, the service logs `available`, `applied` and failed checks under `updater`.

## Where updates come from

| Where it runs | Driver | What `apply()` does |
| --- | --- | --- |
| Browser with `pwa` on | `createServiceWorkerUpdaterDriver()` | Activates the waiting worker and reloads the page. |
| Browser without a service worker | The same driver | Nothing to apply: every check is `up-to-date`. |
| Mobile shell (Capacitor) | `createCapacitorUpdaterDriver()`, the store | Android: runs Play's in-app update. iOS: opens the App Store page. |
| Server | None; the provider binds nothing | Not available. |
| Electron | `createElectronDriver()`: `electron-updater` | Downloads the installer, then quits and installs. |
| Tauri | `createTauriDriver()`: `@tauri-apps/plugin-updater` | Downloads and installs the signed update, then relaunches. |

### Capacitor

In the [Mobile](/packages/mobile) shell the service asks the store, not a server of yours, through `@capawesome/capacitor-app-update`, an optional peer that `kitr add updater` installs when the project has the mobile platform.

| Call | Android | iOS |
| --- | --- | --- |
| `check()` | Asks Google Play. An update is available when Play reports one; `version` is its version name (or code). | Looks the app up in the App Store by its bundle id. |
| `apply()` | Downloads in the background and restarts. Priority 4 and 5 updates use Play's full-screen flow. | Opens the App Store page: iOS cannot install in place. |
| `currentVersion()` | The installed version name. | The installed version. |

The driver sets no `onAvailable`, so the banner appears after `check()`, which `checkOnBoot` and `interval` run. Play only offers an update to an app installed from Play: a debug build or sideloaded APK always checks as up to date.

```tsx
// app/components/update-banner.tsx
import { useUpdate } from '@kitr/updater/react'

export function UpdateBanner() {
  const { available, update, status, progress, apply } = useUpdate()
  if (!available) return null
  return (
    <button type="button" onClick={apply} disabled={status === 'downloading'}>
      {status === 'downloading' ? `Updating ${Math.round(progress * 100)}%` : `Update to ${update?.version}`}
    </button>
  )
}
// Android flexible update => "Updating 40%" ... then the app restarts
// iOS => opens apps.apple.com/app/id...
```

[Mobile](/packages/mobile) registers only `platform` and `storage` drivers; to update an installed mobile app any other way, register a driver as under [Extend](#extend).

## Use it in Electron and Tauri

In a desktop shell the updater replaces the installed app. `check()` asks the update feed, `apply()` downloads with progress and restarts, and `currentVersion()` reads the app's version. `config/updater.ts` is unchanged.

### Electron

The driver runs [`electron-updater`](https://www.electron.build/auto-update) in the main process over the `kitr:updater:*` channels that `handleKitrIpc(ipcMain, app)` serves. Nothing downloads until `apply()`. Point the feed at your release server in `electron-builder.yml`:

```yaml
# platforms/app/electron-builder.yml
publish:
  provider: generic
  url: https://updates.acme.com/orders/
```

Requirements:

- `electron-updater` in the app's `dependencies` (not dev), so electron-builder packs it. `kitr add desktop` and `kitr add updater` install it; when it is missing, every method rejects with `E_DRIVER_UNAVAILABLE`.
- A packaged, signed build: `electron-updater` does nothing in development, and macOS only installs from a signed and notarized app.
- `handleKitrIpc()` in `main.ts` and `exposeIpc()` in the preload script.

### Tauri

The driver uses [`@tauri-apps/plugin-updater`](https://v2.tauri.app/plugin/updater/) and [`plugin-process`](https://v2.tauri.app/plugin/process/): `check()` returns the signed update `tauri.conf.json` points at, and `apply()` downloads, installs and relaunches. Updates are signed: generate a key pair with `tauri signer generate`, put the public key and endpoints in `tauri.conf.json`, and sign builds with the private key:

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "<the public key from tauri signer generate>",
      "endpoints": ["https://updates.acme.com/orders/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

Requirements:

- `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` in `package.json` (`kitr add tauri` and `kitr add updater` install them); a missing one rejects with `E_DRIVER_UNAVAILABLE`.
- `tauri-plugin-updater` and `tauri-plugin-process` in `src-tauri/Cargo.toml`, and `updater:default` and `process:default` in `capabilities/default.json`. The Tauri scaffold writes them, and registers the updater plugin in `lib.rs` only once `plugins.updater` exists, because the plugin refuses to start without a public key. Until then `check()` sets `status: 'error'`.

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `E_DRIVER_UNAVAILABLE` (`KitrError`, `data.runtime`, `data.package`) | A native shell has no updater driver. Thrown at boot. | Register a driver, or set `fallbackToWeb: true`. |


## Testing

`createMemoryUpdaterDriver({ version, next })` stands in for a real updater:

| Member | Description |
| --- | --- |
| `next` | The update the next `check()` finds, or `null`. Set it in the options or assign it later. |
| `applied` | Every update that `apply()` installed. |
| `announce(info)` | Simulates the driver finding an update on its own, as a service worker does. |
| `currentVersion()` | Resolves to `version`, default `'1.0.0'`. |

`apply()` reports progress `0.5` then `1`, records `next` in `applied` and clears `next`.

The provider only binds the updater in the browser environment, so create the test app with `environment: 'client'`:

```tsx
// app/components/update-banner.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryUpdaterDriver } from '@kitr/updater'
import { updaterProvider } from '@kitr/updater/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { UpdateBanner } from './update-banner'

async function setup(next: { version: string } | null) {
  const driver = createMemoryUpdaterDriver({ version: '2.3.0', next })
  const app = await createTestApp({
    environment: 'client',
    providers: [updaterProvider],
    config: { updater: { driver } },
  })
  return { app, driver }
}

describe('update banner', () => {
  it('shows the new version and installs it', async () => {
    const { app, driver } = await setup({ version: '2.4.0' })
    renderWithKitr(<UpdateBanner />, { app })
    await screen.findByText('Version 2.4.0 is ready.')
    fireEvent.click(screen.getByRole('button', { name: 'Restart to update' }))
    await waitFor(() => expect(driver.applied).toEqual([{ version: '2.4.0' }]))
    expect(app.container.use('updater').state).toMatchObject({ status: 'ready', progress: 1 })
  })

  it('stays hidden after Later until a newer version ships', async () => {
    const { app, driver } = await setup({ version: '2.4.0' })
    renderWithKitr(<UpdateBanner />, { app })
    fireEvent.click(await screen.findByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('status')).toBeNull()
    driver.announce({ version: '2.4.0' })
    expect(screen.queryByRole('status')).toBeNull()
    driver.announce({ version: '2.4.1' })
    await screen.findByText('Version 2.4.1 is ready.')
  })

  it('renders nothing when the app is current', async () => {
    const { app } = await setup(null)
    renderWithKitr(<UpdateBanner />, { app })
    await waitFor(() => expect(app.container.use('updater').state.status).toBe('up-to-date'))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
```

The provider checks at boot, so the banner finds `2.4.0` without a click. For code that takes the service directly, `createUpdater({ driver })` needs no app; call `updater.stop()` at the end of a test that sets `interval`.

## Extend

A driver implements `UpdaterDriver`:

```ts
interface UpdaterDriver {
  name: string
  check(): Promise<UpdateInfo | null> // null when current
  apply(onProgress?: (fraction: number) => void): Promise<void> // fraction 0..1
  onAvailable?(listener: (info: UpdateInfo) => void): () => void // for updates found in the background
  currentVersion?(): Promise<string>
}
```

The smallest useful driver for the web reads a `version.json` that each deploy writes next to `index.html` (for example `{ "version": "2.4.0", "notes": "Faster invoice search" }`) and reloads to apply:

```ts
// app/updater/version-file-driver.ts
import type { UpdateInfo, UpdaterDriver } from '@kitr/updater'

export function versionFileDriver(running: string): UpdaterDriver {
  return {
    name: 'version-file',
    async check() {
      const response = await fetch('/version.json', { cache: 'no-store' })
      if (!response.ok) throw new Error(`version.json: HTTP ${response.status}`)
      const latest = (await response.json()) as UpdateInfo
      return latest.version !== running ? latest : null
    },
    async apply(onProgress) {
      onProgress?.(1)
      location.reload()
    },
    currentVersion: async () => running,
  }
}
```

```ts
// config/updater.ts
import { defineConfig } from '@kitr/updater'
import { env } from '#app/env'
import { versionFileDriver } from '#app/updater/version-file-driver'

export default defineConfig({
  driver: versionFileDriver(env.VITE_APP_VERSION),
  checkOnBoot: true,
  interval: 60 * 60 * 1000,
  auto: false,
})
```

The banner now reads "Version 2.4.0 is ready." For an app without a service worker, this is the whole update flow.

For another shell's updater, register a driver for it: `app.drivers.register('updater', driver, { platform: 'desktop' })` in a provider. The `UpdaterDriver` and `UpdateInfo` types are in the [API reference](/packages/updater/api).

## Next steps

- [API reference](/packages/updater/api): every export with its signature.
- [Web](/packages/web): the `pwa` option that builds the service worker.
- [Desktop](/packages/desktop): the Electron shell an installed-app driver plugs into.
