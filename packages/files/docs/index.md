---
title: Files
description: Let people open, save and pick files on any platform, with a download fallback in older browsers.
order: 1
---

# Files

Sooner or later someone wants to get a file in or out of your app: import last month's orders from a spreadsheet, export invoices as CSV, attach a receipt. `@kitr/files` gives you one service with three calls, `open()`, `pick()` and `save()`, that shows the best dialog the current platform has. Components call the same API everywhere and never check which browser or shell they run in.

In Chrome and Edge it uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), so saving writes to the exact file the person chose. Everywhere else it falls back to a hidden `<input type="file">` to open and a download link to save. A platform or your own code can register a native driver that adds real file paths. Every picked file has the same shape, a `PickedFile`, with `text()`, `bytes()` and `blob()`.

It runs in the browser and in desktop and mobile shells. On the server the service exists but has no dialogs. To receive files on your server and store them, use [Uploads](/packages/uploads); `@kitr/files` only gets them into and out of the browser.

This guide follows Acme's billing screen at `app.acme.com`: Ada imports orders from a CSV, attaches receipts to an invoice, and exports invoices for Grace in accounting.

## When to use it

Use `@kitr/files` when **the person's own device** is the source or destination: they choose a file to open, or choose where a file you generated is saved. The content stays in the browser until your code sends it somewhere.

Use [Uploads](/packages/uploads) when the file must **reach your server or object storage**: progress bars, size limits, presigned URLs and virus scanning are its job. The two work together: pick with `@kitr/files`, then hand the `Blob` to an upload.

## Install

```sh
kitr add files
```

What `kitr add` does:

- Installs `@kitr/files` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/files/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/files.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: files` section to `AGENTS.md`: open, pick and save with `useFileDialogs()` from `@kitr/files/react` or `app.container.use('files')`, never build `<input type="file">` or download links by hand, and expect a cancelled dialog to resolve to `[]` or `null`.

`kitr add files` asks no questions and adds no environment variables or scripts. No kit includes it.

`kitr remove files` reverses every step above and deletes `config/files.ts`, then lists the files that still import `@kitr/files`.

## Configure

`kitr add files` writes this file:

```ts
// config/files.ts
import { defineConfig } from '@kitr/files'

