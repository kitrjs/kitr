import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import { extensions, mimeFor, toBlob } from '../helpers'
import type { FileFilter, PickedFile } from '../index'

/** The preload bridge `exposeIpc()` from `@kitr/desktop/preload` puts on `window`. */
interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

/** A file or folder as the main process reports it. */
interface Entry {
  path: string
  name: string
  size: number
  isDirectory: boolean
}

/** The Electron driver, with the folder dialog and directory calls only a desktop shell has. */
export interface ElectronFilesDriver extends Driver {
  /** Show the folder dialog. Resolves to the chosen folder, or null when cancelled. */
  openDirectory(options?: { title?: string }): Promise<PickedFolder | null>
}

/** A folder the person chose: list it, then read the files in it. */
export interface PickedFolder {
  /** Absolute path of the folder. */
  path: string
  /** Its name. */
  name: string
  /** The folder's entries; each file reads and writes like a picked one. Folders come back with `size` 0. */
  list(): Promise<PickedFile[]>
}

/** The dialog filters Electron accepts: cleaned extensions, no empty groups. */
function dialogFilters(filters: FileFilter[] = []) {
  return filters
    .map((f) => ({ name: f.name, extensions: extensions(f) }))
    .filter((f) => f.extensions.length)
}

/**
 * The files driver for the Electron shell. Dialogs are Electron's `dialog.showOpenDialog` and
 * `showSaveDialog`, run in the main process; the chosen files are read and written there with
 * `fs/promises`. The window can only reach paths the person picked in a dialog this session
 * (and anything inside a picked folder): main refuses every other path, so a compromised page
 * cannot read your disk. Served over the `kitr:files:*` channels of `handleKitrIpc()`.
 *
 * Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).
 */
export function createElectronDriver(_options: DriverOptions = {}): ElectronFilesDriver {
  const bridge = (globalThis as { kitrIpc?: Bridge }).kitrIpc
  if (!bridge)
    throw driverUnavailable(
      'electron',
      'files',
      'the kitrIpc preload bridge is missing: call exposeIpc() in the preload script',
    )
  const read = async (path: string) =>
    Uint8Array.from((await bridge.invoke('kitr:files:read', path)) as ArrayLike<number>)
  const picked = (entry: Entry): PickedFile => {
    const type = mimeFor(entry.name, '')
    return {
      name: entry.name,
      size: entry.size,
      type,
      path: entry.path,
      text: async () => new TextDecoder().decode(await read(entry.path)),
      bytes: () => read(entry.path),
      blob: async () => new Blob([(await read(entry.path)) as BlobPart], { type }),
    }
  }
  return {
    name: 'electron',
    async open(options) {
      const entries = (await bridge.invoke('kitr:files:open', {
        title: options.title,
        filters: dialogFilters(options.filters),
        multiple: options.multiple ?? false,
      })) as Entry[]
      return entries.map(picked)
    },
    async save(data, options) {
      const path = (await bridge.invoke('kitr:files:choose-save', {
        name: options.name,
        title: options.title,
        filters: dialogFilters(options.filters),
      })) as string | null
      if (!path) return null
      const blob = toBlob(data, options.type ?? mimeFor(options.name))
      await bridge.invoke('kitr:files:write', path, new Uint8Array(await blob.arrayBuffer()))
      return path
    },
    async reveal(path) {
      await bridge.invoke('kitr:files:reveal', path)
    },
    async openDirectory(options = {}) {
      const [dir] = (await bridge.invoke('kitr:files:open', {
        title: options.title,
        directory: true,
      })) as Entry[]
      if (!dir) return null
      return {
        path: dir.path,
        name: dir.name,
        list: async () =>
          ((await bridge.invoke('kitr:files:list', dir.path)) as Entry[]).map(picked),
      }
    },
  }
}
