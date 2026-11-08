---
title: Files
description: Let people open, save and pick files on any platform, with a download fallback in older browsers.
order: 1
---

# Files

Sooner or later someone wants to get a file in or out of your app: import orders from a spreadsheet, export invoices as CSV, attach a receipt. `@kitr/files` gives you one service with three calls, `open()`, `pick()` and `save()`, that shows the best dialog the current platform has.

> [!SUMMARY]
> Open, pick and save files on the person's own device with one API on every platform. Add it with `kitr add files`; the overview is at [/packages/files](/packages/files).

Chrome and Edge use the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API); other browsers fall back to a hidden file input and a download link. Every picked file is a `PickedFile` with `text()`, `bytes()` and `blob()`.

The guide follows Acme's billing screen at `app.acme.com`: Ada imports orders from a CSV, attaches receipts to an invoice, and exports invoices for Grace in accounting.

## When to use it

Use `@kitr/files` when **the person's own device** is the source or destination. The content stays in the browser until your code sends it somewhere.

Use [Uploads](/packages/uploads) when the file must **reach your server or object storage**: progress, size limits, presigned URLs and scanning are its job. Pick with `@kitr/files`, then hand the `Blob` to an upload.

## Install

```sh
kitr add files
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/files` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/files/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/files.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: files` section to `AGENTS.md`: open, pick and save with `useFileDialogs()` from `@kitr/files/react` or `app.container.use('files')`, never build `<input type="file">` or download links by hand, and expect a cancelled dialog to resolve to `[]` or `null`.

`kitr add files` asks no questions and adds no environment variables or scripts. No kit includes it.

`kitr remove files` reverses every step above and deletes `config/files.ts`, then lists the files that still import `@kitr/files`.

</details>

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
| `driver` | the platform's driver, else the driver for the runtime | Replace the dialogs. Tests pass `createMemoryFilesDriver()` here. |
| `fallbackToWeb` | `false` | In Electron, Tauri or Capacitor with no files driver, use the web driver inside the webview instead of throwing `E_DRIVER_UNAVAILABLE`. |

The service picks its driver on first use: `driver` from config, then one a platform registered, then the web driver in a browser or an in-memory driver on the server. See [Where it runs](#where-it-runs).

Acme has its own project format, so every dialog offers it:

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
// app/components/orders/export-orders-button.tsx
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

In Chrome or Edge, **Export orders** opens a save dialog with `acme-orders.csv` filled in. In Firefox and Safari the browser downloads it right away. The file holds:

```text
id,customer,total
ord_1042,Ada,129
ord_1043,Grace,80
```

`save()` resolves to the saved name, a path on platforms that have one, or `null` on cancel.

> [!WARNING] Needs a user gesture
> Call `open`, `pick` and `save` from a click or key handler. Browsers show file dialogs only in response to one.

## Open a file and read it

`pick()` opens a dialog for exactly one file and resolves to a `PickedFile`, or `null` when the person cancels. Read its content with `text()`:

```tsx
// app/components/orders/import-orders-button.tsx
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

Choose the exported file and the paragraph reads `2 orders imported`. Nothing has left the browser; send the rows to your API with a [mutation](/packages/query) when the person confirms.

## Open several files

`open()` resolves to an array. Pass `multiple: true` to allow more than one file:

```tsx
// app/components/invoices/attach-receipts.tsx
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

A cancelled dialog resolves to `[]`, so the list stays as it was. Browsers ignore `title`; platform dialogs show it.

## Filter by file type

Each filter is a label and a list of extensions. Yours come first, then those in `config/files.ts`:

```ts
// app/lib/projects/open-project.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

// With `filters: [{ name: 'Acme projects', extensions: ['acme'] }]` in config,
// the dialog offers "JSON" first and "Acme projects" second.
export function openProject() {
  return useFiles(app).pick({ filters: [{ name: 'JSON', extensions: ['json'] }] })
}
```

Extensions are cleaned first: `'.PNG'`, `'png'` and `' png '` are the same, and `'*'` or `''` is dropped. `acceptFor()` turns filters into the `accept` string the fallback uses:

```ts
import { acceptFor } from '@kitr/files'

acceptFor([
  { name: 'Images', extensions: ['.PNG', 'jpg', '*'] },
  { name: 'PDF', extensions: ['pdf'] },
])
// => '.png,.jpg,.pdf'
```

> [!WARNING] Filters are not a check
> Most dialogs let the person switch to "All files". Check `file.name` or `file.type` before you trust the content.


```ts
// app/lib/orders/check-file.ts
import type { PickedFile } from '@kitr/files'