export default defineConfig({
  // Filters added to every open/save dialog.
  filters: [],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `filters` | `[]` | File types added to every dialog, after the ones a call passes. Use it for your app's own document type. |
| `filters[].name` | | The label in the dialog's file-type menu, such as `Acme projects`. |
| `filters[].extensions` | | Extensions without the dot, such as `['acme']`. Case, leading dots and spaces are ignored; `'*'` and empty strings are dropped. |
| `driver` | the platform's driver, else the web driver | Replace the dialogs. Tests pass `createMemoryFilesDriver()` here. |

`@kitr/files` adds no environment variables.

The provider binds one `files` service in the container. It picks its driver the first time the service is used: `driver` from config if set, then a driver a platform registered under the `files` capability, then the web driver in a browser, and an in-memory driver on the server.

Acme's app has its own project export format, so every dialog offers it:

```ts
// config/files.ts
import { defineConfig } from '@kitr/files'

export default defineConfig({
  filters: [{ name: 'Acme projects', extensions: ['acme'] }],
})
```

## Save your first file

Export Acme's open orders as a CSV with one button. `useFileDialogs()` returns the service's calls plus a `busy` flag:

```tsx
// app/features/orders/export-orders-button.tsx
import { useFileDialogs } from '@kitr/files/react'

const orders = [
  { id: 'ord_1042', customer: 'Ada', total: 129 },
  { id: 'ord_1043', customer: 'Grace', total: 80 },
]

export function ExportOrdersButton() {
  const { save, busy } = useFileDialogs()

  async function exportOrders() {
    const csv = ['id,customer,total', ...orders.map((o) => `${o.id},${o.customer},${o.total}`)].join('\n')
    const where = await save(csv, { name: 'acme-orders.csv' })
    if (where) console.log(`Saved to ${where}`)
  }

  return (
    <button type="button" disabled={busy} onClick={exportOrders}>
      Export orders
    </button>
  )
}
```

Click **Export orders**. In Chrome or Edge a save dialog opens with `acme-orders.csv` filled in; choose a folder and the console prints `Saved to acme-orders.csv`, the name the person kept. In Firefox and Safari the browser downloads `acme-orders.csv` right away. The file holds:

```text
id,customer,total
ord_1042,Ada,129
ord_1043,Grace,80
```

`save()` resolves to the saved name, a path on platforms that have one, or `null` when the person cancels. Call it from a click handler: browsers only show file dialogs in response to a user gesture.

## Open a file and read it

`pick()` opens a dialog for exactly one file and resolves to a `PickedFile`, or `null` when the person cancels. Read its content with `text()`:

```tsx
// app/features/orders/import-orders-button.tsx
import { useFileDialogs } from '@kitr/files/react'
import { useState } from 'react'

interface ImportedOrder {
  id: string
  customer: string
  total: number
}

function parseOrders(csv: string): ImportedOrder[] {
  const [, ...rows] = csv.trim().split('\n')
  return rows.map((row) => {
    const [id = '', customer = '', total = '0'] = row.split(',')
    return { id, customer, total: Number(total) }
  })
}

export function ImportOrdersButton() {
  const { pick, busy } = useFileDialogs()
  const [imported, setImported] = useState<ImportedOrder[]>([])

  async function importOrders() {
    const file = await pick({ filters: [{ name: 'Spreadsheets', extensions: ['csv'] }] })
    if (!file) return
    setImported(parseOrders(await file.text()))
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={importOrders}>
        Import orders
      </button>
      <p>{imported.length} orders imported</p>
    </div>
  )
}
```

Choose the `acme-orders.csv` you exported and the paragraph reads `2 orders imported`. Nothing has left the browser; send the rows to your API with a [mutation](/packages/query) when the person confirms.

## Open several files

`open()` resolves to an array. Pass `multiple: true` to let the person select more than one file. Without it, `open()` still returns an array, with at most one entry:

```tsx
// app/features/invoices/attach-receipts.tsx
import type { PickedFile } from '@kitr/files'
import { useFileDialogs } from '@kitr/files/react'
import { useState } from 'react'

export function AttachReceipts({ invoiceId }: { invoiceId: string }) {
  const { open, busy } = useFileDialogs()
  const [receipts, setReceipts] = useState<PickedFile[]>([])

  async function attach() {
    const files = await open({
      multiple: true,
      title: `Receipts for ${invoiceId}`,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'PDF', extensions: ['pdf'] },
      ],
    })
    setReceipts((current) => [...current, ...files])
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={attach}>
        Attach receipts
      </button>
      <ul>
        {receipts.map((file) => (
          <li key={file.name}>
            {file.name} ({Math.round(file.size / 1024)} KB)
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Ada selects `taxi.jpg` and `hotel.pdf`; the list shows both with their sizes. A cancelled dialog resolves to `[]`, so the list stays as it was. `title` is shown by platform drivers that have a titled dialog; browsers ignore it.

## Filter by file type

`filters` decides which files the dialog offers. Each filter is a label and a list of extensions. The filters you pass come first, then the ones in `config/files.ts`:

```ts
// app/features/projects/open-project.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

// With `filters: [{ name: 'Acme projects', extensions: ['acme'] }]` in config,
// the dialog offers "JSON" first and "Acme projects" second.
export function openProject() {
  return useFiles(app).pick({ filters: [{ name: 'JSON', extensions: ['json'] }] })
}
```

Extensions are cleaned before they reach the dialog: `'.PNG'`, `'png'` and `' png '` are the same, duplicates are merged, and `'*'` or `''` is dropped. A filter left with no extensions is not shown in the File System Access picker. `acceptFor()` turns filters into the `accept` string a file input needs, which is what the fallback uses:

```ts
import { acceptFor } from '@kitr/files'

acceptFor([
  { name: 'Images', extensions: ['.PNG', 'jpg', '*'] },
  { name: 'PDF', extensions: ['pdf'] },
])
// => '.png,.jpg,.pdf'
```

Filters are a convenience, not a check. Most dialogs let the person switch to "All files", and the file input fallback lists every filter as one combined list. Check `file.name` or `file.type` before you trust the content:

```ts
// app/features/orders/check-file.ts
import type { PickedFile } from '@kitr/files'

export function assertCsv(file: PickedFile) {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error(`${file.name} is not a CSV file`)
}
```

## Read a file's content

A `PickedFile` holds the file's details and reads its content only when you ask:

| Member | Type | Description |
| --- | --- | --- |
| `name` | `string` | File name with extension, such as `taxi.jpg`. |
| `size` | `number` | Size in bytes. |
| `type` | `string` | The MIME type the platform reports, such as `image/jpeg`. Can be `''`. |
| `path` | `string \| undefined` | Absolute path, only on drivers that have one. Always `undefined` in a browser. |
| `text()` | `Promise<string>` | The content as UTF-8 text. |
| `bytes()` | `Promise<Uint8Array>` | The content as bytes. |
| `blob()` | `Promise<Blob>` | The content as a `Blob`. In a browser this is the original `File`. |

Use `text()` for CSV, JSON and Markdown, `bytes()` when you parse a binary format yourself, and `blob()` to preview or send a file:

```tsx
// app/features/invoices/receipt-preview.tsx
import type { PickedFile } from '@kitr/files'
import { useEffect, useState } from 'react'

export function ReceiptPreview({ file }: { file: PickedFile }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let objectUrl: string | undefined
    file.blob().then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  if (!url) return null
  return file.type === 'application/pdf' ? (
    <iframe src={url} title={file.name} />
  ) : (
    <img src={url} alt={file.name} />
  )
}
```

Reading a large file into memory is slow. Check `file.size` first and refuse anything your feature can't handle, before calling `text()` or `bytes()`.

To turn a browser `File` from somewhere else, such as a paste event, into the same shape, call `fromFile(file)`. The optional second argument sets `path`.

## Save text, bytes and blobs

`save(data, options)` accepts a string, a `Blob` or `File`, a `Uint8Array` or an `ArrayBuffer`. `name` is required and suggests the file name. In the download fallback, `type` sets the MIME type; without it the type comes from the extension:

```ts
// app/features/invoices/export.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

// Text: the type is text/csv, from the extension.
export function exportInvoiceCsv() {
  return useFiles(app).save('id,total\nINV-1042,129', { name: 'invoices-2024-11.csv' })
}

// JSON for the app's own format, with the type set explicitly.
export function exportProject() {
  const project = { id: 'prj_7', name: 'Website relaunch', team: 'Design' }
  return useFiles(app).save(JSON.stringify(project, null, 2), {
    name: 'website-relaunch.acme',
    type: 'application/json',
    filters: [{ name: 'Acme projects', extensions: ['acme'] }],
  })
}

// Bytes from an API that renders PDFs.
export async function downloadInvoicePdf() {
  const response = await fetch('https://api.acme.com/invoices/INV-1042.pdf')
  return useFiles(app).save(await response.blob(), { name: 'INV-1042.pdf' })
}
```

`mimeFor(name)` is the lookup `save()` uses. It knows `txt`, `md`, `csv`, `json`, `html`, `png`, `jpg`, `jpeg`, `gif`, `svg`, `pdf` and `zip`, and returns `application/octet-stream` (or the fallback you pass) for anything else:

```ts
import { mimeFor, toBlob } from '@kitr/files'

mimeFor('INV-1042.PDF') // => 'application/pdf'
mimeFor('website-relaunch.acme') // => 'application/octet-stream'
mimeFor('website-relaunch.acme', 'application/json') // => 'application/json'

toBlob('id,total', 'text/csv').type // => 'text/csv'
```

`toBlob(data, type)` is the other helper: it turns any `FileData` into a `Blob`, and returns a `Blob` you pass unchanged.

## Know when the person cancelled

Cancelling a dialog is not an error. `open()` resolves to `[]`, `pick()` to `null` and `save()` to `null`, so a cancel needs no `try`/`catch`:

```ts
// app/features/orders/import.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export async function importOrdersFile() {
  const file = await useFiles(app).pick({ filters: [{ name: 'Spreadsheets', extensions: ['csv'] }] })
  if (file === null) return null // Ada closed the dialog. Leave the screen as it was.
  return file.text()
}
```

With the download fallback, `save()` resolves to `name` as soon as the download starts, because the browser doesn't tell the page whether the person kept the file. Don't show "Saved" as a fact in that case; "Download started" is honest.

With the file input fallback, the dialog resolves `[]` on cancel only in browsers that fire the input's `cancel` event. In older browsers a cancelled dialog never resolves, and `busy` from `useFileDialogs()` stays `true` until the next dialog completes.

## Show a busy state while a dialog is open

`useFileDialogs()` wraps `open`, `pick` and `save` so `busy` is `true` from the moment a call starts until it settles, including the time the dialog is on screen and the time it takes to write the file:

```tsx
// app/features/invoices/export-invoices.tsx
import { useFileDialogs } from '@kitr/files/react'

export function ExportInvoices({ csv }: { csv: string }) {
  const { save, busy } = useFileDialogs()
  return (
    <button type="button" disabled={busy} onClick={() => save(csv, { name: 'acme-invoices.csv' })}>
      {busy ? 'Exporting…' : 'Export invoices'}
    </button>
  )
}
```

Disabling the button while `busy` stops a double click from opening two dialogs. If you don't need the flag, `useFiles()` from `@kitr/files/react` returns the service itself, including `reveal()` and `driver`.

## Accept dropped files

`useDropFiles(onFiles)` returns drag-and-drop handlers that hand dropped files to your callback as `PickedFile`s, plus an `over` flag for styling the drop zone:

```tsx
// app/features/invoices/receipt-drop-zone.tsx
import type { PickedFile } from '@kitr/files'
import { useDropFiles } from '@kitr/files/react'

export function ReceiptDropZone({ onReceipts }: { onReceipts: (files: PickedFile[]) => void }) {
  const { over, ...handlers } = useDropFiles(onReceipts)
  return (
    <div {...handlers} className={over ? 'border-2 border-blue-500' : 'border-2 border-dashed'}>
      Drop receipts here
    </div>
  )
}
```

Spread only the handlers (`onDragOver`, `onDragLeave` and `onDrop`) onto the element. Don't spread the whole return value: React would put `over` on the `<div>` as an unknown attribute and warn. `onDrop` prevents the browser from opening the file in the tab. Dropped files go through no filters, so check them the same way as picked ones.

## Use files outside React

Outside components, get the service from the app's container. `useFiles(app)` from `@kitr/files` is a shortcut for `app.container.use('files')`:

```ts
// app/features/projects/project-files.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export interface Project {
  id: string
  name: string
  team: string
}

