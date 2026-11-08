---
title: Uploads
description: Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser.
order: 1
---

# Uploads

Avatars, signed invoices, CSV imports: sooner or later an app takes files from people. `@kitr/uploads` does the whole round trip. The browser checks size and type before sending and shows progress. The server checks again, stores the bytes through a driver (disk by default, or your own for S3 and R2) and answers with a file record you save in your database.

> [!SUMMARY]
> File uploads with size and type limits, disk or cloud storage and browser progress. Add it with `kitr add uploads`; the overview is at [/packages/uploads](/packages/uploads).

It runs on both sides: `@kitr/uploads` and `@kitr/uploads/react` in the browser, `@kitr/uploads/server` on the [server](/packages/server). It handles files people send to your app; for files on the user's own device, use [files](/packages/files).

This guide follows Acme's order screen at `app.acme.com`, where Grace attaches the signed invoice PDF to order `ord_1042`.

## Install

```sh
kitr add uploads
```

<details>
<summary>Everything kitr add changes</summary>

- Adds the [server](/packages/server) package first if the project does not have it.
- Installs `@kitr/uploads` and adds it and its provider to `kitrrc.ts`.
- Writes `config/uploads.ts` (see Configure); an existing file is left alone.
- Adds `mountUploads(server)` to `server/main.ts` when that file exists. It registers `POST /api/uploads` to receive files and `GET /api/uploads/**` to serve them, and raises the server's body limit on that path to match `maxSize`.
- Regenerates `config/index.ts`, the config list the standalone server imports.
- Adds a `## kitr: uploads` section to `AGENTS.md`.

It asks no questions. Pass `--dry-run` to print the changes first, or `--no-install` to skip the package manager. No kit includes uploads.

`kitr remove uploads` removes the provider, the package entry, the dependency, `config/uploads.ts` and the `AGENTS.md` section. It leaves the `mountUploads` line in `server/main.ts` and the files under `storage/uploads`.

</details>

## Configure

`kitr add uploads` writes this file:

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'

