---
title: Uploads
description: Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser.
order: 1
---

# Uploads

Multipart uploads with the rules enforced on both sides: the browser checks size and type before sending and shows progress; the server checks again, stores the bytes through a driver and answers with a file record.

## Install

```sh
kitr add uploads
```

The recipe writes `config/uploads.ts` and adds `mountUploads(server)` to `server/main.ts`: `POST /api/uploads` receives files and `GET /api/uploads/:key` serves them.

```ts
// config/uploads.ts
import { createDiskUploadsDriver, defineConfig } from 'kitr/uploads'

export default defineConfig({
  driver: createDiskUploadsDriver({ dir: 'storage/uploads' }),
  maxSize: 10 * 1024 * 1024,
  accept: ['image/*', '.pdf'],
  maxFiles: 1,
})
```

## In a component

```tsx
import { useUpload } from 'kitr/uploads/react'

function Avatar() {
  const { send, progress, uploading, error, files } = useUpload({ accept: ['image/*'] })
  return (
    <>
      <input type="file" accept="image/*" onChange={(e) => send(e.target.files)} />
      {uploading ? <progress value={progress} max={100} /> : null}
      {files[0] ? <img src={files[0].url} alt="" /> : null}
      {error ? <p>{error.message}</p> : null}
    </>
  )
}
```

`upload(file, { url, onProgress })` is the same without React.

## On the server

```ts
// a controller that accepts a document for a project
async store({ event, params, app }: HttpContext) {
  const [file] = await useUploads(app).receive(event, { accept: ['.pdf'], maxSize: 20e6 })
  await db.documents.create({ projectId: params.id, key: file.key, name: file.name })
  return file
}
```

`receive()` throws `KitrError.validation` with the field name when a rule fails, so forms show it under the input. `store()` writes bytes you already have; `read()` and `remove()` complete the set.

## Drivers

The disk driver writes under a directory and serves files through the mounted GET route. Object storage is a driver with `put`, `get`, `delete` and an optional `url(key)` for signed or CDN URLs.
