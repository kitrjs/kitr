import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import { extensions, mimeFor, toBlob } from '../helpers'
import type { FileData, FileFilter, PickedFile } from '../index'

/**
 * Import one Capacitor plugin on first use, so web bundles never load it. A plugin that is not
 * installed turns into `E_DRIVER_UNAVAILABLE` naming the package to install.
 */
async function plugin<T>(pkg: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch {
    throw driverUnavailable('capacitor', 'files', `install ${pkg}`)
  }
}

const filesystem = () => plugin('@capacitor/filesystem', () => import('@capacitor/filesystem'))
const sharePlugin = () =>
  plugin('@capacitor/share', () => import('@capacitor/share')).then((m) => m.Share)
const pickerPlugin = () =>
  plugin(
    '@capawesome/capacitor-file-picker',
    () => import('@capawesome/capacitor-file-picker'),
  ).then((m) => m.FilePicker)

// Chunked: spreading a large Uint8Array into fromCharCode overflows the call stack.
function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

const isCancel = (error: unknown) => error instanceof Error && /cancel/i.test(error.message)

/** The MIME types the picker should offer for a set of filters, or `[]` (any file) when one is unknown. */
function mimeTypes(filters: FileFilter[] = []): string[] {
  const exts = filters.flatMap((f) => extensions(f))
  if (!exts.length) return []
  const types = exts.map((e) => mimeFor(`x.${e}`, ''))
  return types.includes('') ? [] : [...new Set(types)]
}

/** Which of the app's directories a path is under. `data` is private and backed up; `cache` may be cleared by the OS. */
export type CapacitorDirectory = 'data' | 'documents' | 'cache' | 'library' | 'external'

/** A file or folder in the app's storage, as `list()` and `stat()` report it. */
export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  /** Size in bytes. */
  size: number
  /** Last change, in milliseconds since the epoch. */
  modifiedAt: number
  /** A `file://` URI the system and other apps understand. */
  uri: string
}

/** Read, write, delete, list and stat under the app's own directories (no dialogs). */
export interface CapacitorFileStore {
  /** Read a file as UTF-8 text. */
  readText(path: string): Promise<string>
  /** Read a file as bytes. */
  readBytes(path: string): Promise<Uint8Array>
  /** Write (and replace) a file, creating parent folders. Resolves to its URI. */
  write(path: string, data: FileData): Promise<string>
  /** Delete a file. */
  remove(path: string): Promise<void>
  /** The entries of a folder (the directory's root by default). */
  list(path?: string): Promise<FileEntry[]>
  /** Size, type and modification time of a file or folder. */
  stat(path: string): Promise<FileEntry>
  /** Whether the path exists. */
  exists(path: string): Promise<boolean>
}

/**
 * `@capacitor/filesystem` under one of the app's directories (`data` by default, which no other
 * app can see). Paths are relative to that directory. For files the person chooses, use the
 * `files` service's dialogs instead.
 */
export function capacitorFileStore(
  options: { directory?: CapacitorDirectory } = {},
): CapacitorFileStore {
  const where = async () => {
    const { Filesystem, Directory, Encoding } = await filesystem()
    const directory = {
      data: Directory.Data,
      documents: Directory.Documents,
      cache: Directory.Cache,
      library: Directory.Library,
      external: Directory.External,
    }[options.directory ?? 'data']
    return { Filesystem, Encoding, directory }
  }
  const entry = (e: {
    name?: string
    type: 'file' | 'directory'
    size: number
    mtime: number
    uri: string
  }): FileEntry => ({
    name: e.name ?? e.uri.split('/').pop() ?? '',
    type: e.type,
    size: e.size,
    modifiedAt: e.mtime,
    uri: e.uri,
  })
  return {
    async readText(path) {
      const { Filesystem, Encoding, directory } = await where()
      const { data } = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 })
      return typeof data === 'string' ? data : await data.text()
    },
    async readBytes(path) {
      const { Filesystem, directory } = await where()
      const { data } = await Filesystem.readFile({ path, directory })
      return typeof data === 'string' ? fromBase64(data) : new Uint8Array(await data.arrayBuffer())
    },
    async write(path, data) {
      const { Filesystem, directory } = await where()
      const bytes = new Uint8Array(await toBlob(data, mimeFor(path)).arrayBuffer())
      const { uri } = await Filesystem.writeFile({
        path,
        directory,
        data: toBase64(bytes),
        recursive: true,
      })
      return uri
    },
    async remove(path) {
      const { Filesystem, directory } = await where()
      await Filesystem.deleteFile({ path, directory })
    },
    async list(path = '') {
      const { Filesystem, directory } = await where()
      const { files } = await Filesystem.readdir({ path, directory })
      return files.map(entry)
    },
    async stat(path) {
      const { Filesystem, directory } = await where()
      return entry(await Filesystem.stat({ path, directory }))
    },
    async exists(path) {
      const { Filesystem, directory } = await where()
      try {
        await Filesystem.stat({ path, directory })
        return true
      } catch {
        return false
      }
    },
  }
}

/** A picked file whose content is read from its URI with `@capacitor/filesystem` when asked for. */
function pickedFile(file: {
  name: string
  size: number
  mimeType: string
  path?: string
  data?: string
}): PickedFile {
  const bytes = async (): Promise<Uint8Array> => {
    if (file.data !== undefined) return fromBase64(file.data)
    if (!file.path) throw new Error(`kitr/files: ${file.name} has no path to read from`)
    const { Filesystem } = await filesystem()
    const { data } = await Filesystem.readFile({ path: file.path })
    return typeof data === 'string' ? fromBase64(data) : new Uint8Array(await data.arrayBuffer())
  }
  return {
    name: file.name,
    size: file.size,
    type: file.mimeType,
    path: file.path,
    text: async () => new TextDecoder().decode(await bytes()),
    bytes,
    blob: async () => new Blob([(await bytes()) as BlobPart], { type: file.mimeType }),
  }
}

/**
 * Files driver for the Capacitor shell. `open()` shows the system document picker
 * (`@capawesome/capacitor-file-picker`). Mobile has no "save as" dialog, so `save()` writes the
 * file to the app's cache (`@capacitor/filesystem`) and opens the share sheet
 * (`@capacitor/share`), where the person picks Save to Files, Drive, Mail and so on; it resolves
 * to the file's URI, or null when the sheet is dismissed. `reveal()` hands a path to the share sheet.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  return {
    name: 'capacitor',
    async open(options) {
      const FilePicker = await pickerPlugin()
      try {
        const { files } = await FilePicker.pickFiles({
          types: mimeTypes(options.filters),
          limit: options.multiple ? 0 : 1,
        })
        return files.map(pickedFile)
      } catch (error) {
        if (isCancel(error)) return []
        throw error
      }
    },
    async save(data, options) {
      const { Filesystem, Directory } = await filesystem()
      const type = options.type ?? mimeFor(options.name)
      const bytes = new Uint8Array(await toBlob(data, type).arrayBuffer())
      const { uri } = await Filesystem.writeFile({
        path: options.name,
        directory: Directory.Cache,
        data: toBase64(bytes),
        recursive: true,
      })
      const Share = await sharePlugin()
      try {
        await Share.share({ title: options.name, url: uri, dialogTitle: options.title })
        return uri
      } catch (error) {
        if (isCancel(error)) return null
        throw error
      }
    },
    async reveal(path) {
      await (await sharePlugin()).share({ url: path })
    },
  }
}
