---
title: Overview
description: Let people open, save and pick files on any platform, with a download fallback in older browsers.
order: 0
---

# Files

## What it is

`@kitr/files` is a `files` service with `open()`, `pick()` and `save()`, plus React hooks. Every picked file has one shape, whether it came from an input, a drop or a native dialog. Saving uses the file picker where it exists and downloads where it does not.

Runs in the browser and in desktop and mobile shells. To receive files on your server, use [uploads](/packages/uploads).

## Install

```sh
kitr add files
```

Adds `@kitr/files`, its provider and `config/files.ts`. [Every change](/packages/files/guide#install).

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

Click **Export orders**. Chrome and Edge open a save dialog; Firefox and Safari download the file. `save()` resolves to `null` when the person cancels. Next in the guide: [Save your first file](/packages/files/guide#save-your-first-file).

## Built on

| Driver | Built on | Where |
| --- | --- | --- |
| File System Access | The [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) | Chrome and Edge: saving writes to the chosen file, and the handle can be kept. |
| Classic web | A hidden `<input type="file">` and a download link | Every other browser. |
| Native | A driver a platform or your own code registers | Desktop and mobile shells, with real paths. |

kitr adds the `PickedFile` shape, type filters, cancellation as a value, a busy state, drop-zone helpers and memory drivers for tests.

## Problems it solves

- **Three browser APIs for one job.** [Save your first file](/packages/files/guide#save-your-first-file).
- **Reading what the person picked.** [Read a file's content](/packages/files/guide#read-a-files-content).
- **Accepting only the right types.** [Filter by file type](/packages/files/guide#filter-by-file-type).
- **Cancelled dialogs treated as errors.** [Know when the person cancelled](/packages/files/guide#know-when-the-person-cancelled).
- **Drag and drop as a separate code path.** [Accept dropped files](/packages/files/guide#accept-dropped-files).
- **Getting the file to your server.** [uploads](/packages/uploads).

## Further reading

- [Guide](/packages/files/guide).
- [API reference](/packages/files/api).
- [File System API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).
- [Uploads](/packages/uploads).
- [Platform](/packages/platform), [Desktop](/packages/desktop) and [Tauri](/packages/tauri).
