---
title: API
description: Every export of kitr/files, with its signature.
order: 2
---

# API

Every export of `kitr/files`, `kitr/files/react`, `kitr/files/provider`, `kitr/files/driver`, `kitr/files/drivers/web`, `kitr/files/drivers/electron`, `kitr/files/drivers/tauri`, `kitr/files/drivers/capacitor`, read from the published type definitions. The [guide](/packages/files) shows them in use.

## kitr/files

### acceptFor

```ts
function acceptFor(filters?: FileFilter[]): string;
```

The `accept` string an `<input type="file">` needs for a set of filters.

### createFiles

```ts
function createFiles(config?: FilesConfig, app?: KitrApp): Files;
```

Build the `files` service: the given driver, else the platform's, else `selectDriver()` for the
runtime (the web driver in a browser, memory on the server, `E_DRIVER_UNAVAILABLE` in a native
shell unless `fallbackToWeb` is set).

### createMemoryFilesDriver

```ts
function createMemoryFilesDriver(queue?: PickedFile[]): FilesDriver & {
  queue: PickedFile[];
  saved: Array<{
    name: string;
    data: FileData;
  }>;
};
```

A driver for tests and the server: `open` returns what you queue, `save` records what was written.

### createWebFilesDriver

```ts
function createWebFilesDriver(): FilesDriver;
```

File System Access API when available, `<input type="file">` and a download link otherwise.

### fromFile

```ts
function fromFile(file: File, path?: string): PickedFile;
```

Wrap a browser `File` (or any Blob with a name) as a `PickedFile`.

### mimeFor

```ts
function mimeFor(name: string, fallback?: string): string;
```

The MIME type for a file name's extension, e.g. `invoice.pdf` → `application/pdf`. Unknown → `fallback`.

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The files driver for a runtime: the File System Access API (or `<input type="file">`) on `web`,
a memory driver on the server, and each native shell's own dialogs. A shell with no driver yet
throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless `fallbackToWeb` is set.

### toBlob

```ts
function toBlob(data: FileData, type: string): Blob;
```

Turn any `FileData` into a Blob of the given type. A Blob passes through unchanged.

### useFiles

```ts
function useFiles(app: KitrApp): Files;
```

The `files` service from an app's container, for code outside React.

### defineConfig

```ts
const defineConfig: <const C extends FilesConfig>(config: C) => C;
```

Type-checks `config/files.ts`. Returns the object unchanged.

### FileFilter

```ts
/** A named group of extensions shown in a dialog's file-type menu, e.g. `Invoices (*.pdf)`. */
interface FileFilter {
  /** Shown in the dialog, e.g. `Images`. */
  name: string;
  /** Extensions without the dot, e.g. `['png', 'jpg']`. */
  extensions: string[];
}
```

A named group of extensions shown in a dialog's file-type menu, e.g. `Invoices (*.pdf)`.

### Files

```ts
interface Files {
  /** The driver in use. */
  readonly driver: FilesDriver;
  /** Show the open dialog. Resolves to [] when cancelled. */
  open(options?: OpenOptions): Promise<PickedFile[]>;
  /** Open exactly one file, or null when cancelled. */
  pick(options?: Omit<OpenOptions, 'multiple'>): Promise<PickedFile | null>;
  /** Save data where the person chooses. Resolves to the chosen name or path, or null when cancelled. */
  save(data: FileData, options: SaveOptions): Promise<string | null>;
  /** Open a path with the system's default app. Resolves without doing anything when the driver can't. */
  reveal(path: string): Promise<void>;
}
```

The `files` service bound in the container: open, pick and save through the active driver.

### FilesConfig

```ts
interface FilesConfig {
  /** Use this driver instead of the platform's or the web one. Mostly for tests. */
  driver?: FilesDriver;
  /** Filters added to every dialog, e.g. the app's own document type. */
  filters?: FileFilter[];
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no files driver, use the web driver inside
   * the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean;
}
```

Options for `config/files.ts`.

### FilesDriver

```ts
interface FilesDriver {
  /** Shown in devtools and on `files.driver.name`, e.g. `web` or `memory`. */
  name: string;
  /** Show the open dialog. Resolves to [] when cancelled. */
  open(options: OpenOptions): Promise<PickedFile[]>;
  /** Write data where the person chooses. Resolves to the chosen path/name, or null when cancelled. */
  save(data: FileData, options: SaveOptions): Promise<string | null>;
  /** Open a file with the system's default app, when the platform allows it. */
  reveal?(path: string): Promise<void>;
}
```

