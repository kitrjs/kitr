import { useApp } from '@kitr/react'
import { useCallback, useEffect, useState } from 'react'
import type { Native, Position, SharePayload } from './index'

/** The app's `native` service in a component. */
export function useNative(): Native {
  return useApp().container.use('native')
}

/** `const { copy, copied } = useClipboard()`: copy text and show a confirmation for `timeout` ms. */
export function useClipboard(timeout = 1500) {
  const { clipboard } = useNative()
  const [copied, setCopied] = useState(false)
  const copy = useCallback(
    async (text: string) => {
      await clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    },
    [clipboard, timeout],
  )
  return { copy, copied, supported: clipboard.supported }
}

/** `const { share, canShare } = useShare()`: the share sheet, with a flag to hide the button where there is none. */
export function useShare() {
  const { share } = useNative()
  return {
    supported: share.supported,
    canShare: (payload: SharePayload) => share.supported && share.canShare(payload),
    share: (payload: SharePayload) => share.share(payload),
  }
}

/**
 * `{ position, error, supported }`: the current position, read on mount and updated while mounted
 * when `watch` is true. `error` holds a failure of the first read.
 */
export function useGeolocation(options: { watch?: boolean; highAccuracy?: boolean } = {}) {
  const { geolocation } = useNative()
  const [position, setPosition] = useState<Position | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    if (!geolocation.supported) return
    let live = true
    geolocation
      .current({ highAccuracy: options.highAccuracy })
      .then((p) => live && setPosition(p))
      .catch((e) => live && setError(e instanceof Error ? e : new Error(String(e))))
    const off = options.watch
      ? geolocation.watch((p) => live && setPosition(p), { highAccuracy: options.highAccuracy })
      : () => {}
    return () => {
      live = false
      off()
    }
  }, [geolocation, options.watch, options.highAccuracy])
  return { position, error, supported: geolocation.supported }
}
