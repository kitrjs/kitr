---
title: API reference
description: Every export of @kitr/uploads, with its signature.
order: 2
---

# API reference

Every export of `@kitr/uploads`, `@kitr/uploads/react`, `@kitr/uploads/server`, `@kitr/uploads/provider`, read from the published type definitions. The [guide](/packages/uploads/guide) shows them in use.

## @kitr/uploads

### accepts

```ts
function accepts(type: string, name: string, accept?: string[]): boolean;
```

`image/*` matches `image/png`; exact types match themselves; `.pdf` matches by extension.

### checkFile

```ts
function checkFile(file: File, rules?: UploadRules): string | null;
```

Client-side check against the same rules the server enforces, so errors show before the request.

### formatBytes

```ts
function formatBytes(bytes: number): string;
```

Formats a byte count for people: `formatBytes(10 * 1024 * 1024)` is `'10.0 MB'`.

### upload

```ts
function upload(files: File | File[], options?: UploadOptions): Promise<UploadedFile[]>;
```

Upload one or more files with progress. XMLHttpRequest is the only browser API that reports
upload progress, so this is XHR with a promise around it; a fetch fallback runs elsewhere.

### UploadError

```ts
class UploadError extends Error {
  readonly status: number;
  readonly body?: unknown | undefined;
  constructor(message: string, status: number, body?: unknown | undefined);
}
```

What `upload()` rejects with: the server's message and HTTP `status` (0 for network errors and
cancels), and the parsed response `body`, which carries `fieldErrors` for rule violations.

### defineConfig

```ts
const defineConfig: <const C extends UploadsConfig>(config: C) => C;
```

Typed identity helper for `config/uploads.ts`.

### ServedFile

```ts
interface ServedFile {
  /** The storage key: `<id>/<name>`. */
  key: string;
  /** The file name, from the key. */
  name: string;
  /** The type the file will be served with (sniffed from its bytes, or allow-listed). */
  type: string;
  /** Size in bytes. */
  size: number;
}
```

The stored file `authorize` is asked about.

### UploadAccess

```ts
interface UploadAccess {
  /** The h3 event of the request. */
  event: H3Event;
  /** The request. */
  request: Request;
  /** The app for this request (a fork per request on a kitr server): `app.container.use('auth')` for the session. */
  app: KitrApp;
}
```

Who is asking, as `authorize` sees it.

### UploadedFile

```ts
interface UploadedFile {
  /** The random id the file was stored under: the first segment of `key`. */
  id: string;
  /** The original file name, as the browser sent it. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** The MIME type the browser declared. Not sniffed from the bytes. */
  type: string;
  /** Where it can be fetched, when the driver serves files. */
  url?: string;
  /** The storage key the driver wrote. */
  key: string;
}
```

What the server returns for every stored file, and what the client resolves with.

### UploadOptions

```ts
interface UploadOptions {
  /** The endpoint, default `/api/uploads`. */
  url?: string;
  /** Form field name, default `file`. */
  field?: string;
  /** Extra fields sent with the file. */
  fields?: Record<string, string>;
  /** Extra request headers, such as a CSRF token. */
  headers?: Record<string, string>;
  /** Called as bytes go out, with `percent` from 0 to 100. Only the XHR path (browsers) reports progress. */
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percent: number;
  }) => void;
  /** Aborts the upload; the promise rejects with `UploadError('Upload cancelled', 0)`. */
  signal?: AbortSignal;
  /** Sent with credentials (cookies). Default true. */
  credentials?: boolean;
}
```

Options for `upload()` and `useUpload()`: where to send, extra form fields and headers, progress and cancel.

### UploadRules

