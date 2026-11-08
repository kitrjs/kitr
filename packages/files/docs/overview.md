---
title: Overview
description: Let people open, save and pick files on any platform, with a download fallback in older browsers.
order: 0
---

# Files

Sooner or later someone wants to get a file in or out of your app: import last month's orders from a spreadsheet, export invoices as CSV, attach a receipt. The browser has three generations of API for that, desktop shells have real file paths, and phones have a picker of their own. Components should not have to know which one they are running in.

`@kitr/files` gives them one service with three calls that always shows the best dialog the current platform has.

## What it is

`@kitr/files` is a `files` service with `open()`, `pick()` and `save()`, plus React hooks around them. Every picked file has the same shape, a `PickedFile` with `text()`, `bytes()` and `blob()`, whether it came from a browser input, a drag and drop or a native dialog. Saving writes to the file the person chose where the platform allows it, and downloads where it does not.

It runs in the browser and in desktop and mobile shells. On the server the service exists but has no dialogs. To receive files on your server and store them, use [uploads](/packages/uploads); `@kitr/files` only gets them into and out of the browser.

## Install

```sh
kitr add files
```

This installs `@kitr/files`, registers the provider in `kitrrc.ts` and writes `config/files.ts`. The guide's [Install](/packages/files/guide#install) section lists every change.

## Quick start

Export a list as a CSV with one button. `useFileDialogs()` returns the service's calls plus a `busy` flag:

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

Click **Export orders**. In Chrome or Edge a save dialog opens with `acme-orders.csv` filled in and the console prints `Saved to acme-orders.csv`. In Firefox and Safari the browser downloads the file right away. In the Electron shell the same call shows the operating system's dialog. `save()` resolves to `null` when the person cancels. The guide continues from here: [Save your first file](/packages/files/guide#save-your-first-file).

## Built on

| Driver | Built on | Where |
| --- | --- | --- |
| File System Access | The [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) | Chrome and Edge: saving writes to the chosen file, and the handle can be kept. |
| Classic web | A hidden `<input type="file">` and a download link | Every other browser. |
| Native | A driver a platform or your own code registers | Desktop and mobile shells, with real paths. |

kitr adds the `PickedFile` shape, type filters that work in every driver, cancellation as a value rather than an exception, a busy state while a dialog is open, drop-zone helpers, memory drivers for tests and the driver slot itself.

## Problems it solves

- **Three browser APIs for one job.** One `save()` call writes to the chosen file where it can and downloads where it cannot. See [Save your first file](/packages/files/guide#save-your-first-file).
- **Reading what the person picked.** Every file comes back as a `PickedFile` with the same methods. See [Read a file's content](/packages/files/guide#read-a-files-content).
- **Accepting only the right types.** Filters are declared once and translated for each driver. See [Filter by file type](/packages/files/guide#filter-by-file-type).
- **Cancelled dialogs treated as errors.** Cancel is a result you check, not an exception you catch. See [Know when the person cancelled](/packages/files/guide#know-when-the-person-cancelled).
- **Drag and drop as a separate code path.** Dropped files become the same `PickedFile`s. See [Accept dropped files](/packages/files/guide#accept-dropped-files).
- **Getting the file to your server.** Hand a picked file to [uploads](/packages/uploads). See [Send a picked file to your server](/packages/files/guide#send-a-picked-file-to-your-server).

## Further reading

- [Guide](/packages/files/guide): install, configure and every task.
- [API reference](/packages/files/api): every export and type.
- [File System API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API): what the best driver can do and where it works.
- [Uploads](/packages/uploads): send picked files to your server or object storage.
- [Platform](/packages/platform), [Desktop](/packages/desktop) and [Tauri](/packages/tauri): where the app runs and the shells that register native drivers.
