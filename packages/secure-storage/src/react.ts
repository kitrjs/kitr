import { useApp } from '@kitr/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SecureItem, SecureStorage } from './index'

/** The app's `secureStorage` service in a component. */
export function useSecureStorage(): SecureStorage {
  return useApp().container.use('secureStorage')
}

/**
 * Read and write one secret: `const [session, setSession, { loading }] = useSecureItem(sessionItem)`.
 * The value is `undefined` until the vault answers (and always on the server).
 */
export function useSecureItem<T>(
  define: (storage: SecureStorage) => SecureItem<T>,
): [T | undefined, (value: T | undefined) => Promise<void>, { loading: boolean; secure: boolean }] {
  const storage = useSecureStorage()
  const item = useMemo(() => define(storage), [define, storage])
  const [value, setValue] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    item.get().then((v) => {
      if (!live) return
      setValue(v)
      setLoading(false)
    })
    const off = item.subscribe((v) => live && setValue(v))
    return () => {
      live = false
      off()
    }
  }, [item])
  const write = useCallback(
    async (next: T | undefined) => {
      if (next === undefined) await item.remove()
      else await item.set(next)
    },
    [item],
  )
  return [value, write, { loading, secure: storage.secure }]
}