export function assertCsv(file: PickedFile) {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error(`${file.name} is not a CSV file`)
}
```

## Read a file's content

A `PickedFile` reads its content only when you ask:

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
// app/components/invoices/receipt-preview.tsx
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

> [!WARNING] Large files
> Reading a large file into memory is slow. Check `file.size` before calling `text()` or `bytes()`.

To turn a browser `File` from elsewhere, such as a paste event, into a `PickedFile`, call `fromFile(file)`.

## Save text, bytes and blobs

`save(data, options)` accepts a string, `Blob`, `File`, `Uint8Array` or `ArrayBuffer`. `name` is required. In the download fallback, `type` sets the MIME type; otherwise it comes from the extension:

```ts
// app/lib/invoices/export.ts
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

`mimeFor(name)` is the lookup `save()` uses. It knows common extensions (`txt`, `csv`, `json`, `png`, `pdf`, `zip` and a few more) and returns `application/octet-stream`, or the fallback you pass, for the rest:

```ts
import { mimeFor, toBlob } from '@kitr/files'

mimeFor('INV-1042.PDF') // => 'application/pdf'
mimeFor('website-relaunch.acme') // => 'application/octet-stream'
mimeFor('website-relaunch.acme', 'application/json') // => 'application/json'

toBlob('id,total', 'text/csv').type // => 'text/csv'
```

`toBlob(data, type)` turns any `FileData` into a `Blob`.

## Know when the person cancelled

Cancelling is not an error. `open()` resolves to `[]`, and `pick()` and `save()` to `null`, so a cancel needs no `try`/`catch`:

```ts
// app/lib/orders/import.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export async function importOrdersFile() {
  const file = await useFiles(app).pick({ filters: [{ name: 'Spreadsheets', extensions: ['csv'] }] })
  if (file === null) return null // Ada closed the dialog. Leave the screen as it was.
  return file.text()
}
```

<details>
<summary>Cancel behaviour in the browser fallbacks</summary>

With the download fallback, `save()` resolves to `name` as soon as the download starts, because the browser doesn't say whether the person kept the file. Show "Download started", not "Saved".

With the file input fallback, a cancel resolves `[]` only in browsers that fire the input's `cancel` event. In older browsers the dialog never resolves, and `busy` stays `true` until the next dialog completes.

</details>

## Show a busy state while a dialog is open

`useFileDialogs()` sets `busy` from the moment a call starts until it settles, including the time the dialog is on screen:

```tsx
// app/components/invoices/export-invoices.tsx
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

Disabling the button stops a double click from opening two dialogs. `useFiles()` from `@kitr/files/react` returns the service itself, including `reveal()` and `driver`.

## Accept dropped files

`useDropFiles(onFiles)` returns drag-and-drop handlers plus an `over` flag for styling the drop zone:

```tsx
// app/components/invoices/receipt-drop-zone.tsx
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

> [!WARNING] Spread only the handlers
> Spread `onDragOver`, `onDragLeave` and `onDrop`, not `over`, which React would warn about as an unknown attribute. Dropped files go through no filters, so check them like picked ones.

## Use files outside React

Outside components, `useFiles(app)` from `@kitr/files` is a shortcut for `app.container.use('files')`:

```ts
// app/lib/projects/project-files.ts
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

`files.driver.name` tells you which driver is active: `web`, `memory`, or a platform driver's name.

## Open a saved file in its app

`reveal(path)` opens a file with the system's default app. Only drivers that know real paths have it, so check first:

```ts
// app/lib/invoices/open-invoice.ts
import { useFiles } from '@kitr/files'
import { app } from '#app/app'

export async function saveAndOpenInvoice() {
  const files = useFiles(app)
  const pdf = await (await fetch('/api/invoices/INV-1042.pdf')).blob()
  const where = await files.save(pdf, { name: 'INV-1042.pdf' })
  if (where && files.driver.reveal) await files.reveal(where)
}
```

Without `reveal` the call does nothing. In components, use `useFiles()`; `useFileDialogs()` doesn't return `reveal`.

## Send a picked file to your server

For a small file and your own endpoint, a `PickedFile`'s `Blob` goes straight into `FormData`:

```ts
// app/lib/invoices/upload-receipt.ts
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

The service picks a driver once, on first use:

