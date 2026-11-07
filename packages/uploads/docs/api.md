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

### defineConfig

```ts
const defineConfig: <const C extends UploadsConfig>(config: C) => C;
```

### UploadedFile

```ts
interface UploadedFile {
  id: string;
  name: string;
  size: number;
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
  headers?: Record<string, string>;
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percent: number;
  }) => void;
  signal?: AbortSignal;
  /** Sent with credentials (cookies). Default true. */
  credentials?: boolean;
}
```

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

### UploadsConfig

```ts
interface UploadsConfig extends UploadRules {
  /** Where files go. Default: `storage/uploads` on disk (`createDiskUploadsDriver`). */
  driver?: unknown;
  /** Public URL prefix the driver answers under, e.g. `/uploads`. */
  publicPath?: string;
}
```

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

### UseUploadState

```ts
interface UseUploadState {
  files: UploadedFile[];
  progress: number;
  uploading: boolean;
  error: Error | null;
}
```

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

### createUploads

```ts
function createUploads(config?: UploadsConfig): Uploads;
```

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

### StoredFile

```ts
interface StoredFile {
  key: string;
  name: string;
  size: number;
  type: string;
}
```

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
  read(key: string): Promise<{
    data: Uint8Array;
    type: string;
  } | undefined>;
  remove(key: string): Promise<void>;
  /** Mount `POST <path>` (receive) and `GET <path>/:key` (serve) on a kitr server. */
  mount<S extends {
    h3: any;
    app?: KitrApp;
  }>(server: S, path?: string): S;
  readonly driver: UploadsDriver;
}
```

### UploadsDriver

```ts
interface UploadsDriver {
  name: string;
  put(key: string, data: Uint8Array, meta: {
    type: string;
    name: string;
  }): Promise<void>;
  get(key: string): Promise<{
    data: Uint8Array;
    type: string;
  } | undefined>;
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
