import { driverUnavailable, loadShellModule } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import { extensions, mimeFor, toBlob } from '../helpers'
import type { FileFilter, PickedFile } from '../index'

/** The parts of `@tauri-apps/plugin-dialog` the driver uses. */
interface DialogPlugin {
  open(options: {
    title?: string
    multiple?: boolean
    directory?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | string[] | null>
  save(options: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null>
}

/** The parts of `@tauri-apps/plugin-fs` the driver uses. */
interface FsPlugin {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  stat(path: string): Promise<{ size: number }>
}

/** The part of `@tauri-apps/plugin-opener` the driver uses. */
interface OpenerPlugin {
  openPath(path: string): Promise<void>
}

const missing = (pkg: string, detail: string) =>
  driverUnavailable(
    'tauri',
    'files',
    `${pkg} is not installed (run \`npm install ${pkg}\`, ${detail})`,
  )

function filtersOf(filters: FileFilter[] = []) {
  return filters
    .map((f) => ({ name: f.name, extensions: extensions(f) }))
    .filter((f) => f.extensions.length)
}

/** The last segment of a path in either separator style. */
const baseName = (path: string) => path.split(/[\\/]/).pop() || path

/**
 * The files driver for the Tauri shell, on `@tauri-apps/plugin-dialog` (the dialogs) and
 * `@tauri-apps/plugin-fs` (reading and writing what was chosen), with `@tauri-apps/plugin-opener`
 * for `reveal()`. The plugins are imported on first use and are optional peers; a missing one
 * makes the method that needs it reject with `E_DRIVER_UNAVAILABLE`. The dialog plugin adds each
 * chosen path to the fs scope for the session, so the window reaches only what the person picked
 * unless your capability file grants more.
 */
export function createTauriDriver(_options: DriverOptions = {}): Driver {
  const cache = new Map<string, Promise<unknown>>()
  const plugin = <T>(name: string, detail: string): Promise<T> => {
    let loaded = cache.get(name)
    if (!loaded) {
      loaded = loadShellModule<T>(name).catch(() => {
        cache.delete(name)
        throw missing(name, detail)
      })
      cache.set(name, loaded)
    }
    return loaded as Promise<T>
  }
  const dialog = () =>
    plugin<DialogPlugin>(
      '@tauri-apps/plugin-dialog',
      'add tauri-plugin-dialog in src-tauri and allow dialog:default',
    )
  const fs = () =>
    plugin<FsPlugin>(
      '@tauri-apps/plugin-fs',
      'add tauri-plugin-fs in src-tauri and allow fs:default',
    )
  const picked = (path: string, size: number, fsp: FsPlugin): PickedFile => {
    const name = baseName(path)
    const type = mimeFor(name, '')
    return {
      name,
      size,
      type,
      path,
      text: async () => new TextDecoder().decode(await fsp.readFile(path)),
      bytes: () => fsp.readFile(path),
      blob: async () => new Blob([(await fsp.readFile(path)) as BlobPart], { type }),
    }
  }
  return {
    name: 'tauri',
    async open(options) {
      const [d, fsp] = await Promise.all([dialog(), fs()])
      const chosen = await d.open({
        title: options.title,
        multiple: options.multiple ?? false,
        filters: filtersOf(options.filters),
      })
      if (!chosen) return []
      const paths = Array.isArray(chosen) ? chosen : [chosen]
      return Promise.all(paths.map(async (path) => picked(path, (await fsp.stat(path)).size, fsp)))
    },
    async save(data, options) {
      const [d, fsp] = await Promise.all([dialog(), fs()])
      const path = await d.save({
        title: options.title,
        defaultPath: options.name,
        filters: filtersOf(options.filters),
      })
      if (!path) return null
      const blob = toBlob(data, options.type ?? mimeFor(options.name))
      await fsp.writeFile(path, new Uint8Array(await blob.arrayBuffer()))
      return path
    },
    async reveal(path) {
      const opener = await plugin<OpenerPlugin>(
        '@tauri-apps/plugin-opener',
        'add tauri-plugin-opener in src-tauri and allow opener:allow-open-path',
      )
      await opener.openPath(path)
    },
  }
}