| Where the app runs | Driver | Open | Save | `path` |
| --- | --- | --- | --- | --- |
| Chrome, Edge and other Chromium browsers | `web` | File System Access picker | Save picker, writes the chosen file | no |
| Firefox, Safari | `web` | Hidden `<input type="file">` | Download link | no |
| Desktop shell (Electron or Tauri) | The one you register, else `E_DRIVER_UNAVAILABLE`; `web` with `fallbackToWeb` | The shell's webview decides | The shell's webview decides | no |
| Mobile shell (Capacitor) | `capacitor` | The system document picker | Cache file, then the share sheet | yes |
| Electron | `electron`: `dialog` in the main process, `fs/promises` | Native open dialog | Native save dialog | yes |
| Tauri | `tauri`: `plugin-dialog` and `plugin-fs` | Native open dialog | Native save dialog | yes |
| Mobile shell (Capacitor) | The one you register, else `E_DRIVER_UNAVAILABLE`; `web` with `fallbackToWeb` | The system picker behind `<input type="file">` | Download link | no |
| Server | `memory` | Resolves `[]` | Records the call, resolves `name` | no |

### Chrome and Edge

The web driver calls `showOpenFilePicker` and `showSaveFilePicker`, which write into the file the person chose. The API needs a secure context: `https://` or `http://localhost`. See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker) for support.

### Firefox and Safari

The web driver clicks a hidden `<input type="file">` with `accept` set from your filters. To save, it clicks a hidden `<a download>`; the browser decides where the file goes.

### Desktop

[Desktop](/packages/desktop) (Electron) and [Tauri](/packages/tauri) show the operating system's dialogs and give every picked file its `path`; see [Use it in Electron and Tauri](#use-it-in-electron-and-tauri). Set `fallbackToWeb: true` only to use the webview's pickers instead.

### Mobile

In the [Mobile](/packages/mobile) shell the service uses three optional peer dependencies, which `kitr add files` installs when the project has the mobile platform.

| Plugin | Used for |
| --- | --- |
| `@capawesome/capacitor-file-picker` | `open()` and `pick()`: the system document picker. The filters become MIME types; an extension kitr cannot map to a MIME type offers every file. |
| `@capacitor/filesystem` | `save()` writes the file; picked files read their content from their `path`. |
| `@capacitor/share` | `save()` opens the share sheet; `reveal(path)` hands a path to it. |

Mobile has no "save as" dialog. `save()` writes to the app's cache and opens the share sheet, where Ada chooses Save to Files, Drive or Mail. It resolves to the cached `file://` URI, or `null` if she dismisses the sheet.

> [!WARNING] The cache is temporary
> The OS can clear it, so use the URI for sharing now. To keep a file, use the file store below.

```tsx
// app/components/export-invoices.tsx
import { useFileDialogs } from '@kitr/files/react'

export function ExportInvoices({ csv }: { csv: string }) {
  const files = useFileDialogs()
  return (
    <button type="button" onClick={async () => console.log(await files.save(csv, { name: 'invoices.csv' }))}>
      Export invoices
    </button>
  )
}
// => file:///data/user/0/com.acme.app/cache/invoices.csv   (null if dismissed)
```

`capacitorFileStore()` reads, writes, deletes and lists files in the app's own directories with no dialog: `data` (default, private and backed up), `documents`, `cache`, `library` or `external`.

```ts
// app/drafts.ts
import { capacitorFileStore } from '@kitr/files'

const drafts = capacitorFileStore({ directory: 'data' })

await drafts.write('drafts/invoice-1042.json', JSON.stringify({ total: 120 }))
// => 'file:///data/user/0/com.acme.app/files/drafts/invoice-1042.json'
await drafts.list('drafts') // => [{ name: 'invoice-1042.json', type: 'file', size: 13, modifiedAt: 1767000000000, uri: '...' }]
await drafts.readText('drafts/invoice-1042.json') // => '{"total":120}'
await drafts.exists('drafts/invoice-1042.json') // => true
await drafts.remove('drafts/invoice-1042.json')
```

A plugin that is not installed rejects with `E_DRIVER_UNAVAILABLE` and the package to install, never a silent fallback.

## Use it in Electron and Tauri

In a desktop shell the service shows the operating system's dialogs and every `PickedFile` has its `path`. `config/files.ts` does not change. The window reaches only paths the person chose.

### Electron

`open()` and `save()` use Electron's [file dialogs](https://www.electronjs.org/docs/latest/api/dialog), and the window can only read and write paths a dialog returned in this session. To pick a folder, import the driver:

```ts
// app/invoices/folder.ts
import { createElectronFilesDriver } from '@kitr/files'

/** Let Grace pick the folder the month's invoices live in, then read each file. */
export async function readInvoiceFolder() {
  const folder = await createElectronFilesDriver().openDirectory({ title: 'Invoices' })
  if (!folder) return [] // cancelled
  return Promise.all((await folder.list()).map((file) => file.text()))
}
```

Requirements:

- `handleKitrIpc()` in `main.ts` and `exposeIpc()` in the preload script. Without the `kitrIpc` bridge, creating the service throws `E_DRIVER_UNAVAILABLE`.
- Files cross the process boundary as one `Uint8Array`, not a stream.

### Tauri

Dialogs use [`@tauri-apps/plugin-dialog`](https://v2.tauri.app/plugin/dialog/), content uses [`@tauri-apps/plugin-fs`](https://v2.tauri.app/plugin/file-system/), and `reveal(path)` uses [`@tauri-apps/plugin-opener`](https://v2.tauri.app/plugin/opener/).

Requirements:

- The three plugins in `package.json`; `kitr add tauri` and `kitr add files` install them. A missing one rejects with `E_DRIVER_UNAVAILABLE` naming the package.
- The matching crates in `src-tauri/Cargo.toml`, their `.plugin(...)` calls in `lib.rs`, and the permissions `dialog:default`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-stat`, `fs:allow-read-dir` and `opener:allow-open-path` in `capabilities/default.json`. The Tauri scaffold writes all of them.

## Errors

Anything other than a cancel reaches your code as thrown:

| Error | When | What to do |
| --- | --- | --- |
| `E_DRIVER_UNAVAILABLE` (`KitrError`, `data.runtime`, `data.package`) | The app runs in Electron, Tauri or Capacitor and no files driver is registered. | Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/files.ts` to run the web driver inside the webview. |
| `AbortError` | The person cancelled the File System Access picker. | Nothing: `@kitr/files` catches it and resolves `[]` or `null`. |
| `SecurityError` | The picker was called without a user gesture, such as from a timer or after an `await` that took too long. | Call `open`, `pick` or `save` directly from a click or key handler. |
| `NotAllowedError` | The browser or the person denied write access to the chosen file. | Show a message and offer to save again. |
| `TypeError` | The picker rejected its options, such as a filter it can't read. | Check your `filters`. |

```ts
// app/lib/invoices/export-safely.ts
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

Pass `createMemoryFilesDriver(queue)` as the `driver` in config. `open()` and `pick()` take files from `queue`, and `save()` records each call in `driver.saved`. An empty queue behaves like a cancel.

```ts
// app/lib/orders/files.test.ts
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

`open({ multiple: true })` takes every queued file; otherwise each call takes one. Push more with `driver.queue.push(...)`.

To test a component, render it with `renderWithKitr` from `@kitr/testing/react` in a DOM environment and read `driver.saved`:

```tsx
// app/components/orders/export-orders-button.test.tsx
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

Write a driver when a platform has better dialogs than the browser. The interface is `FilesDriver` in the [API reference](/packages/files/api):

| Member | Description |
| --- | --- |
| `name` | Shown in devtools and on `files.driver.name`. |
| `open(options)` | Show the open dialog with `filters`, `multiple` and `title`. Resolve to the picked files, or `[]` when cancelled. |
| `save(data, options)` | Write `data` where the person chooses, starting from `options.name`. Resolve to the path or name, or `null` when cancelled. |
| `reveal(path)` | Optional. Open a path with the system's default app. |

`options.filters` already includes the config filters when the service calls your driver.

### An Electron driver

The built-in Electron driver covers the common case; this one is written over your own IPC contract through [Desktop](/packages/desktop)'s typed IPC. First add three commands to the contract:

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
import { defineProvider } from '@kitr/kitr/app'
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

Add `() => import('#app/providers/electron-files')` to `providers` in `kitrrc.ts`; order doesn't matter. In a plain browser `ipc.available` is `false`, nothing is registered, and the web driver runs. The same shape works for any shell.

## Devtools

With [Devtools](/packages/devtools) installed, `open` and `save` write to the Log panel under `files`. `pick()` doesn't log.

## Next steps

- [API reference](/packages/files/api): every export and type.
- [Uploads](/packages/uploads): send picked files to your server or object storage.
- [Desktop](/packages/desktop): the Electron shell and its typed IPC.
