---
title: Overview
description: Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser.
order: 0
---

# Uploads

## What it is

`@kitr/uploads` takes files from people. In the browser, `useUpload` checks size and type, then sends with progress. On the server, `mountUploads` checks again, stores the bytes through a driver and answers with a record for your database.

Runs on both sides. For files on the user's own device, use [files](/packages/files).

## Install

```sh
kitr add uploads
```

Adds `@kitr/uploads`, its provider, `config/uploads.ts` and `mountUploads(server)` in `server/main.ts`, which serves `POST` and `GET /api/uploads`. Adds [server](/packages/server) first if missing. [Every change](/packages/uploads/guide#install).

## Quick start

The server already accepts files. Add a component that sends one:

```tsx
// app/features/orders/invoice-upload.tsx
import { useUpload } from '@kitr/uploads/react'

export function InvoiceUpload() {
  const { send, progress, uploading, error, files } = useUpload({
    accept: ['application/pdf'],
    maxSize: 10 * 1024 * 1024,
  })
  return (
    <div>
      <input type="file" accept="application/pdf" onChange={(e) => send(e.target.files).catch(() => {})} />
      {uploading ? <progress value={progress} max={100} /> : null}
      {files[0] ? <a href={files[0].url}>{files[0].name}</a> : null}
      {error ? <p role="alert">{error.message}</p> : null}
    </div>
  )
}
```

Grace picks `invoice-1042.pdf`. The hook checks it against the rules, posts it as `multipart/form-data` and updates `progress` from 0 to 100. The server checks the rules again, writes the file to `storage/uploads/<id>/invoice-1042.pdf`, and answers:

```json
{
  "files": [
    {
      "id": "72eb7790-7c62-4c37-9167-d9989b7ac10f",
      "name": "invoice-1042.pdf",
      "size": 48213,
      "type": "application/pdf",
      "url": "/api/uploads/72eb7790-7c62-4c37-9167-d9989b7ac10f/invoice-1042.pdf"
    }
  ]
}
```

The link appears from `files`. A file over 10 MB, or not a PDF, is refused before a byte is sent, and `error` says why. Next in the guide: [Upload your first file](/packages/uploads/guide#upload-your-first-file).

## Built on

kitr adds the shared rules, progress and cancellation, the hook, the error shape, the file record, safe serving headers and the driver interface.

## Problems it solves

- **Uploads with no progress.** [Track progress and cancel](/packages/uploads/guide#track-progress-and-cancel).
- **Size and type checked on one side only.** [Share rules between client and server](/packages/uploads/guide#share-rules-between-client-and-server).
- **Files with no record.** [Store the record in your database](/packages/uploads/guide#store-the-record-in-your-database).
- **Serving uploads unsafely.** [Serve files safely](/packages/uploads/guide#serve-files-safely).
- **Errors in a generic alert.** [Show field errors in a form](/packages/uploads/guide#show-field-errors-in-a-form).
- **Disk in development, object storage in production.** [Drivers](/packages/uploads/guide#drivers).

## Further reading

- [Guide](/packages/uploads/guide).
- [API reference](/packages/uploads/api).
- [FormData on MDN](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- [Server](/packages/server), [API](/packages/api) and [Forms](/packages/forms).
- [Files](/packages/files).
