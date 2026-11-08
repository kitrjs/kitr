import type { FileData, FilesDriver, PickedFile } from '../index'

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
