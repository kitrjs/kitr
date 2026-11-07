---
title: Updater
description: Tell people a new version is ready and update the app in place, on the web, desktop and mobile.
order: 1
---

# Updater

You ship a fix, but Ada keeps a tab on `app.acme.com` open all week and never reloads it. Installed apps are worse: they run the old version until someone thinks to update. `kitr/updater` notices when a new version is ready, tells people with a banner, and updates the app in place when they click it.

It is one `check()` and `apply()` flow with one status, whatever does the updating. In the browser the driver watches the [service worker](https://developer.mozilla.org/docs/Web/API/Service_Worker_API) that the [Web](/packages/web) platform's `pwa` option builds with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/); applying activates the new worker and reloads. Desktop and mobile shells plug in their own updater as a driver. kitr adds the status machine, periodic checks, "remind me later", a React hook, a ready-made banner and a memory driver for tests.

It runs in the browser only. On the server the provider binds nothing. To keep data fresh between versions, use [Query](/packages/query); this package is about the app's own code.

This guide follows Acme's orders app: version 2.4.0 ships, Ada sees "Version 2.4.0 is ready", and one click moves her to it without losing her place.

## Install

```sh
kitr add updater
```

What `kitr add` does:

- Adds [Platform](/packages/platform) first when the project does not have it yet, because `updater` requires `platform`. The `desktop` and `mobile` kits already include it.
- Installs `@kitr/updater`.
- Adds `() => import('@kitr/updater/provider')` to `providers` in `kitrrc.ts`.
- Adds `@kitr/updater` to `packages` in `kitrrc.ts`.
- Writes `config/updater.ts` (shown under [Configure](#configure)).
- Writes `app/components/update-banner.tsx`, a banner that stays hidden until an update is ready (shown under [Show your first update banner](#show-your-first-update-banner)).
- Adds a `## kitr: updater` section to `AGENTS.md`: `useUpdate()` from `kitr/updater/react` drives the banner, which is mounted once in the root layout; status runs idle, checking, available, downloading, ready; the web driver watches the service worker and desktop and mobile packages register theirs.

It adds no environment variables or scripts. `kitr add updater` asks no questions, and no kit includes it. It is a client package, so a server-only project skips it with a warning. To preview the changes:

```sh
kitr add updater --dry-run
```

`kitr remove updater` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/updater.ts`. It leaves `app/components/update-banner.tsx` because you may have edited it, and lists the files that still import `kitr/updater`.

## Configure

`kitr add` writes this file:

```ts
// config/updater.ts
import { defineConfig } from 'kitr/updater'

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
| `driver` | registered, else the service-worker driver | An `UpdaterDriver` that replaces the one the service would pick. For tests and custom shells. |

The service picks its driver in this order: `driver` from the config, a driver a provider registered under `updater`, then the service-worker driver in a browser. The defaults in the table are what you get without a config file; the file `kitr add` writes only adds the hourly `interval`.

For the browser to have something to update, turn on the service worker in the web platform. `registerType: 'prompt'` is the default and is what the updater expects: the new worker waits until you apply it.

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

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
import { useUpdate } from 'kitr/updater/react'

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
// app/routes/__root.tsx
import { createRootRoute, Outlet } from 'kitr/router'
import { UpdateBanner } from '#app/components/update-banner'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <UpdateBanner />
    </>
  ),
})
```

Deploy a new build while Ada has the app open. Within the hour (or at her next visit) a bar appears at the bottom: "Version new is ready. **Restart to update** · Later". She clicks **Restart to update**, the page reloads on the new build, and the bar is gone. The service-worker driver does not know version numbers, so it reports `new` until you give it one; see [Show version numbers on the web](#show-version-numbers-on-the-web).

The service only exists in the browser. During server rendering `useUpdate()` reports `idle` with nothing available, so the banner renders nothing there and appears once the browser finds an update.

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

The hook reads the state with `useSyncExternalStore`, so a component re-renders on every change and nothing else.

## Check for updates by hand

Add a "Check for updates" item to a settings page. `check()` resolves to the update, or `null` when the app is current:

```tsx
// app/features/settings/check-for-updates.tsx
import { useUpdate } from 'kitr/updater/react'

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

When something is found, `status` becomes `available` and the banner from the root layout shows it, so this page doesn't need its own "Update" button. A check never throws: a failure sets `status: 'error'` and `error`, and resolves to `null`.

## Apply an update

`apply()` downloads (where the driver needs to) and installs, moving `progress` from 0 to 1 on the way. Call it as many times as you like: while an apply is running or done, more calls do nothing, so a double click installs once.

```tsx
// app/features/settings/update-now.tsx
import { useUpdate } from 'kitr/updater/react'

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

What "install" means depends on the driver. The service-worker driver tells the waiting worker to take over, waits for it (up to two seconds) and reloads the page. A desktop driver typically downloads the installer and restarts the app. With no update found, `apply()` does nothing.

Applying reloads or restarts the app, so anything not saved is lost. Don't call `apply()` while someone is halfway through a form; let them choose the moment.

## Let people postpone an update

`dismiss()` hides the current update until a different version appears. It sets `status` to `up-to-date` and `update` to `null`:

```tsx
// app/features/settings/remind-me-later.tsx
import { useUpdate } from 'kitr/updater/react'

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

After Ada dismisses 2.4.0, the hourly check still finds 2.4.0 but keeps the banner hidden. When 2.4.1 ships, it appears again. The dismissal lives in memory, so a reload shows 2.4.0 again at the next check.

## Apply updates without asking

For a kiosk, a wall display or a dashboard nobody touches, set `auto: true`. Every update found by a check, or announced by the driver, is applied at once:

```ts
// config/updater.ts
import { defineConfig } from 'kitr/updater'

export default defineConfig({
  checkOnBoot: true,
  interval: 15 * 60 * 1000,
  auto: true,
})
```

On the web that means the page reloads by itself when a new build is deployed. Keep `auto: false` for anything people type into.

## Show version numbers on the web

A service worker does not know your version numbers, so the default web driver reports `update.version` as `'new'` and `currentVersion` as `'0.0.0'`. Give it your version and it reports `'2.3.0'` as the current one and `'2.3.0+'` for the waiting build. The `version` you pass is the build that is running; the service worker can't tell what the new one is called.

Set the driver yourself in the config, from the version Vite builds in:

```ts
// config/updater.ts
import { createServiceWorkerUpdaterDriver, defineConfig } from 'kitr/updater'
import { env } from '#app/env'

export default defineConfig({
  driver: createServiceWorkerUpdaterDriver({ version: env.VITE_APP_VERSION }),
  checkOnBoot: true,
  interval: 60 * 60 * 1000,
  auto: false,
})
```

Declare `VITE_APP_VERSION` in `app/env.ts` and set it in your build. [Offline](/packages/offline) adds the same variable when you install it. For a real version string in the banner, serve a small JSON file with each deploy and write a driver that reads it, as shown under [Extend](#extend).

The service-worker driver needs a registered worker. Without one, `check()` resolves to `null` and the status is `up-to-date`.

## Handle a failed update

Neither `check()` nor `apply()` throws. A failure sets `status: 'error'` and keeps the reason in `error`:

```tsx
// app/features/settings/update-error.tsx
import { useUpdate } from 'kitr/updater/react'

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

A later `check()` clears `error`. A non-`Error` rejection from the driver, such as `Promise.reject('offline')`, becomes `new Error('offline')`.

## Use it outside React

Outside components, read the service from the app's container. `useUpdater(app)` from `kitr/updater` does the same:

```ts
// app/features/settings/updates-on-focus.ts
import type { KitrApp } from 'kitr/app'
import { useUpdater } from 'kitr/updater'

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

`updater.state` is a fresh object after every change; `subscribe(listener)` calls `listener` with no arguments after each one and returns an unsubscribe function. `updater.stop()` ends the interval and the driver's listener; the provider calls it when the app shuts down. To build a service with no app, call `createUpdater(config)`. When the [Devtools](/packages/devtools) provider is installed, the service logs `available`, `applied` and failed checks and applies under `updater`.

## Where updates come from

| Where it runs | Driver | What `apply()` does |
| --- | --- | --- |
| Browser with `pwa` on | `createServiceWorkerUpdaterDriver()` | Activates the waiting worker and reloads the page. |
| Browser without a service worker | The same driver | Nothing to apply: every check is `up-to-date`. |
| Desktop and mobile shells | The service-worker driver, unless a provider registers one | Same as the browser. |
| Server | None; the provider binds nothing | Not available. |

Today [Desktop](/packages/desktop) and [Mobile](/packages/mobile) register only `platform` and `storage` drivers, not `updater`. To update an installed app, register a driver for your shell's updater, as shown under [Extend](#extend).

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
import { createMemoryUpdaterDriver } from 'kitr/updater'
import { updaterProvider } from 'kitr/updater/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
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
import type { UpdateInfo, UpdaterDriver } from 'kitr/updater'

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
import { defineConfig } from 'kitr/updater'
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

For the Electron shell, run [electron-updater](https://www.electron.build/auto-update) in the main process and reach it over the IPC bridge the desktop platform sets up. Install it with `pnpm add electron-updater`, then handle three channels in main:

```ts
// platforms/app/main.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { handleIpc } from 'kitr/desktop/main'

autoUpdater.autoDownload = false

handleIpc<{
  'updater.check': () => { version: string; notes?: string } | null
  'updater.apply': () => void
}>(ipcMain, {
  'updater.check': async () => {
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    if (!info || info.version === app.getVersion()) return null
    return { version: info.version, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined }
  },
  'updater.apply': async () => {
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  },
})

autoUpdater.on('download-progress', (p) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('updater.progress', p.percent / 100)
})
// ...
```

```ts
// app/providers/electron_updater_provider.ts
import { defineProvider } from 'kitr/app'
import { createIpcClient } from 'kitr/desktop/client'
import type { UpdaterDriver } from 'kitr/updater'

type UpdaterIpc = {
  'updater.check': () => { version: string; notes?: string } | null
  'updater.apply': () => void
}
const ipc = createIpcClient<UpdaterIpc, { 'updater.progress': (fraction: number) => void }>()

function electronUpdater(): UpdaterDriver {
  return {
    name: 'electron-updater',
    check: () => ipc.invoke('updater.check'),
    async apply(onProgress) {
      const off = ipc.on('updater.progress', (fraction) => onProgress?.(fraction))
      try {
        await ipc.invoke('updater.apply')
      } finally {
        off()
      }
    },
  }
}

export default defineProvider({
  name: 'electron-updater',
  register(app) {
    if (ipc.available) app.drivers.register('updater', electronUpdater(), { platform: 'desktop' })
  },
})
```

Create the provider with `kitr make:provider electron_updater` and add `() => import('#app/providers/electron_updater_provider')` to `providers` in `kitrrc.ts`. Inside the Electron app, the banner now shows the release version, the button shows download progress, and the app restarts on the new build. In the web build `ipc.available` is `false`, so the service-worker driver still applies.

A Tauri app does the same with [`@tauri-apps/plugin-updater`](https://v2.tauri.app/plugin/updater/): `check()` resolves to an update or `null`, and the update's `downloadAndInstall()` reports progress before you relaunch. The `UpdaterDriver` and `UpdateInfo` types are in the [API reference](/packages/updater/api).

## Next steps

- [API reference](/packages/updater/api)
- [Web](/packages/web): the `pwa` option that builds the service worker.
- [vite-plugin-pwa prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update): how the waiting worker is built.
- [electron-updater](https://www.electron.build/auto-update): publishing and signing desktop updates.
- [Desktop](/packages/desktop): the shell an installed-app driver plugs into.
- [Offline](/packages/offline): keep data across versions, dropped when `VITE_APP_VERSION` changes.