export default defineConfig({
  maxSize: 10 * 1024 * 1024,
  accept: ['image/*', 'application/pdf'],
  // Files go to storage/uploads and are served by mountUploads() under publicPath. Pass a driver for S3/R2.
  publicPath: '/api/uploads',
})
```

| Option | Default | Description |
| --- | --- | --- |
| `maxSize` | `10485760` (10 MiB) | Largest file in bytes. Checked per file. |
| `accept` | anything | Allowed types: exact MIME types (`application/pdf`), prefixes (`image/*`) or extensions (`.pdf`, case-insensitive). |
| `maxFiles` | `1` | Most files in one request. |
| `driver` | disk, under `storage/uploads` | Where bytes go. See Drivers. |
| `publicPath` | none | URL prefix for the `url` of each stored file, such as `/api/uploads`. Without it (and without a driver `url`), files have no `url`. |
| `allowTypes` | `text/plain`, `text/csv`, `application/json` | Declared types served as themselves when the file's bytes carry no signature. See Serve files safely. |
| `secret` | none | At least 16 characters; signs links from `uploads.signedUrl()`. Read it from the environment and use the same one on every instance. |
| `authorize` | none | `(access, file) => boolean`: who may fetch a file without a signed link. |
| `requireSigned` | `false` | Serve files only through signed links. Needs `secret`. |

Uploads adds no environment variables. The disk driver's directory is relative to the process's working directory.

### Raise the server's body limit

The [server](/packages/server) refuses any body over its limit (1 MiB by default) before uploads sees it. `mountUploads(server)` raises the limit for its own path by `maxSize × maxFiles` plus 64 KiB per file for multipart framing. With the generated config, a 3 MB invoice posted to `/api/uploads` reaches the upload rules, and an 11 MB one gets the uploads size message.

Your own upload routes, such as `/api/orders/:orderId/invoice`, keep the 1 MiB limit and a larger file gets `413 PAYLOAD_TOO_LARGE`. Raise it for that prefix in `config/server.ts`; the longest matching prefix wins:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimits: { '/api/orders': 11 * 1024 * 1024 },
})
```

## Upload your first file

The server already accepts files at `POST /api/uploads`. With `publicPath` set as under Configure, add a component that sends a file:

```tsx
// app/components/orders/invoice-upload.tsx
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

Grace picks `invoice-1042.pdf`. The hook checks it, posts it as `multipart/form-data`, and updates `progress` from 0 to 100. The server checks the rules again, writes `storage/uploads/<id>/invoice-1042.pdf`, and answers:

```json
{
  "files": [
    {
      "id": "72eb7790-7c62-4c37-9167-d9989b7ac10f",
      "key": "72eb7790-7c62-4c37-9167-d9989b7ac10f/invoice-1042.pdf",
      "name": "invoice-1042.pdf",
      "size": 48213,
      "type": "application/pdf",
      "url": "/api/uploads/72eb7790-7c62-4c37-9167-d9989b7ac10f/invoice-1042.pdf"
    }
  ]
}
```

`files` in the hook holds that array, so the link appears; `send` returns it too. `send` rethrows failures, which is why `onChange` ends with `.catch(() => {})`: the hook already shows the error in `error`.

## Track progress and cancel

`useUpload(options)` returns the state and three functions:

| Field | Description |
| --- | --- |
| `send(input)` | Check and upload files, then resolve with the stored files. Takes a `FileList`, `File[]` or `File`. |
| `cancel()` | Aborts the request in flight. `error` becomes `Upload cancelled`. |
| `reset()` | Clears `files`, `progress` and `error`. |
| `files` | The stored files from the last successful upload. |
| `progress` | Percent sent, 0 to 100. |
| `uploading` | `true` while the request is in flight. |
| `error` | The last failure, or `null`. |

A progress indicator with a cancel button:

```tsx
// app/components/orders/attachment-upload.tsx
import { formatBytes } from '@kitr/uploads'
import { useUpload } from '@kitr/uploads/react'

const MAX = 25 * 1024 * 1024

export function AttachmentUpload() {
  const upload = useUpload({ maxSize: MAX, maxFiles: 3 })
  return (
    <div>
      <input type="file" multiple onChange={(e) => upload.send(e.target.files).catch(() => {})} />
      <p>Up to 3 files, {formatBytes(MAX)} each.</p>
      {/* => "Up to 3 files, 25.0 MB each." */}
      {upload.uploading ? (
        <>
          <progress value={upload.progress} max={100} />
          <button type="button" onClick={upload.cancel}>Cancel</button>
        </>
      ) : null}
    </div>
  )
}
```

Calling `send` again while an upload runs aborts the first one. The server enforces `maxFiles`; the browser does not check it.

## Upload without React

`upload(files, options)` from `@kitr/uploads` is the same request without the hook, for a store, an action or plain script code:

```ts
// app/lib/orders/attach-invoice.ts
import { upload, UploadError } from '@kitr/uploads'

export async function attachInvoice(orderId: string, file: File) {
  const controller = new AbortController()
  try {
    const [stored] = await upload(file, {
      url: `/api/orders/${orderId}/invoice`,
      field: 'invoice',
      fields: { orderId },
      headers: { 'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name=csrf]')?.content ?? '' },
      onProgress: ({ loaded, total, percent }) => console.log(`${loaded}/${total} (${percent}%)`),
      signal: controller.signal,
    })
    return stored
  } catch (error) {
    if (error instanceof UploadError) console.warn(error.status, error.message)
    throw error
  }
}
```

| Option | Default | Description |
| --- | --- | --- |
| `url` | `'/api/uploads'` | The endpoint to post to. |
| `field` | `'file'` | The form field the files go in. The server reads the same field. |
| `fields` | none | Extra form fields sent before the files. |
| `headers` | none | Extra request headers, such as a CSRF token. |
| `onProgress` | none | Called with `{ loaded, total, percent }` as bytes go out. |
| `signal` | none | An `AbortSignal` that cancels the upload. |
| `credentials` | `true` | Send cookies with the request. `false` omits them. |

In a browser, `upload` uses `XMLHttpRequest`, the only API that reports upload progress. Without it (Node, a test) it uses `fetch` and `onProgress` is not called. It resolves with the response's `files` array, or the body wrapped in an array when the endpoint returns one file record.

## Check a file before sending

`checkFile(file, rules)` runs the browser half of the rules and returns a message, or `null` when the file passes. `useUpload` calls it for you; call it yourself to show the problem as soon as a file is picked:

```ts
// app/lib/orders/check-invoice.ts
import { checkFile } from '@kitr/uploads'

