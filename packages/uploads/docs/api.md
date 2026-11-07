---
title: API
description: Every export of kitr/uploads, with its signature.
order: 2
---

# API

Every export of `kitr/uploads`, `kitr/uploads/react`, `kitr/uploads/server`, `kitr/uploads/provider`, read from the published type definitions. The [guide](/packages/uploads) shows them in use.

## kitr/uploads

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
}
```

The shape of `config/uploads.ts`: the default rules plus where files are stored and served.

## kitr/uploads/react

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

## kitr/uploads/server

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
}>(server: S, path?: string): S;
```

Mount `POST <path>` (receive) and `GET <path>/**` (serve) on a kitr server from `server/main.ts`.
The service is resolved per request, so this can run before the app has booted.

### servedFileHeaders

```ts
function servedFileHeaders(type: string, name?: string): Record<string, string>;
```

Headers for serving a stored file: never sniffed, sandboxed, and inline only when that is safe.

### useUploads

```ts
function useUploads(app: KitrApp): Uploads;
```

Returns the `uploads` service the provider bound, for a controller or job: `useUploads(ctx.app)`.

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
  /** Mount `POST <path>` (receive) and `GET <path>/:key` (serve) on a kitr server. */
  mount<S extends {
    h3: any;
    app?: KitrApp;
  }>(server: S, path?: string): S;
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

## kitr/uploads/provider

### uploadsProvider

```ts
const uploadsProvider: import("@kitr/core").KitrProvider;
```

Binds `uploads` on the server from `config/uploads.ts`. The server module is loaded at boot so
the browser bundle of this provider never resolves node:fs.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
