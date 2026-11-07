import { useApp } from '@kitr/react'
import { useCallback, useState } from 'react'
import type { FileData, Files, OpenOptions, PickedFile, SaveOptions } from './index'

export function useFiles(): Files {
  return useApp().container.use('files')
}

/** `const { open, save, busy } = useFileDialogs()`: the service with a busy flag while a dialog is up. */
export function useFileDialogs() {
  const files = useFiles()
  const [busy, setBusy] = useState(false)
  const wrap = useCallback(<A extends unknown[], R>(fn: (...args: A) => Promise<R>) => {
    return async (...args: A) => {
      setBusy(true)
      try {
        return await fn(...args)
      } finally {
        setBusy(false)
      }
    }
  }, [])
  return {
    busy,
    open: wrap((options?: OpenOptions) => files.open(options)),
    pick: wrap((options?: Omit<OpenOptions, 'multiple'>) => files.pick(options)),
    save: wrap((data: FileData, options: SaveOptions) => files.save(data, options)),
  }
}

/** Drag-and-drop handlers that hand dropped files over as `PickedFile`s. */
export function useDropFiles(onFiles: (files: PickedFile[]) => void) {
  const [over, setOver] = useState(false)
  return {
    over,
    onDragOver: (e: { preventDefault(): void }) => {
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: async (e: { preventDefault(): void; dataTransfer: DataTransfer | null }) => {
      e.preventDefault()
      setOver(false)
      const { fromFile } = await import('./index')
      onFiles([...(e.dataTransfer?.files ?? [])].map((f) => fromFile(f)))
    },
  }
}
