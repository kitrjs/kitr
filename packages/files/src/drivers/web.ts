import { acceptFor, extensions, fromFile, mimeFor, toBlob } from '../helpers'
import type { FileFilter, FilesDriver } from '../index'

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
