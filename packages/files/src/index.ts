import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

/**
 * Open, save and pick files with one API. Platform packages register a `FilesDriver` that shows
 * native dialogs; the web driver uses the File System Access API where it exists and falls back
 * to `<input type="file">` and a download link elsewhere.
 */

/** A named group of extensions shown in a dialog's file-type menu, e.g. `Invoices (*.pdf)`. */
export interface FileFilter {
  /** Shown in the dialog, e.g. `Images`. */
  name: string
  /** Extensions without the dot, e.g. `['png', 'jpg']`. */
  extensions: string[]
}

/** Options for `open()` and `pick()`. */
export interface OpenOptions {
  /** File types to offer. Merged with the `filters` in `config/files.ts`. */
  filters?: FileFilter[]
  /** Let the person choose more than one file. Default false. */
  multiple?: boolean
  /** Dialog title where the platform shows one. */
  title?: string
}

/** Options for `save()`: the suggested name and, for the download fallback, the MIME type. */
export interface SaveOptions {
  /** Suggested file name, with extension. */
  name: string
  /** File types to offer. Merged with the `filters` in `config/files.ts`. */
  filters?: FileFilter[]
  /** Dialog title where the platform shows one. */
  title?: string
  /** MIME type for the download fallback. Default from the extension or `application/octet-stream`. */
  type?: string
}

/** A file the person chose, the same shape on every platform. Its content is read on demand. */
export interface PickedFile {
  /** File name with extension, without a directory. */
  name: string
  /** Size in bytes. */
  size: number
  /** MIME type, or `''` when the platform doesn't know it. */
  type: string
  /** Absolute path on platforms that expose one (desktop, mobile). */
  path?: string
  /** Read the content as UTF-8 text. */
  text(): Promise<string>
  /** Read the content as bytes. */
  bytes(): Promise<Uint8Array>
  /** Read the content as a Blob, e.g. to upload it. */
  blob(): Promise<Blob>
}

/** What `save()` accepts: text, a Blob or File, or raw bytes. */
export type FileData = string | Blob | Uint8Array | ArrayBuffer

/** The dialogs behind the `files` service. A platform or a test supplies one; the web driver is the fallback. */
export interface FilesDriver {
  /** Shown in devtools and on `files.driver.name`, e.g. `web` or `memory`. */
  name: string
  /** Show the open dialog. Resolves to [] when cancelled. */
  open(options: OpenOptions): Promise<PickedFile[]>
  /** Write data where the person chooses. Resolves to the chosen path/name, or null when cancelled. */
  save(data: FileData, options: SaveOptions): Promise<string | null>
  /** Open a file with the system's default app, when the platform allows it. */
  reveal?(path: string): Promise<void>
}

/** Options for `config/files.ts`. */
export interface FilesConfig {
  /** Use this driver instead of the platform's or the web one. Mostly for tests. */
  driver?: FilesDriver
  /** Filters added to every dialog, e.g. the app's own document type. */
  filters?: FileFilter[]
}

/** The `files` service bound in the container: open, pick and save through the active driver. */
export interface Files {
  /** The driver in use. */
  readonly driver: FilesDriver
  /** Show the open dialog. Resolves to [] when cancelled. */
  open(options?: OpenOptions): Promise<PickedFile[]>
  /** Open exactly one file, or null when cancelled. */
  pick(options?: Omit<OpenOptions, 'multiple'>): Promise<PickedFile | null>
  /** Save data where the person chooses. Resolves to the chosen name or path, or null when cancelled. */
  save(data: FileData, options: SaveOptions): Promise<string | null>
  /** Open a path with the system's default app. Resolves without doing anything when the driver can't. */
  reveal(path: string): Promise<void>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    files: FilesConfig
  }
  interface ContainerBindings {
    files: Files
  }
  interface DriverTypes {
    files: FilesDriver
  }
}

/** Type-checks `config/files.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<FilesConfig>()

// kitr-allow-module-state: lookup table built once at import, never mutated
const MIME: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
}

/** The MIME type for a file name's extension, e.g. `invoice.pdf` → `application/pdf`. Unknown → `fallback`. */
export function mimeFor(name: string, fallback = 'application/octet-stream'): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return MIME[ext] ?? fallback
}

/** Turn any `FileData` into a Blob of the given type. A Blob passes through unchanged. */
export function toBlob(data: FileData, type: string): Blob {
  if (data instanceof Blob) return data
  if (typeof data === 'string') return new Blob([data], { type })
  return new Blob([data as BlobPart], { type })
}

/** Wrap a browser `File` (or any Blob with a name) as a `PickedFile`. */
export function fromFile(file: File, path?: string): PickedFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    path,
    text: () => file.text(),
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
    blob: async () => file,
  }
}

