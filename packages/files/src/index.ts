import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import { runtimeOf } from '@kitr/platform'
import { selectDriver } from './driver'

export { type Driver, type DriverOptions, selectDriver } from './driver'
export {
  type CapacitorDirectory,
  type CapacitorFileStore,
  capacitorFileStore,
  createCapacitorDriver as createCapacitorFilesDriver,
  type FileEntry,
} from './drivers/capacitor'
export {
  createElectronDriver as createElectronFilesDriver,
  type ElectronFilesDriver,
  type PickedFolder,
} from './drivers/electron'
export { createMemoryFilesDriver } from './drivers/memory'
export { createTauriDriver as createTauriFilesDriver } from './drivers/tauri'
export { createWebFilesDriver } from './drivers/web'
export { acceptFor, fromFile, mimeFor, toBlob } from './helpers'

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
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no files driver, use the web driver inside
   * the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean
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

/**
 * Build the `files` service: the given driver, else the platform's, else `selectDriver()` for the
 * runtime (the web driver in a browser, memory on the server, `E_DRIVER_UNAVAILABLE` in a native
 * shell unless `fallbackToWeb` is set).
 */
export function createFiles(config: FilesConfig = {}, app?: KitrApp): Files {
  const driver =
    config.driver ??
    app?.drivers.resolve('files') ??
    selectDriver(runtimeOf(app), { fallbackToWeb: config.fallbackToWeb })
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