export async function exportProject(project: Project) {
  const files = useFiles(app)
  return files.save(JSON.stringify(project, null, 2), { name: `${project.id}.acme` })
}

export async function importProject(): Promise<Project | null> {
  const file = await useFiles(app).pick()
  return file ? (JSON.parse(await file.text()) as Project) : null
}
```

`importProject()` offers the `Acme projects` filter from config, because config filters apply to every call. `files.driver.name` tells you which driver is active: `web`, `memory`, or the name a platform driver gives itself.

## Open a saved file in its app

`reveal(path)` asks the driver to open a file with the system's default app, such as opening the exported PDF in a viewer. Only drivers that know real paths can do it, so check that the driver has `reveal` first:

```ts
// app/features/invoices/open-invoice.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export async function saveAndOpenInvoice() {
  const files = useFiles(app)
  const pdf = await (await fetch('/api/invoices/INV-1042.pdf')).blob()
  const where = await files.save(pdf, { name: 'INV-1042.pdf' })
  if (where && files.driver.reveal) await files.reveal(where)
}
```

The web and memory drivers have no `reveal`; the call resolves and does nothing. `useFileDialogs()` doesn't return `reveal`; use `useFiles()` in components.

## Send a picked file to your server

A `PickedFile` gives you a `Blob`, which `fetch` and `FormData` accept directly. For a small file and your own endpoint, that's enough:

```ts
// app/features/invoices/upload-receipt.ts
import type { PickedFile } from '@kitr/files'