const scan = new File([new Uint8Array(12 * 1024 * 1024)], 'scan.png', { type: 'image/png' })

checkFile(scan, { maxSize: 10 * 1024 * 1024 })
// => 'scan.png is larger than 10.0 MB'
checkFile(new File(['png'], 'logo.png', { type: 'image/png' }), { accept: ['application/pdf'] })
// => 'logo.png is not an accepted type'
checkFile(new File(['%PDF-1.7'], 'invoice-1042.pdf', { type: 'application/pdf' }), { accept: ['.pdf'] })
// => null
```

`checkFile` uses a 10 MiB `maxSize` when you pass none, like the server, and does not check `maxFiles`.

`accepts(type, name, accept)` is the type test on its own, and `formatBytes(bytes)` formats sizes for hints:

```ts
// app/lib/orders/accept-hint.ts
import { accepts, formatBytes } from '@kitr/uploads'

accepts('image/png', 'logo.png', ['image/*'])
// => true
accepts('application/octet-stream', 'Invoice.PDF', ['.pdf'])
// => true
accepts('application/pdf', 'invoice.pdf.exe', ['.pdf'])
// => false
formatBytes(2048)
// => '2 KB'
formatBytes(10 * 1024 * 1024)
// => '10.0 MB'
```

## Share rules between client and server

The browser check is for people; the server check is for safety. Put the rules in one module that a component and a controller both import:

```ts
// app/lib/orders/invoice-rules.ts
import type { UploadRules } from '@kitr/uploads'

export const invoiceRules: UploadRules = {
  maxSize: 10 * 1024 * 1024,
  accept: ['application/pdf', '.pdf'],
  maxFiles: 1,
}
```

```tsx
// app/components/orders/invoice-field.tsx
import { useUpload } from '@kitr/uploads/react'
import { invoiceRules } from '#app/lib/orders/invoice-rules'

export function InvoiceField({ orderId }: { orderId: string }) {
  const { send, error } = useUpload({ ...invoiceRules, url: `/api/orders/${orderId}/invoice` })
  return (
    <label>
      Signed invoice
      <input type="file" accept=".pdf" onChange={(e) => send(e.target.files).catch(() => {})} />
      {error ? <span role="alert">{error.message}</span> : null}
    </label>
  )
}
```

The controller that receives it is in the next section.

> [!WARNING] Server checks are the ones that count
> Never rely on the browser check alone: anyone can post to the endpoint directly, with any size and declared type.

## Receive files in a controller

`mountUploads` gives you one general endpoint. For files that belong to something, such as an order's invoice, receive them in your own [api](/packages/api) controller. `useUploads(ctx.app)` returns the service, and `receive(event, rules)` reads the multipart body, applies the rules and stores the files:

```ts
// server/controllers/order-invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { useUploads } from '@kitr/uploads/server'
import { invoiceRules } from '#app/lib/orders/invoice-rules'

export default class OrderInvoicesController {
  async store({ app, event, params }: HttpContext<{ orderId: string }>) {
    const [invoice] = await useUploads(app).receive(event, { ...invoiceRules, field: 'file' })
    // ... save invoice.key and invoice.name on order params.orderId in your database
    return { files: [invoice] }
  }
}
```

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/api'
import OrderInvoicesController from '#server/controllers/order-invoices-controller'

export const routes = defineRoutes((router) =>
  router.post('/api/orders/:orderId/invoice', [OrderInvoicesController, 'store']),
)
```

Rules passed to `receive` replace the config's one by one (`maxSize`, `accept`, `maxFiles`, `field` defaulting to `'file'`); the rest come from `config/uploads.ts`. Files are checked one at a time, so a batch can be partly stored when its second file breaks a rule.

When a rule fails, `receive` throws a `VALIDATION` error, and the response is:

