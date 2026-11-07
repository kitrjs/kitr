import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

/**
 * Open, save and pick files with one API. Platform packages register a `FilesDriver` that shows
 * native dialogs; the web driver uses the File System Access API where it exists and falls back
 * to `<input type="file">` and a download link elsewhere.
 */

export interface FileFilter {
  /** Shown in the dialog, e.g. `Images`. */
  name: string
  /** Extensions without the dot, e.g. `['png', 'jpg']`. */
  extensions: string[]
}

export interface OpenOptions {
  filters?: FileFilter[]
  multiple?: boolean
  /** Dialog title where the platform shows one. */
  title?: string
}

export interface SaveOptions {
  /** Suggested file name, with extension. */
  name: string
  filters?: FileFilter[]
  title?: string
  /** MIME type for the download fallback. Default from the extension or `application/octet-stream`. */
  type?: string
}

export interface PickedFile {
  name: string
  size: number
  type: string
  /** Absolute path on platforms that expose one (desktop, mobile). */
  path?: string
  text(): Promise<string>
  bytes(): Promise<Uint8Array>
  blob(): Promise<Blob>
}

export type FileData = string | Blob | Uint8Array | ArrayBuffer

export interface FilesDriver {
  name: string
  /** Show the open dialog. Resolves to [] when cancelled. */
  open(options: OpenOptions): Promise<PickedFile[]>
  /** Write data where the person chooses. Resolves to the chosen path/name, or null when cancelled. */
  save(data: FileData, options: SaveOptions): Promise<string | null>
  /** Open a file with the system's default app, when the platform allows it. */
  reveal?(path: string): Promise<void>
}

export interface FilesConfig {
  driver?: FilesDriver
  /** Filters added to every dialog, e.g. the app's own document type. */
  filters?: FileFilter[]
}

export interface Files {
  readonly driver: FilesDriver
  open(options?: OpenOptions): Promise<PickedFile[]>
  /** Open exactly one file, or null when cancelled. */
  pick(options?: Omit<OpenOptions, 'multiple'>): Promise<PickedFile | null>
  save(data: FileData, options: SaveOptions): Promise<string | null>
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

export const defineConfig = createDefineConfig<FilesConfig>()

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

export function mimeFor(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? fallback
}

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

/** The `accept` string an `<input type="file">` needs for a set of filters. */
export function acceptFor(filters: FileFilter[] = []): string {
  return filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',')
}

interface FsHandleWindow {
  showOpenFilePicker?(options: unknown): Promise<Array<{ getFile(): Promise<File> }>>
  showSaveFilePicker?(options: unknown): Promise<{
    createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>
    name: string
  }>
}

function pickerTypes(filters: FileFilter[] = []) {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
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

export function useFiles(app: KitrApp): Files {
  return app.container.use('files')
}