export async function uploadReceipt(invoiceId: string, file: PickedFile) {
  const body = new FormData()
  body.append('receipt', await file.blob(), file.name)
  const response = await fetch(`/api/invoices/${invoiceId}/receipts`, { method: 'POST', body })
  if (!response.ok) throw new Error(`Upload failed with ${response.status}`)
  return (await response.json()) as { id: string; url: string }
}
```

For progress, size limits, retries or direct uploads to object storage, pass the blob to [Uploads](/packages/uploads) instead.

## Where it runs

The service picks a driver once, the first time it is used. The table shows what each environment gets today:

| Where the app runs | Driver | Open | Save | `path` |
| --- | --- | --- | --- | --- |
| Chrome, Edge and other Chromium browsers | `web` | File System Access picker | Save picker, writes the chosen file | no |
| Firefox, Safari | `web` | Hidden `<input type="file">` | Download link | no |
| Desktop shell (Electron or Tauri) | `web`, unless you register one | The shell's webview decides | The shell's webview decides | no |
| Mobile shell (Capacitor) | `web`, unless you register one | The system picker behind `<input type="file">` | Download link | no |
| Server | `memory` | Resolves `[]` | Records the call, resolves `name` | no |

### Chrome and Edge

The web driver calls `showOpenFilePicker` and `showSaveFilePicker`. The save picker writes the bytes into the file the person chose and resolves to its name. See [MDN on `showSaveFilePicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker) for support and limits. The API needs a secure context: `https://` or `http://localhost`.