```ts
interface UploadRules {
  /** Bytes. Default 10 MiB. */
  maxSize?: number;
  /** Allowed MIME types or patterns such as `image/*`. Default: anything. */
  accept?: string[];
  /** Files per request. Default 1. */
  maxFiles?: number;
}
```

The size, type and count limits checked in the browser (`checkFile`, `useUpload`) and on the server (`receive`).

### UploadsConfig

```ts
interface UploadsConfig extends UploadRules {
  /** Where files go. Default: `storage/uploads` on disk (`createDiskUploadsDriver`). */
  driver?: unknown;
  /** Public URL prefix the driver answers under, e.g. `/uploads`. */
  publicPath?: string;
  /**
   * Declared types served as themselves when the file's bytes carry no signature to check (text
   * formats have none), always as a download except `text/plain`. Patterns such as `text/*` work.
   * Files with a recognised signature (images, PDF, audio, video, archives) are served with the
   * type their bytes show, whatever was declared; anything else is `application/octet-stream`.
   * Default `['text/plain', 'text/csv', 'application/json']`.
   */
  allowTypes?: string[];
  /**
   * Secret for signed links (`uploads.signedUrl(key, { expiresIn })`), at least 16 characters.
   * Set it from the environment, the same on every instance.
   */
  secret?: string;
  /**
   * Decides who may fetch a file without a signed link. Return false (or throw) to answer 403.
   * Runs for every unsigned `GET`; a valid signed link skips it. Without it, and without
   * `requireSigned`, files are public to anyone who knows the key.
   */
  authorize?: (access: UploadAccess, file: ServedFile) => boolean | Promise<boolean>;
  /** Serve files only through signed links: a request without a valid signature is refused. Needs `secret`. Default false. */
  requireSigned?: boolean;
}
```

The shape of `config/uploads.ts`: the default rules plus where files are stored and served.

## @kitr/uploads/react

### useUpload

```ts
function useUpload(options?: UploadOptions & UploadRules): {
  send: (input: FileList | File[] | File | null) => Promise<UploadedFile[]>;
  cancel: () => void | undefined;
  reset: () => void;
  files: UploadedFile[];
  progress: number;
  uploading: boolean;
  error: Error | null;
};
```

Upload with progress from a component:

```ts
const { send, progress, uploading, error } = useUpload({ accept: ['image/*'] })
<input type="file" onChange={(e) => send(e.target.files)} />
```
`send` checks every file against the rules first, then uploads; it resolves with the stored files and rethrows failures.

### UseUploadState

```ts
interface UseUploadState {
  /** The stored files from the last successful upload. */
  files: UploadedFile[];
  /** Percent sent, 0 to 100. */
  progress: number;
  /** True while a request is in flight. */
  uploading: boolean;
  /** The last failure: a plain `Error` from the client-side check, or an `UploadError` from the request. */
  error: Error | null;
}
```

The state `useUpload()` returns next to `send`, `cancel` and `reset`.

## @kitr/uploads/server

### createDiskUploadsDriver

```ts
function createDiskUploadsDriver(options?: {
  dir?: string;
  publicPath?: string;
}): UploadsDriver;
```

Files under a directory (default `storage/uploads`), loaded lazily so the browser bundle never sees node:fs.

### createMemoryUploadsDriver

```ts
function createMemoryUploadsDriver(): UploadsDriver;
```

A driver that keeps files in a Map, for tests and demos. Everything is lost when the process exits.

### createUnstorageUploadsDriver

```ts
function createUnstorageUploadsDriver(storage: UnstorageRawLike, options?: {
  base?: string;
  publicPath?: string;
}): UploadsDriver;
```

An uploads driver over any unstorage instance, so every server instance reads and writes the
same files: object storage such as S3 or R2 instead of one machine's disk.

```ts
driver: createUnstorageUploadsDriver(createStorage({ driver: s3Driver({ bucket: 'acme-uploads', ... }) }))
```
Files live under `base` (default `uploads`) with their type and name kept beside them under
`<base>:meta`. `publicPath` gives the driver a `url(key)`, as with the disk driver.

### createUploads

```ts
function createUploads(config?: UploadsConfig): Uploads;
```

Creates the uploads service from a config: the driver (disk under `storage/uploads` by default)
and the default rules. The provider calls it with `config/uploads.ts`; call it yourself in tests.

### mountUploads

```ts
function mountUploads<S extends {
  h3: any;
  app: KitrApp;
  config?: {
    bodyLimits?: Record<string, number>;
  };
}>(server: S, path?: string): S;
```

Mount `POST <path>` (receive) and `GET <path>/**` (serve) on a kitr server from `server/main.ts`.
The service is resolved per request, so this can run before the app has booted.

### resolveServedType

```ts
function resolveServedType(declared: string, data: Uint8Array, allow?: readonly string[]): {
  type: string;
  inline: boolean;
};
```

The type a stored file is served as, and whether a browser may show it inline: the type its bytes
show (so a declared `image/png` over HTML is not an image); failing that, the declared type if
allow-listed; otherwise `application/octet-stream`.

### servedFileHeaders

```ts
function servedFileHeaders(type: string, name?: string, options?: ServedFileOptions): Record<string, string>;
```

Headers for serving a stored file: never sniffed by the browser (`nosniff`), sandboxed, and
inline only when that is safe; everything else is a download (`Content-Disposition: attachment`).
Pass the bytes in `options.data` so the type comes from them, not from the uploader.

### signedUrl

```ts
function signedUrl(path: string, options: SignedUrlOptions): Promise<string>;
```

A link to `path` that works until it expires: `path?expires=<unix seconds>&signature=<HMAC>`.
The signature is HMAC-SHA-256 (Web Crypto) over the path and the expiry, so the link works for
that file only and only until then. Anyone holding the link can fetch the file, so keep
`expiresIn` short and send it only to the person it is for.

```ts
signedUrl('/api/uploads/3f2a/report.pdf', { expiresIn: 300, secret })
```

### sniffType

```ts
function sniffType(data: Uint8Array): string | undefined;
```

The content type of a file from its first bytes, for formats that have a signature; undefined
for everything else (text formats, SVG, HTML and unknown binaries have none).

Uploads are served with the sniffed type, never the one the uploader declared: a browser trusts
whatever the server says, so a declared `image/png` over HTML bytes would otherwise run as the site.

### useUploads

```ts
function useUploads(app: KitrApp): Uploads;
```

Returns the `uploads` service the provider bound, for a controller or job: `useUploads(ctx.app)`.

### verifySignedUrl

```ts
function verifySignedUrl(url: URL, secret: string, now?: number): Promise<SignatureCheck>;
```

Check the `expires` and `signature` query parameters of a request URL against `secret`.

### ServedFileOptions

```ts
interface ServedFileOptions {
  /**
   * The file's bytes. With them the type is sniffed from the signature (PNG, JPEG, PDF, ZIP...)
   * and the declared type is only a fallback for allow-listed text formats; without them the
   * declared type is taken as given.
   */
  data?: Uint8Array;
  /** Declared types that may be served as themselves when the bytes have no signature. Default `text/plain`, `text/csv`, `application/json`. */
  allow?: string[];
  /** Override `cache-control`. Default: public and immutable. */
  cacheControl?: string;
}
```

Options of `servedFileHeaders`.

### SignedUrlOptions

```ts
interface SignedUrlOptions {
  /** Seconds the link works for. */
  expiresIn: number;
  /** The signing secret: at least 16 characters, the same on every instance that serves the file. */
  secret: string;
  /** The current time in ms; for tests. */
  now?: number;
}
```

Options for `signedUrl()`.

### StoredFile

```ts
interface StoredFile {
  key: string;
  name: string;
  size: number;
  type: string;
}
```

A stored file's key, original name, size and type.

### UnstorageRawLike

```ts
interface UnstorageRawLike {
  getItemRaw(key: string): Promise<unknown>;
  setItemRaw(key: string, value: Uint8Array): Promise<void>;
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

The part of an [unstorage](https://unstorage.unjs.io) `Storage` the uploads driver uses. Any
unstorage instance fits, whatever its driver: S3 and R2 (`unstorage/drivers/s3`), Azure Blob,
Vercel Blob, Netlify Blobs, the filesystem.

### Uploads

```ts
interface Uploads {
  /** Read a multipart request, apply the rules and store the files. Throws KitrError on violation. */
  receive(event: H3Event, rules?: UploadRules & {
    field?: string;
  }): Promise<UploadedFile[]>;
  /** Store bytes directly (from a job, a migration). */
  store(file: {
    name: string;
    type: string;
    data: Uint8Array;
  }): Promise<UploadedFile>;
  /** Read a stored file's bytes and type, or `undefined`. */
  read(key: string): Promise<{
    data: Uint8Array;
    type: string;
  } | undefined>;
  /** Delete a stored file through the driver. */
  remove(key: string): Promise<void>;
  /**
   * A link to a stored file that works for `expiresIn` seconds and no longer: the file's URL
   * under the mount path (default `/api/uploads`) with an HMAC signature. Needs `secret` in
   * `config/uploads.ts`. The link skips `authorize`, so hand it only to the person it is for.
   */
  signedUrl(key: string, options: {
    expiresIn: number;
    path?: string;
  }): Promise<string>;
  /** Answer a `GET` for a stored file under `base`: checks the signed link or `authorize`, then sends the file with safe headers. What the mounted route runs. */
  serve(event: H3Event, options?: {
    base?: string;
    app?: KitrApp;
  }): Promise<Response>;
  /** Mount `POST <path>` (receive) and `GET <path>/:key` (serve) on a kitr server. */
  mount<S extends {
    h3: any;
    app?: KitrApp;
  }>(server: S, path?: string): S;
  /** The config this service was made from. */
  readonly config: UploadsConfig;
  /** The driver files are stored with. */
  readonly driver: UploadsDriver;
}
```

The uploads service, as `createUploads` returns it and `useUploads(app)` reads it from the container.

### UploadsDriver

```ts
interface UploadsDriver {
  /** A short label, such as `disk` or `memory`. */
  name: string;
  /** Write the bytes under `key`, keeping `type` so `get` can return it. */
  put(key: string, data: Uint8Array, meta: {
    type: string;
    name: string;
  }): Promise<void>;
  /** Read a file back, or `undefined` when the key does not exist. */
  get(key: string): Promise<{
    data: Uint8Array;
    type: string;
  } | undefined>;
  /** Delete a file. Deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
  /** A URL for the key, when files are served (CDN, signed URL, the kitr route). */
  url?(key: string): string | Promise<string>;
}
```

Where bytes go: disk, S3, R2, GCS. Keys are relative paths the driver owns.

### SignatureCheck

```ts
type SignatureCheck = 'ok' | 'unsigned' | 'expired' | 'invalid';
```

Why a signed link was refused, or `ok`; `unsigned` when the request carries no signature at all.

## @kitr/uploads/provider

### uploadsProvider

```ts
const uploadsProvider: import("@kitr/core").KitrProvider;
```

Binds `uploads` on the server from `config/uploads.ts`. The server module is loaded at boot so
the browser bundle of this provider never resolves node:fs.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