/** `'.PNG'`, `'png'` and `' png '` are the same extension; `'*'` and empty ones mean "any". */
function extensions(filter: FileFilter): string[] {
  return [
    ...new Set(
      filter.extensions
        .map((e) => e.trim().replace(/^\.+/, '').toLowerCase())
        .filter((e) => e && e !== '*'),
    ),
  ]
}

/** The `accept` string an `<input type="file">` needs for a set of filters. */
export function acceptFor(filters: FileFilter[] = []): string {
  return [...new Set(filters.flatMap((f) => extensions(f).map((e) => `.${e}`)))].join(',')
}

interface FsHandleWindow {
  showOpenFilePicker?(options: unknown): Promise<Array<{ getFile(): Promise<File> }>>
  showSaveFilePicker?(options: unknown): Promise<{
    createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>
    name: string
  }>
}

/** Picker types; a filter with no usable extension is left out (the picker throws on it). */
function pickerTypes(filters: FileFilter[] = []) {
  return filters
    .map((f) => ({ description: f.name, exts: extensions(f) }))
    .filter((f) => f.exts.length)
    .map((f) => ({
      description: f.description,
      accept: { 'application/octet-stream': f.exts.map((e) => `.${e}`) },
    }))
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

/** File System Access API when available, `<input type="file">` and a download link otherwise. */
export function createWebFilesDriver(): FilesDriver {
  return {
    name: 'web',
    async open(options) {
      const w = (typeof window === 'undefined' ? {} : window) as FsHandleWindow
      if (w.showOpenFilePicker) {
        try {
          const handles = await w.showOpenFilePicker({
            multiple: options.multiple ?? false,
            types: pickerTypes(options.filters),
            excludeAcceptAllOption: false,
          })
          return Promise.all(handles.map(async (h) => fromFile(await h.getFile())))
        } catch (error) {
          if (isAbort(error)) return []
          throw error
        }
      }
      if (typeof document === 'undefined') return []
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = options.multiple ?? false
        input.accept = acceptFor(options.filters)
        input.style.display = 'none'
        input.onchange = () => {
          resolve([...(input.files ?? [])].map((f) => fromFile(f)))
          input.remove()
        }
        input.oncancel = () => {
          resolve([])
          input.remove()
        }
        document.body.appendChild(input)
        input.click()
      })
    },
    async save(data, options) {
      const type = options.type ?? mimeFor(options.name)
      const blob = toBlob(data, type)
      const w = (typeof window === 'undefined' ? {} : window) as FsHandleWindow
      if (w.showSaveFilePicker) {
        try {
          const handle = await w.showSaveFilePicker({
            suggestedName: options.name,
            types: pickerTypes(options.filters),
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return handle.name
        } catch (error) {
          if (isAbort(error)) return null
          throw error
        }
      }
      if (typeof document === 'undefined') return null
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = options.name
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return options.name
    },
  }
}

/** A driver for tests and the server: `open` returns what you queue, `save` records what was written. */
export function createMemoryFilesDriver(queue: PickedFile[] = []): FilesDriver & {
  queue: PickedFile[]
  saved: Array<{ name: string; data: FileData }>
} {
  const saved: Array<{ name: string; data: FileData }> = []
  return {
    name: 'memory',
    queue,
    saved,
    open: async (options) => (options.multiple ? queue.splice(0) : queue.splice(0, 1)),
    save: async (data, options) => {
      saved.push({ name: options.name, data })
      return options.name
    },
  }
}

/** Build the `files` service: the given driver, else the platform's, else the web driver (memory on the server). */
export function createFiles(config: FilesConfig = {}, app?: KitrApp): Files {
  const driver =
    config.driver ??
    app?.drivers.resolve('files') ??
    (typeof window === 'undefined' ? createMemoryFilesDriver() : createWebFilesDriver())
  const log = (label: string, data?: unknown) => app && getDevtools(app)?.log('files', label, data)
  const withDefaults = <T extends { filters?: FileFilter[] }>(options: T): T => ({
    ...options,
    filters: [...(options.filters ?? []), ...(config.filters ?? [])],
  })
  return {
    driver,
    async open(options = {}) {
      const files = await driver.open(withDefaults(options))
      log(
        'open',
        files.map((f) => f.name),
      )
      return files
    },
    async pick(options = {}) {
      const [file] = await driver.open(withDefaults({ ...options, multiple: false }))
      return file ?? null
    },
    async save(data, options) {
      const where = await driver.save(data, withDefaults(options))
      log('save', where)
      return where
    },
    reveal: (path) => driver.reveal?.(path) ?? Promise.resolve(),
  }
}

/** The `files` service from an app's container, for code outside React. */
export function useFiles(app: KitrApp): Files {
  return app.container.use('files')
}