### Firefox and Safari

The web driver adds a hidden `<input type="file">` to the page, sets its `accept` from your filters, clicks it and removes it once the person chooses or cancels. To save, it creates an object URL, clicks a hidden `<a download>` and revokes the URL a second later. The browser decides where the download goes.

### Desktop

[Desktop](/packages/desktop) (Electron) and [Tauri](/packages/tauri) don't register a `files` driver today, so the web driver runs inside the shell's webview. Electron, the recommended shell, embeds Chromium, so the File System Access pickers show the OS dialogs, but picked files have no `path` and `reveal()` does nothing. Tauri uses the operating system's webview, so on macOS and Linux the file input and download fallbacks run instead. For real paths, write a driver over your IPC contract, as [Extend](#extend) shows for Electron.

### Mobile

[Mobile](/packages/mobile) doesn't register a `files` driver today either. Inside Capacitor, the file input opens the system picker. Downloads from a WebView depend on the shell, so test saving on a device, or register a driver that uses a Capacitor filesystem or share plugin.

## Errors

Cancelling is never an error. Anything else the dialog throws reaches your code as it was thrown:

| Error | When | What to do |
| --- | --- | --- |
| `AbortError` | The person cancelled the File System Access picker. | Nothing: `@kitr/files` catches it and resolves `[]` or `null`. |
| `SecurityError` | The picker was called without a user gesture, such as from a timer or after an `await` that took too long. | Call `open`, `pick` or `save` directly from a click or key handler. |
| `NotAllowedError` | The browser or the person denied write access to the chosen file. | Show a message and offer to save again. |
| `TypeError` | The picker rejected its options, such as a filter it can't read. | Check your `filters`. |

