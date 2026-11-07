import { useCallback, useRef, useState } from 'react'
import { checkFile, type UploadedFile, type UploadOptions, type UploadRules, upload } from './index'

export interface UseUploadState {
  files: UploadedFile[]
  progress: number
  uploading: boolean
  error: Error | null
}

/**
 * Upload with progress from a component:
 *
 *   const { send, progress, uploading, error } = useUpload({ accept: ['image/*'] })
 *   <input type="file" onChange={(e) => send(e.target.files)} />
 */
export function useUpload(options: UploadOptions & UploadRules = {}) {
  const [state, setState] = useState<UseUploadState>({
    files: [],
    progress: 0,
    uploading: false,
    error: null,
  })
  const controller = useRef<AbortController | null>(null)
  const send = useCallback(
    async (input: FileList | File[] | File | null) => {
      const list = !input ? [] : input instanceof File ? [input] : Array.from(input)
      if (!list.length) return []
      for (const file of list) {
        const problem = checkFile(file, options)
        if (problem) {
          const error = new Error(problem)
          setState((s) => ({ ...s, error }))
          throw error
        }
      }
      controller.current?.abort()
      controller.current = new AbortController()
      setState({ files: [], progress: 0, uploading: true, error: null })
      try {
        const files = await upload(list, {
          ...options,
          signal: controller.current.signal,
          onProgress: (p) => {
            setState((s) => ({ ...s, progress: p.percent }))
            options.onProgress?.(p)
          },
        })
        setState({ files, progress: 100, uploading: false, error: null })
        return files
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e))
        setState((s) => ({ ...s, uploading: false, error }))
        throw error
      }
    },
    [options],
  )
  const cancel = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(
    () => setState({ files: [], progress: 0, uploading: false, error: null }),
    [],
  )
  return { ...state, send, cancel, reset }
}