```json
{
  "code": "VALIDATION",
  "message": "Validation failed",
  "status": 422,
  "fieldErrors": { "file": ["notes.txt is not an accepted type"] }
}
```

The `fieldErrors` key is the field name, so a [form](/packages/forms) can show it under that input. Don't give the route a body schema in `static validation`: that reads the body before `receive` can.

## Store the record in your database

`receive` and `store` return an `UploadedFile`. Save `key` (how you read or delete the file later) and `name` for display. Don't save `url`; build it from `key` when you render, so a change of `publicPath` or driver does not break old rows.

| Field | Example | Description |
| --- | --- | --- |
| `id` | `'72eb7790-...'` | A random UUID, the first segment of `key`. |
| `key` | `'72eb7790-.../invoice-1042.pdf'` | The storage key: the id, a slash, and the name made safe. |
| `name` | `'invoice 1042.pdf'` | The original name, unchanged. Escape it when you render it. |
| `size` | `48213` | Bytes. |
| `type` | `'application/pdf'` | The type the browser declared. Not checked against the bytes. |
| `url` | `'/api/uploads/72eb.../invoice-1042.pdf'` | From the driver's `url(key)`, else `publicPath + key`, else absent. |

The safe name keeps letters, digits, `.`, `_` and `-`, turns slashes into `_` and anything else into `-`, and is cut to 120 characters: `../../etc/passwd` becomes `.._.._etc_passwd`, inside its own id folder.

## Store and read files from server code

`store` writes bytes you already have, such as a generated PDF; `read` and `remove` complete the set:

```ts
// server/jobs/archive-invoice.ts
import type { KitrApp } from '@kitr/kitr/app'
import { useUploads } from '@kitr/uploads/server'

export async function archiveInvoice(app: KitrApp, pdf: Uint8Array) {
  const uploads = useUploads(app)
  const stored = await uploads.store({ name: 'Q3 report.pdf', type: 'application/pdf', data: pdf })
  // => { id: '788c...', key: '788c.../Q3-report.pdf', name: 'Q3 report.pdf', size: 48213, type: 'application/pdf', url: '/api/uploads/788c.../Q3-report.pdf' }

  const file = await uploads.read(stored.key)
  // => { data: Uint8Array(48213), type: 'application/pdf' }

  await uploads.remove(stored.key)
  await uploads.read(stored.key)
  // => undefined
  return stored
}
```

`store` does not check the rules; they are for files people send. The provider binds `uploads` on the server only, so `useUploads` in browser code throws `[kitr] No binding named "uploads"`.

## Serve files safely

`mountUploads(server)` answers `GET /api/uploads/<key>` with the stored bytes and the headers from `servedFileHeaders`. The stored type is whatever the uploader's browser declared, so the route reads the type from the bytes instead:

- A known signature (PNG, JPEG, GIF, WebP, AVIF, PDF, MP4, WebM, MP3, ZIP and the like) is served as the type the bytes show. Images, audio, video and PDF are inline; archives and other binaries download.
- No signature means text or an unknown format. It is served as its declared type only if that type is in `allowTypes` (default `text/plain`, `text/csv`, `application/json`), and only `text/plain` is inline.
- Everything else, SVG and HTML included, is `application/octet-stream` with `Content-Disposition: attachment`.

Every response also carries `X-Content-Type-Options: nosniff` and a sandboxing content security policy, so an uploaded file cannot run script as your site.

`servedFileHeaders(type, name, { data })` from `@kitr/uploads/server` returns those headers for routes you write yourself. Pass the bytes in `data` so the type comes from them. For an HTML upload:

```ts
// server/check_headers.ts
import { servedFileHeaders } from '@kitr/uploads/server'

const html = new TextEncoder().encode('<script>alert(1)</script>')

servedFileHeaders('text/html', 'page.html', { data: html })
// => {
//   'content-type': 'application/octet-stream',
//   'content-disposition': 'attachment; filename="page.html"',
//   'x-content-type-options': 'nosniff',
//   'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
//   'cache-control': 'public, max-age=31536000, immutable',
// }
```

`sniffType(bytes)` returns the type a file's signature shows, or `undefined`. `uploads.mount(server, path)` registers the same two routes with the same headers and body limit (see Use the service without the provider).