```ts
// app/features/invoices/export-safely.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export async function exportInvoices(csv: string) {
  try {
    return await useFiles(app).save(csv, { name: 'acme-invoices.csv' })
  } catch (error) {
    if (error instanceof Error && error.name === 'SecurityError') {
      throw new Error('Click Export again to choose where to save.')
    }
    throw error
  }
}
```

## Testing

Pass `createMemoryFilesDriver(queue)` as the `driver` in config. `open()` and `pick()` take files from the front of `queue` instead of showing a dialog, and `save()` records each call in `driver.saved` and resolves to `name`. An empty queue behaves like a cancelled dialog.

```ts
// app/features/orders/files.test.ts
import { createMemoryFilesDriver, fromFile, useFiles } from '@kitr/files'
import filesProvider from '@kitr/files/provider'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'

describe('order files', () => {
  it('imports a picked CSV and exports invoices', async () => {
    const csv = new File(['id,customer,total\nord_1042,Ada,129'], 'acme-orders.csv', {
      type: 'text/csv',
    })
    const driver = createMemoryFilesDriver([fromFile(csv)])
    const app = await createTestApp({
      providers: [filesProvider],
      config: { files: { driver, filters: [{ name: 'Acme projects', extensions: ['acme'] }] } },
    })
    const files = useFiles(app)

    const picked = await files.pick({ filters: [{ name: 'Spreadsheets', extensions: ['csv'] }] })
    expect(picked?.name).toBe('acme-orders.csv')
    expect(await picked?.text()).toContain('ord_1042,Ada,129')

    expect(await files.pick()).toBeNull()

    expect(await files.save('id,total\nINV-1042,129', { name: 'acme-invoices.csv' })).toBe(
      'acme-invoices.csv',
    )
    expect(driver.saved).toEqual([{ name: 'acme-invoices.csv', data: 'id,total\nINV-1042,129' }])
  })
})
```

`open({ multiple: true })` takes every queued file at once; without `multiple`, each call takes one. Push more files with `driver.queue.push(...)` between calls.

To test a component, render it inside the same app with `renderWithKitr` from `@kitr/testing/react` in a DOM environment, click the button, and read `driver.saved`:

```tsx
// app/features/orders/export-orders-button.test.tsx
// @vitest-environment happy-dom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryFilesDriver } from '@kitr/files'
import filesProvider from '@kitr/files/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { ExportOrdersButton } from './export-orders-button'

it('exports the orders as CSV', async () => {
  const driver = createMemoryFilesDriver()
  const app = await createTestApp({ providers: [filesProvider], config: { files: { driver } } })
  renderWithKitr(<ExportOrdersButton />, { app })

  fireEvent.click(screen.getByRole('button', { name: 'Export orders' }))

  await waitFor(() => expect(driver.saved).toHaveLength(1))
  expect(driver.saved[0]?.name).toBe('acme-orders.csv')
  expect(driver.saved[0]?.data).toBe('id,customer,total\nord_1042,Ada,129\nord_1043,Grace,80')
})
```

## Extend

A driver supplies the dialogs. Write one when a platform has better ones than the browser, for example to get real paths on desktop. The interface is `FilesDriver` in the [API reference](/packages/files/api):

| Member | Description |
| --- | --- |
| `name` | Shown in devtools and on `files.driver.name`. |
| `open(options)` | Show the open dialog with `filters`, `multiple` and `title`. Resolve to the picked files, or `[]` when cancelled. |
| `save(data, options)` | Write `data` where the person chooses, starting from `options.name`. Resolve to the path or name, or `null` when cancelled. |
| `reveal(path)` | Optional. Open a path with the system's default app. |

`options.filters` already includes the config filters when the service calls your driver.

### An Electron driver

This driver uses Electron's [`dialog`](https://www.electronjs.org/docs/latest/api/dialog) in the main process through [Desktop](/packages/desktop)'s typed IPC. First add three commands to the IPC contract:

```ts
// platforms/app/ipc.ts
import type { FileFilter } from '@kitr/files'

export type Ipc = {
  'app.version': () => string
  'files.open': (options: { filters?: FileFilter[]; multiple?: boolean; title?: string }) => Array<{
    path: string
    bytes: Uint8Array
  }>
  'files.save': (data: string | Uint8Array, options: { name: string; filters?: FileFilter[]; title?: string }) => string | null
  'files.reveal': (path: string) => void
}
```

Then implement them in the main process:

```ts
// platforms/app/main.ts
import { readFile, writeFile } from 'node:fs/promises'
import { app, dialog, ipcMain, shell } from 'electron'
import { handleIpc, handleKitrIpc } from '@kitr/desktop/main'
import type { Ipc } from './ipc'

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'files.open': async (_event, options) => {
    const result = await dialog.showOpenDialog({
      title: options.title,
      filters: options.filters,
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(async (path) => ({ path, bytes: await readFile(path) })))
  },
  'files.save': async (_event, data, options) => {
    const result = await dialog.showSaveDialog({
      title: options.title,
      defaultPath: options.name,
      filters: options.filters,
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, data)
    return result.filePath
  },
  'files.reveal': async (_event, path) => {
    await shell.openPath(path)
  },
})

app.whenReady().then(() => {
  handleKitrIpc(ipcMain, app)
  // ... create the window
})
```

In the renderer, turn the IPC calls into a `FilesDriver` and register it under the `files` capability from a provider:

```ts
// app/providers/electron-files.ts
import { defineProvider } from 'kitr/app'
import { createIpcClient } from '@kitr/desktop/client'
import { type FileData, type FilesDriver, mimeFor, type PickedFile, toBlob } from '@kitr/files'
import type { Ipc } from '../../platforms/app/ipc'

const ipc = createIpcClient<Ipc>()

function picked(path: string, bytes: Uint8Array): PickedFile {
  const name = path.split(/[\\/]/).pop() ?? path
  const type = mimeFor(name, '')
  return {
    name,
    path,
    size: bytes.byteLength,
    type,
    text: async () => new TextDecoder().decode(bytes),
    bytes: async () => bytes,
    blob: async () => toBlob(bytes, type),
  }
}

async function toSendable(data: FileData): Promise<string | Uint8Array> {
  if (typeof data === 'string' || data instanceof Uint8Array) return data
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer())
  return new Uint8Array(data)
}

export const electronFilesDriver: FilesDriver = {
  name: 'electron',
  async open(options) {
    const files = await ipc.invoke('files.open', options)
    return files.map((f) => picked(f.path, f.bytes))
  },
  async save(data, options) {
    return ipc.invoke('files.save', await toSendable(data), options)
  },
  reveal: (path) => ipc.invoke('files.reveal', path),
}

export default defineProvider({
  name: 'electron-files',
  register(app) {
    if (ipc.available) app.drivers.register('files', electronFilesDriver, { platform: 'desktop' })
  },
})
```

Add `() => import('#app/providers/electron-files')` to `providers` in `kitrrc.ts`. The files service resolves its driver on first use, after every provider has registered, so the order in the list doesn't matter. In a plain browser `ipc.available` is `false`, nothing is registered, and the web driver runs as before. Picked files now have a `path`, and `reveal(path)` opens them in the default app.

The same shape works for any shell: [Tauri's dialog plugin](https://v2.tauri.app/plugin/dialog/) with its fs plugin, or a Capacitor file picker plugin on mobile.

## Devtools

`@kitr/files` has no panel. With [Devtools](/packages/devtools) installed, the service writes to the Log panel under `files`: `open` with the names of the chosen files, and `save` with the name or path it saved to (`null` on cancel). `pick()` doesn't log.

## Next steps

- [API reference](/packages/files/api)
- [Uploads](/packages/uploads): send picked files to your server or object storage.
- [Platform](/packages/platform): where the app runs, and the drivers platforms register.
- [Desktop](/packages/desktop): the Electron shell and its typed IPC. [Tauri](/packages/tauri) is the alternative shell.
- [MDN: File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