The dialogs behind the `files` service. A platform or a test supplies one; the web driver is the fallback.

### OpenOptions

```ts
interface OpenOptions {
  /** File types to offer. Merged with the `filters` in `config/files.ts`. */
  filters?: FileFilter[];
  /** Let the person choose more than one file. Default false. */
  multiple?: boolean;
  /** Dialog title where the platform shows one. */
  title?: string;
}
```

Options for `open()` and `pick()`.

### PickedFile

```ts
interface PickedFile {
  /** File name with extension, without a directory. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type, or `''` when the platform doesn't know it. */
  type: string;
  /** Absolute path on platforms that expose one (desktop, mobile). */
  path?: string;
  /** Read the content as UTF-8 text. */
  text(): Promise<string>;
  /** Read the content as bytes. */
  bytes(): Promise<Uint8Array>;
  /** Read the content as a Blob, e.g. to upload it. */
  blob(): Promise<Blob>;
}
```

A file the person chose, the same shape on every platform. Its content is read on demand.

### SaveOptions

```ts
interface SaveOptions {
  /** Suggested file name, with extension. */
  name: string;
  /** File types to offer. Merged with the `filters` in `config/files.ts`. */
  filters?: FileFilter[];
  /** Dialog title where the platform shows one. */
  title?: string;
  /** MIME type for the download fallback. Default from the extension or `application/octet-stream`. */
  type?: string;
}
```

Options for `save()`: the suggested name and, for the download fallback, the MIME type.

### Driver

```ts
type Driver = FilesDriver;
```

What a files driver is: `FilesDriver`, whichever runtime supplies it.

### DriverOptions

```ts
type DriverOptions = SelectDriverOptions;
```

Options of `selectDriver()`.

### FileData

```ts
type FileData = string | Blob | Uint8Array | ArrayBuffer;
```

What `save()` accepts: text, a Blob or File, or raw bytes.

## kitr/files/react

### useDropFiles

```ts
function useDropFiles(onFiles: (files: PickedFile[]) => void): {
  over: boolean;
  onDragOver: (e: {
    preventDefault(): void;
  }) => void;
  onDragLeave: () => void;
  onDrop: (e: {
    preventDefault(): void;
    dataTransfer: DataTransfer | null;
  }) => Promise<void>;
};
```

Drag-and-drop handlers that hand dropped files over as `PickedFile`s.

### useFileDialogs

```ts
function useFileDialogs(): {
  busy: boolean;
  open: (options?: OpenOptions | undefined) => Promise<PickedFile[]>;
  pick: (options?: Omit<OpenOptions, "multiple"> | undefined) => Promise<PickedFile | null>;
  save: (data: FileData, options: SaveOptions) => Promise<string | null>;
};
```

`const { open, save, busy } = useFileDialogs()`: the service with a busy flag while a dialog is up.

### useFiles

```ts
function useFiles(): Files;
```

The `files` service from the app in context. Use `useFileDialogs()` when you want a busy flag.

## kitr/files/provider

### filesProvider

```ts
const filesProvider: import("@kitr/core").KitrProvider;
```

Binds `files` to the native dialog driver a platform package registered (`files` capability),
or the web driver. Nothing runs on the server beyond a no-op binding.

## kitr/files/driver

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The files driver for a runtime: the File System Access API (or `<input type="file">`) on `web`,
a memory driver on the server, and each native shell's own dialogs. A shell with no driver yet
throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless `fallbackToWeb` is set.

### Driver

```ts
type Driver = FilesDriver;
```

What a files driver is: `FilesDriver`, whichever runtime supplies it.

### DriverOptions

```ts
type DriverOptions = SelectDriverOptions;
```

Options of `selectDriver()`.

## kitr/files/drivers/web

### createWebFilesDriver

```ts
function createWebFilesDriver(): FilesDriver;
```

File System Access API when available, `<input type="file">` and a download link otherwise.

## kitr/files/drivers/electron

### createElectronDriver

```ts
function createElectronDriver(_options?: DriverOptions): Driver;
```

The files driver for the Electron shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/files` and `electron` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/files.ts`
to opt in to the WebView behaviour.

## kitr/files/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(_options?: DriverOptions): Driver;
```

The files driver for the Tauri shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/files` and `tauri` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/files.ts`
to opt in to the WebView behaviour.

## kitr/files/drivers/capacitor

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

The files driver for the Capacitor shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/files` and `capacitor` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/files.ts`
to opt in to the WebView behaviour.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