> [!WARNING] Files are public by default
> Without `secret`, `authorize` or `requireSigned`, every file is public to anyone with its key. Keys contain a random UUID, so they cannot be guessed, but links can be passed on. The next two sections close that.

## Share a file with a signed link

`uploads.signedUrl(key, { expiresIn })` returns the file's URL with an expiry and an HMAC-SHA-256 signature over its path and expiry. Set `secret` in `config/uploads.ts` first:

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'

export default defineConfig({
  accept: ['image/*', 'application/pdf'],
  publicPath: '/api/uploads',
  secret: process.env.UPLOADS_SECRET,
  requireSigned: true,
})
```

A controller then hands out five-minute links:

```ts
// server/controllers/order_invoices_controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'
import { useUploads } from '@kitr/uploads/server'

export default class OrderInvoicesController {
  async link({ app, locals }: HttpContext) {
    if (!locals.user) throw KitrError.unauthorized()
    // ... look up the invoice key in your database and check the user's team
    const key = '72eb7790-7c62-4c37-9167-d9989b7ac10f/invoice-1042.pdf'
    return { url: await useUploads(app).signedUrl(key, { expiresIn: 300 }) }
  }
}
```

The link looks like `/api/uploads/72eb7790-.../invoice-1042.pdf?expires=1767225900&signature=3Qk...`. It works for that file until `expires`; changing either makes the signature fail. An expired or altered link gets `403`, and so does a request with no link when `requireSigned` is on. Anyone holding a link can open the file until it expires, so keep `expiresIn` short. Responses reached through a link carry `Cache-Control: private`.

`signedUrl(path, { expiresIn, secret })` and `verifySignedUrl(url, secret)` from `@kitr/uploads/server` do the same for any path. For a mount path other than `/api/uploads`, pass `path: '/files'`.

## Check who may open a file

`authorize(access, file)` runs for every request without a signed link. `access` has the `event`, `request` and `app`, so it can read the session; `file` has `key`, `name`, the served `type` and `size`. Return `false` for `403`:

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'

export default defineConfig({
  publicPath: '/api/uploads',
  authorize: ({ app }, file) => {
    const session = app.container.use('auth').session
    return !!session && file.key.startsWith(`${session.user.id}/`)
  },
})
```

A valid signed link skips `authorize`, so a link is how you share a file with someone who has no account. Authorized responses carry `Cache-Control: private`.

## Serve private files

To check access in your own route, read the file in a controller and answer with the safe headers:

```ts
// server/controllers/order-invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'
import { servedFileHeaders, useUploads } from '@kitr/uploads/server'

export default class OrderInvoicesController {
  async show({ app, params, locals }: HttpContext<{ orderId: string }>) {
    if (!locals.user) throw KitrError.unauthorized()
    // ... look up the order and its invoice key in your database, and check the user's team
    const key = '72eb7790-7c62-4c37-9167-d9989b7ac10f/invoice-1042.pdf'
    const file = await useUploads(app).read(key)
    if (!file) throw KitrError.notFound('Invoice')
    return new Response(file.data as BodyInit, {
      headers: {
        ...servedFileHeaders(file.type, 'invoice-1042.pdf', { data: file.data }),
        'cache-control': 'private, no-store',
      },
    })
  }
}
```

`locals.user` is set by the [auth](/packages/auth) middleware. Override `cache-control`: the default lets shared caches keep the file for a year.

## Show field errors in a form

A server rejection reaches the browser as an `UploadError`, with `status` and the parsed `body`, so field messages are at `body.fieldErrors`:

```tsx
// app/components/orders/invoice-error.tsx
import { UploadError } from '@kitr/uploads'

export function InvoiceError({ error }: { error: Error | null }) {
  if (!error) return null
  if (error instanceof UploadError && error.status === 422) {
    const fields = (error.body as { fieldErrors?: Record<string, string[]> }).fieldErrors
    return <p role="alert">{fields?.file?.[0] ?? error.message}</p>
  }
  if (error instanceof UploadError && error.status === 413) return <p role="alert">That file is too large.</p>
  return <p role="alert">{error.message}</p>
}
```

A failed browser check in `useUpload` is a plain `Error` with the `checkFile` message, and no request is sent.

