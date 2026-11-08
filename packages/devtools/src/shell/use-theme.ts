import { useEffect, useState } from 'react'

export type Scheme = 'light' | 'dark'

function attr(): Scheme | null {
  const v = typeof document === 'undefined' ? undefined : document.documentElement.dataset.theme
  return v === 'light' || v === 'dark' ? v : null
}

function systemDark(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** `light`/`dark` as configured; `auto` follows `html[data-theme]` when set, else the system. */
export function useScheme(setting: 'auto' | 'light' | 'dark' = 'auto'): Scheme {
  const [fromAttr, setFromAttr] = useState(attr)
  const [dark, setDark] = useState(systemDark)
  useEffect(() => {
    if (setting !== 'auto') return
    setFromAttr(attr())
    const observer = new MutationObserver(() => setFromAttr(attr()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    const mql = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
    const onChange = () => setDark(!!mql?.matches)
    onChange()
    mql?.addEventListener?.('change', onChange)
    return () => {
      observer.disconnect()
      mql?.removeEventListener?.('change', onChange)
    }
  }, [setting])
  if (setting !== 'auto') return setting
  return fromAttr ?? (dark ? 'dark' : 'light')
}
