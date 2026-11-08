---
title: Build a desktop app
description: Turn your React app into a Windows, macOS and Linux app with Electron, a list beside the detail, a real app menu, native save dialogs over typed IPC, and signed installers.
packages: desktop, platform, router, query, storage
platforms: desktop, web
time: 40 min
---

# Build a desktop app

The people in Acme's back office keep the billing app open all day next to their spreadsheets. In a browser tab it gets lost among forty others, Cmd+N opens a new browser window instead of a new invoice, and exporting means a download that lands somewhere in the Downloads folder. You will build Acme Billing for the desktop: a window with the invoice list beside the selected invoice, a File menu with a New Invoice shortcut, a CSV export that asks where to save through the operating system's own dialog, settings that persist in the app's data folder, and installers for each operating system.

kitr runs the same `app/` folder in an [Electron](https://www.electronjs.org) window. Electron ships its own Chromium, so the page your team tests is the page every user runs. Native work happens in Electron's main process, a Node.js program you write in `platforms/app/main.ts`, and the window calls it through IPC commands that are typed from one file.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer and pnpm. Electron downloads its own runtime on install, so there is no other toolchain to set up. You need the invoices API from [Build an API server without React](/guides/api-server) running on port 3001, with the `/api/sign-in` and `/api/me` routes from [Build a phone app](/guides/mobile-app).

Create the project:

```sh
kitr new acme-desk --kit desktop
cd acme-desk
```

## Look at what the kit made

The `desktop` kit is the `app` kit with a second platform:

```ts
// kitrrc.ts
platforms: {
  site: web({ mode: 'spa' }),
  app: desktop(),
},
```

`site` is the app in a browser and `app` is the Electron window. Both build the same `app/` folder. The kit wrote the Electron side into `platforms/app/`:

| File | Runs in | What it is |
| --- | --- | --- |
| `ipc.ts` | everywhere | The IPC contract: the commands the window can call and the events main can push. |
| `main.ts` | the main process | Opens the window, implements the commands, owns the menu. |
| `preload.ts` | the bridge | Exposes only the declared channels to the page. |
| `electron.vite.config.ts` | the build | Builds main and preload into `dist/app/electron`. |
| `electron-builder.yml` | the build | Installers: NSIS on Windows, DMG on macOS, AppImage on Linux. |

`app/ipc.ts` is the typed client the page uses. The page itself never imports `electron`: the window runs sandboxed with context isolation, and everything it needs from the operating system goes through a command.

Set the window and the bundle id, and remove the About link from the kit's navigation in `app/document.tsx`, since the guide replaces the pages:

```sh
cd acme-desk
kitr config app title "Acme Billing"
kitr config app appId com.acme.billing
kitr config app minWidth 900
```

## Bring the data layer

The desktop app reads the same API as the phone app, with the same token sign-in. Copy these four files from [Build a phone app](/guides/mobile-app) unchanged: `app/storage.ts`, `config/auth.ts`, `config/http.ts` and `app/queries/invoices.ts`, plus the sign-in page. None of them mention a platform. On the desktop, kitr stores the token and the filter in a JSON file in the app's data folder instead of in Chromium's `localStorage`, so they survive a cleared cache and an app update.

Set the API address in `.env`:

```sh
# .env
VITE_API_URL=http://localhost:3001/api
```

In development the window loads from `http://localhost:3200`, the desktop platform's dev server. A built app serves its pages from `app://-`, so add both origins to the API's `cors()` list.

## Show the list beside the invoice

A desktop window is wide enough for the list and the selected invoice side by side. `<SplitStack>` shows the list pane when the window is at least `minWidth` pixels wide, and only the stack below that, so a narrow window pushes the invoice over the list as a phone does:

```ts
// app/routes.ts
import { defineRoutes } from 'kitr/app'
import { requireAuth } from '@kitr/router'
import router from '@kitr/router/routes'
import { invoiceQuery, invoicesQuery } from '#app/queries/invoices'
import { head, RootDocument } from './document'

export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/sign-in', {
      validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
      }),
      lazy: () => import('./pages/sign-in'),
    })
    .layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./layouts/app') }, (app) =>
      app.layout(
        '_invoices',
        {
          loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery.options()),
          lazy: () => import('./pages/invoices-layout'),
        },
        (invoices) =>
          invoices
            .page('/', { lazy: () => import('./pages/invoices') })
            .page('/invoices/new', { presentation: 'sheet', lazy: () => import('./pages/new-invoice') })
            .page('/invoices/$id', {
              stackParent: '/',
              loader: ({ context, params }) => context.queryClient.ensureQueryData(invoiceQuery.options(params.id)),
              lazy: () => import('./pages/invoice'),
            }),
      ),
    ),
)

export type AppRoutes = typeof routes.$types
```

```tsx
// app/pages/invoices-layout.tsx
import { SplitStack, StackOutlet } from '@kitr/router/stack'
import { InvoiceList } from '#app/components/invoice-list'

export default function InvoicesLayout() {
  return (
    <SplitStack master={<InvoiceList />} minWidth={768}>
      <StackOutlet />
    </SplitStack>
  )
}
```

The `/` page is the list on a narrow window and a placeholder on a wide one, because the list already shows on the left:

```tsx
// app/pages/invoices.tsx
import { useSplitPane } from '@kitr/router/stack'
import { InvoiceList } from '#app/components/invoice-list'

export default function InvoicesIndex() {
  const { split } = useSplitPane()
  return split ? <p className="p-8 text-muted-foreground">Pick an invoice</p> : <InvoiceList />
}
```

`InvoiceList` is the list from the phone guide with a filter `<select>` and an Export button in its header, and an `activeProps` class on each link so the selected invoice is highlighted. The invoice page is the phone app's detail page without the back button: on the desktop the list is always beside it. `presentation: 'sheet'` makes the new-invoice form rise over the dimmed window, and a click on the scrim closes it.

## Declare the export command

Every call from the window to the main process is declared once, as a type, in `platforms/app/ipc.ts`. Main, preload and the page all import this file, so a typo in a channel name or a wrong argument is a compile error:

```ts
// platforms/app/ipc.ts
export type Ipc = {
  'app.version': () => string
  'invoices.exportCsv': (csv: string, suggestedName: string) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
  'menu.newInvoice': () => void
}

/** Every channel above, at run time: preload lets only these (and kitr:*) through. */
export const channels = {
  'app.version': true,
  'invoices.exportCsv': true,
  'app.focus': true,
  'menu.newInvoice': true,
} satisfies Record<keyof Ipc | keyof IpcPush, true>
```

`channels` is the same list at run time. The preload script forwards only these names to the page, and the `satisfies` makes a channel missing from it a type error. The kit's `dialog.openFile` example command is gone; delete its handler in `main.ts` too.

## Implement it in the main process

`handleIpc<Ipc>()` makes TypeScript require one handler per command, with the declared arguments and return type. The export handler shows the operating system's save dialog and writes the file:

```ts
// platforms/app/main.ts
import { writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, Menu, protocol } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc, handleKitrIpc, registerAppScheme } from '@kitr/desktop/main'
import type { Ipc, IpcPush } from './ipc'

const window = { title: 'Acme Billing', width: 1280, height: 820, minWidth: 900, minHeight: 600 }

registerAppScheme(protocol)

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'invoices.exportCsv': async (_event, csv, suggestedName) => {
    if (csv.length > 5_000_000) throw new Error('Export is too large')
    const result = await dialog.showSaveDialog({
      title: 'Export invoices',
      defaultPath: suggestedName.replace(/[^\w.-]/g, '_'),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, csv, 'utf8')
    return result.filePath
  },
})
```

The main process can write anywhere the user can, so treat the arguments as you would a request body on a server: the handler caps the size and strips path separators from the suggested name, and the user picks the folder. A handler that throws rejects the promise in the page with the error's message.

## Add the menu and its shortcut

The app menu belongs to the main process. A menu item can't navigate the page itself, so it pushes an event and the page reacts. Add the menu to `main.ts`, below the handlers:

```ts
// platforms/app/main.ts
Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Invoice', accelerator: 'CmdOrCtrl+N', click: () => push.emit('menu.newInvoice') },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]),
)
```

In the page, `ipc.on()` subscribes and returns the unsubscribe function, which fits `useEffect`. Mount this once in the `_app` layout, around its `<Outlet />`:

```tsx
// app/components/menu-commands.tsx
import { useNavigate } from '@kitr/router'
import { useEffect } from 'react'
import { ipc } from '#app/ipc'

/** File > New Invoice (Cmd+N / Ctrl+N) in the app menu opens the new-invoice sheet. */
export function MenuCommands() {
  const navigate = useNavigate()
  useEffect(() => ipc.on('menu.newInvoice', () => void navigate({ to: '/invoices/new' })), [navigate])
  return null
}
```

`createIpcEmitter()` finds the current window when it sends, so the push does nothing when no window is open. In the browser build, `ipc.on()` returns a no-op, so the same component is harmless there.

## Call the command from the page

`ipc.invoke()` sends the call and resolves with what the handler returned. `ipc.available` is `false` in a browser, where there is no main process, so the button falls back to a plain download and the web build keeps working:

```tsx
// app/components/export-button.tsx
import { useState } from 'react'
import { invoicesToCsv } from '#app/lib/invoices/csv'
import type { Invoice } from '#app/queries/invoices'
import { ipc } from '#app/ipc'

export function ExportButton({ invoices }: { invoices: Invoice[] }) {
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const csv = invoicesToCsv(invoices)
  const name = `invoices-${new Date().toISOString().slice(0, 10)}.csv`

  if (!ipc.available)
    return (
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={name}>
        Export
      </a>
    )
  return (
    <button type="button" title={savedTo ?? undefined} onClick={async () => setSavedTo(await ipc.invoke('invoices.exportCsv', csv, name))}>
      Export
    </button>
  )
}
```

`invoicesToCsv()` is a plain function in `app/lib/invoices/csv.ts` that quotes every cell and doubles any quote inside it, so a customer name with a comma does not break the columns. Keeping it out of `main.ts` lets a unit test cover it without Electron.

## Use the platform service

For things every native shell can do, use [Platform](/packages/platform) instead of an IPC command of your own. The desktop provider answers it through kitr's own channels, which `handleKitrIpc()` in `main.ts` serves:

```tsx
// app/pages/invoice.tsx
import { usePlatform } from '@kitr/platform/react'
// ...
const platform = usePlatform()

<button type="button" onClick={() => void platform.openExternal(`https://pay.acme.com/i/${invoice.id}`)}>
  Open payment page
</button>
```

In Electron the payment page opens in the user's default browser, not inside the app's window. `platform.appVersion()` reads the `version` from `package.json`, and `platform.exit()` quits. The same calls work in a browser tab, in a Tauri window and on a phone.

## Run the window

```sh
kitr dev app
```

kitr starts Vite on port 3200, waits for it, then starts Electron with the window pointed at it. Edits reload in place, and devtools open next to the window. `kitr dev site` runs the same app in a browser on port 3000, where the Export button downloads and the File menu is the browser's.

To run the production build without installing it, build without packaging and start it. The window then loads the built client over `app://` with no dev server:

```sh
kitr build app --no-pack
kitr start app
```

## Test it

kitr's IPC pieces take Electron's objects as arguments, so a test passes small fakes and runs main, the bridge and the page in one process:

```ts
// test/desktop.test.ts
import { createIpcClient, IPC_BRIDGE_KEY } from '@kitr/desktop/client'
import { handleIpc } from '@kitr/desktop/main'
import { exposeIpc } from '@kitr/desktop/preload'
import { afterEach, describe, expect, it } from 'vitest'
import { invoicesToCsv } from '#app/lib/invoices/csv'
import type { Ipc, IpcPush } from '../platforms/app/ipc'

type Handler = (event: unknown, ...args: any[]) => unknown

/** ipcMain, ipcRenderer and contextBridge in one process: invoke calls the handler directly. */
function fakeElectron() {
  const handlers = new Map<string, Handler>()
  return {
    ipcMain: { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn), removeHandler: () => {} },
    ipcRenderer: {
      invoke: async (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args),
      on: () => {},
      removeListener: () => {},
      send: () => {},
    },
    contextBridge: { exposeInMainWorld: (key: string, value: unknown) => void ((globalThis as any)[key] = value) },
  }
}

afterEach(() => {
  delete (globalThis as any)[IPC_BRIDGE_KEY]
})

const invoices = [
  { id: 'inv_2041', customerEmail: 'grace@acme.com', amountCents: 12000, status: 'open' as const },
  { id: 'inv_2042', customerEmail: 'linus "the" t@acme.com', amountCents: 999, status: 'paid' as const },
]

describe('Acme Billing on the desktop', () => {
  it('writes a CSV that spreadsheets read', () => {
    expect(invoicesToCsv(invoices).split('\n')).toEqual([
      '"id","customer","amount","status"',
      '"inv_2041","grace@acme.com","120.00","open"',
      '"inv_2042","linus ""the"" t@acme.com","9.99","paid"',
    ])
  })

  it('exports through the main process', async () => {
    const electron = fakeElectron()
    handleIpc<Ipc>(electron.ipcMain as any, {
      'app.version': () => '1.0.0',
      'invoices.exportCsv': (_event, _csv, name) => `/Users/ada/Documents/${name}`,
    })
    exposeIpc(electron.contextBridge as any, electron.ipcRenderer as any)

    const ipc = createIpcClient<Ipc, IpcPush>()
    expect(await ipc.invoke('invoices.exportCsv', invoicesToCsv(invoices), 'invoices.csv')).toBe(
      '/Users/ada/Documents/invoices.csv',
    )
  })

  it('has no bridge in a browser', () => {
    expect(createIpcClient<Ipc>().available).toBe(false)
  })
})
```

Check the real dialog and menu by hand with `kitr dev app`, and the packaged app with `kitr build app --dir`, which makes an unpacked app you can open without installing.

## Build the installers

`kitr build app` builds the client, builds main and preload, then runs electron-builder:

```sh
VITE_API_URL=https://api.acme.com/api kitr build app
# ✔ app: installers are in dist/app/release
```

It packages for the operating system it runs on: `Acme Billing Setup 1.0.0.exe` on Windows, a `.dmg` on macOS and an `AppImage` on Linux, versioned from `package.json`. Pick other targets in `platforms/app/electron-builder.yml`, and build each operating system on its own CI runner, since a macOS app needs a Mac to build.

Unsigned apps trigger Gatekeeper on macOS and SmartScreen on Windows. electron-builder signs during packaging when `CSC_LINK` and `CSC_KEY_PASSWORD` are set; keep both in your CI's secrets and set them only on the release job. [Desktop](/packages/desktop) covers notarization and the full set of packaging options.

## Choose Tauri instead

When download size matters more than identical rendering, the [Tauri](/packages/tauri) platform wraps the same client build in the operating system's own web view, for an installer of a few megabytes instead of around a hundred. Both platforms register the same `platform` and `storage` drivers, so the pages, the queries and the storage items do not change. What changes is the native side: IPC commands in `main.ts` become Rust commands in `platforms/app/src-tauri/src/lib.rs`, called with `commands.<name>()` from `@kitr/tauri/client`, and you need the Rust toolchain to build.

```sh
kitr platforms remove app
kitr add tauri app
```

## Next steps

- [Desktop](/packages/desktop): every IPC helper, window option and packaging setting.
- [Tauri](/packages/tauri): the smaller shell, with typed Rust commands.
- [Build a phone app](/guides/mobile-app): the same invoices on iPhone and Android.
- [Ship one app to the web, phones and desktops](/guides/one-codebase): one project for every platform.
- [Electron documentation](https://www.electronjs.org/docs/latest)