## Drivers

A driver decides where bytes live. Two ship with kitr; for other storage, write one (see Extend).

| Driver | Import | Use it for |
| --- | --- | --- |
| Disk | `createDiskUploadsDriver` | The default. One server with a persistent disk. |
| Memory | `createMemoryUploadsDriver` | Tests and demos. Files vanish on restart. |
| unstorage | `createUnstorageUploadsDriver` | Several servers or serverless hosts: S3, R2, Azure Blob, Vercel Blob, Netlify Blobs through [unstorage](https://unstorage.unjs.io). |
| Anything else | your own `UploadsDriver` | A storage service unstorage has no driver for, or signed URLs from a CDN. |

### Disk

The default when `driver` is not set; nothing to install.

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'
import { createDiskUploadsDriver } from '@kitr/uploads/server'

export default defineConfig({
  driver: createDiskUploadsDriver({ dir: '/var/lib/acme/uploads', publicPath: '/api/uploads' }),
  maxSize: 10 * 1024 * 1024,
  accept: ['image/png', 'image/jpeg', 'application/pdf'],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `dir` | `'storage/uploads'` | Directory, relative to the working directory or absolute. Created on first write. |
| `publicPath` | none | Gives the driver a `url(key)` that returns `publicPath/key`. |

Each file is written next to a `<file>.meta.json` sidecar with its type and name. Keys that resolve outside `dir`, or name a sidecar, throw `FORBIDDEN` (`Bad upload key`). A file without a sidecar is read as `application/octet-stream`.

> [!WARNING] Ephemeral disks
> On hosts with an ephemeral filesystem (most containers and serverless platforms), files under `storage/uploads` are lost on every deploy or restart. Mount a persistent volume at `dir`, or use object storage.

> [!WARNING] One disk per instance
> With more than one instance, each has its own disk: a file uploaded through instance A is a 404 on instance B. Use one shared volume, or the [unstorage](#unstorage) driver.

### unstorage

`createUnstorageUploadsDriver` stores files through any [unstorage](https://unstorage.unjs.io) instance, so every instance reads and writes the same bucket. Install unstorage; for S3 or Cloudflare R2 the `s3` driver needs no extra package:

```sh
pnpm add unstorage
```

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'
import { createUnstorageUploadsDriver } from '@kitr/uploads/server'
import { createStorage } from 'unstorage'
import s3Driver from 'unstorage/drivers/s3'

const bucket = createStorage({
  driver: s3Driver({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    endpoint: process.env.S3_ENDPOINT!,
    bucket: 'acme-uploads',
    region: 'auto',
  }),
})

export default defineConfig({
  driver: createUnstorageUploadsDriver(bucket, { publicPath: '/api/uploads' }),
  maxSize: 10 * 1024 * 1024,
  accept: ['image/png', 'image/jpeg', 'application/pdf'],
})
```

Add the credentials to `.env`:

```sh
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
```

| Option | Default | Description |
| --- | --- | --- |
| `base` | `'uploads'` | Second argument, `{ base }`. Files live under `<base>:files:`, their type and name under `<base>:meta:`. |
| `publicPath` | none | Gives the driver a `url(key)` that returns `publicPath/key`. |

Files are read back through the kitr route (`GET /api/uploads/:key`), so the bucket can stay private. Keys with an empty segment or `..` throw `FORBIDDEN`. See the [unstorage S3 driver docs](https://unstorage.unjs.io/drivers/s3) for its options.

### Memory

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'
import { createMemoryUploadsDriver } from '@kitr/uploads/server'

export default defineConfig({
  driver: createMemoryUploadsDriver(),
  publicPath: '/api/uploads',
})
```

The memory driver has no `url`, so `publicPath` builds the URLs. Use it in tests.

## Use the service without the provider

`createUploads(config)` builds the service on its own, for a driver that imports a server-only SDK you don't want in `config/uploads.ts` (React apps bundle it for the browser too), or for a second set of rules with its own route:

```ts
// server/avatars.ts
import { createDiskUploadsDriver, createUploads } from '@kitr/uploads/server'

export const avatars = createUploads({
  driver: createDiskUploadsDriver({ dir: 'storage/avatars', publicPath: '/api/avatars' }),
  maxSize: 2 * 1024 * 1024,
  accept: ['image/png', 'image/jpeg', 'image/webp'],
})
```

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { avatars } from './avatars'

export const server = createServer({ providers: rc.providers, config })
// POST /api/avatars receives, GET /api/avatars/** serves with servedFileHeaders.
avatars.mount(server, '/api/avatars')
```

`mount` receives with the service's own rules and serves with the safe headers. In components, point the hook at it: `useUpload({ url: '/api/avatars', accept: ['image/png', 'image/jpeg', 'image/webp'] })`.

## Errors

The server throws kitr errors in the usual JSON shape. `upload()` and `useUpload` turn any non-2xx response into an `UploadError`.

| Code / message | When | What to do |
| --- | --- | --- |
| `VALIDATION`, `Expected multipart/form-data` | The request is not a multipart form. | Send with `upload()` or a `FormData` body. |
| `VALIDATION`, `No file sent` | The form has no file in the expected field. | Match `field` on both sides (default `file`). |
| `VALIDATION`, `At most 1 file(s)` | More files than `maxFiles`. | Raise `maxFiles`, or send fewer. |
| `VALIDATION`, `invoice.pdf is larger than 10485760 bytes` | A file is over `maxSize`. | Show the limit with `formatBytes`. |
| `VALIDATION`, `notes.txt is not an accepted type` | A file fails `accept`. | Pick another file, or widen `accept`. |
| `PAYLOAD_TOO_LARGE` (413) | The whole body is over the server's limit for that path. `mountUploads` sets its own path's limit from `maxSize`. | For your own routes, add the path to `bodyLimits` in `config/server.ts`. |
| `NOT_FOUND`, `File not found` | `GET` for a key that does not exist. | Check the stored key. |
| `FORBIDDEN`, `Bad upload key` | Disk driver: the key leaves `dir` or names a sidecar. | Use keys from `store` or `receive` only. |
| `UploadError`, status `0`, `Network error during upload` | The request never completed. | Retry when online. |
| `UploadError`, status `0`, `Upload cancelled` | `cancel()` or the `signal` aborted it. | Nothing; the user cancelled. |
| `UploadError`, `Upload failed (502)` | A non-JSON error response, such as a proxy page. | Check the proxy or server logs. |

## Testing

Use the memory driver and call the server with `server.fetch`; no port, no disk. This test posts Grace's invoice through the real route and checks the rules:

```ts
// test/uploads.test.ts
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { createMemoryUploadsDriver, createUploads } from '@kitr/uploads/server'
import { describe, expect, it } from 'vitest'

function setup() {
  const uploads = createUploads({
    driver: createMemoryUploadsDriver(),
    accept: ['application/pdf'],
    maxSize: 1024,
    publicPath: '/api/uploads',
  })
  const server = createServer({ logger: silentLogger })
  uploads.mount(server)
  return { uploads, server }
}

function post(server: { fetch(request: Request): Promise<Response> }, file: File) {
  const form = new FormData()
  form.append('file', file)
  return server.fetch(new Request('http://acme.test/api/uploads', { method: 'POST', body: form }))
}

describe('invoice uploads', () => {
  it('stores a PDF and serves it back', async () => {
    const { uploads, server } = setup()
    const res = await post(server, new File(['%PDF-1.7'], 'invoice 1042.pdf', { type: 'application/pdf' }))
    expect(res.status).toBe(200)

    const { files } = (await res.json()) as { files: Array<{ key: string; name: string; size: number; url: string }> }
    expect(files[0]).toMatchObject({ name: 'invoice 1042.pdf', size: 8 })
    expect(files[0]!.key).toMatch(/\/invoice-1042\.pdf$/)
    expect(files[0]!.url).toBe(`/api/uploads/${files[0]!.key}`)

    const served = await server.fetch(new Request(`http://acme.test${files[0]!.url}`))
    expect(served.headers.get('content-type')).toBe('application/pdf')
    expect(await served.text()).toBe('%PDF-1.7')
    expect(await uploads.read(files[0]!.key)).toBeDefined()
  })

  it('rejects a file of the wrong type with a field error', async () => {
    const { server } = setup()
    const res = await post(server, new File(['hi'], 'notes.txt', { type: 'text/plain' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { file: ['notes.txt is not an accepted type'] },
    })
  })
})
```

To test code that calls `useUploads(app)`, boot an app with the provider and a memory driver from [testing](/packages/testing):

```ts
// server/jobs/archive-invoice.test.ts
import { createTestApp } from '@kitr/testing'
import { uploadsProvider } from '@kitr/uploads/provider'
import { createMemoryUploadsDriver, useUploads } from '@kitr/uploads/server'
import { expect, it } from 'vitest'

it('stores the generated report', async () => {
  const app = await createTestApp({
    providers: [uploadsProvider],
    config: { uploads: { driver: createMemoryUploadsDriver() } },
  })
  const stored = await useUploads(app).store({
    name: 'Q3 report.pdf',
    type: 'application/pdf',
    data: new TextEncoder().encode('%PDF'),
  })
  expect(stored).toMatchObject({ name: 'Q3 report.pdf', size: 4 })
  expect(stored.key).toMatch(/\/Q3-report\.pdf$/)
})
```

On the client, `upload()` falls back to `fetch` without `XMLHttpRequest`, so a Node test can replace `globalThis.fetch` with `(url, init) => server.fetch(new Request('http://acme.test' + url, init))`.

## Extend

Any storage is a driver: an object with `put`, `get`, `delete` and optionally `url`. Keys are relative paths such as `72eb.../invoice-1042.pdf` that the driver owns.

```ts
// node_modules/@kitr/uploads/dist/server.d.ts (excerpt)
export interface UploadsDriver {
  name: string
  put(key: string, data: Uint8Array, meta: { type: string; name: string }): Promise<void>
  get(key: string): Promise<{ data: Uint8Array; type: string } | undefined>
  delete(key: string): Promise<void>
  url?(key: string): string | Promise<string>
}
```

An S3 driver with the [AWS SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/); `endpoint` makes it work with Cloudflare R2 and other S3-compatible stores:

```sh
pnpm add @aws-sdk/client-s3
```

```ts
// server/uploads/s3-driver.ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { UploadsDriver } from '@kitr/uploads/server'

export function createS3UploadsDriver(options: { bucket: string; endpoint?: string; publicUrl?: string }): UploadsDriver {
  const s3 = new S3Client({ endpoint: options.endpoint, region: process.env.AWS_REGION ?? 'auto' })
  return {
    name: 's3',
    async put(key, data, meta) {
      await s3.send(new PutObjectCommand({ Bucket: options.bucket, Key: key, Body: data, ContentType: meta.type }))
    },
    async get(key) {
      try {
        const object = await s3.send(new GetObjectCommand({ Bucket: options.bucket, Key: key }))
        const data = await object.Body!.transformToByteArray()
        return { data, type: object.ContentType ?? 'application/octet-stream' }
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey') return undefined
        throw error
      }
    },
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
    },
    url: options.publicUrl ? (key) => `${options.publicUrl}/${key}` : undefined,
  }
}
```

Register it with a service created in server code, so the SDK stays out of the browser bundle:

```ts
// server/uploads/index.ts
import { createUploads } from '@kitr/uploads/server'
import { createS3UploadsDriver } from './s3-driver'

export const uploads = createUploads({
  driver: createS3UploadsDriver({
    bucket: 'acme-uploads',
    endpoint: process.env.S3_ENDPOINT,
    publicUrl: 'https://files.acme.com',
  }),
  maxSize: 10 * 1024 * 1024,
  accept: ['image/png', 'image/jpeg', 'application/pdf'],
})
```

Then call `uploads.mount(server)` in `server/main.ts` instead of `mountUploads(server)`. With `url` set, stored files link straight to the bucket's public domain and the `GET` route is only a fallback. See [`UploadsDriver`](/packages/uploads/api) in the API reference.

## Next steps

- [API reference](/packages/uploads/api): every export with its signature.
- [Server](/packages/server): `createServer`, `bodyLimits` and the error shape.
- [Forms](/packages/forms): show `fieldErrors` under the file input.
