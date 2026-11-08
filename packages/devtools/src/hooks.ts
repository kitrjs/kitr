import type { DevtoolsHub, KitrApp } from '@kitr/core'
import { useSyncExternalStore } from 'react'

/** The `devtools` hub, re-rendering the caller on every change (entry, panel, `notify()`). */
export function useHub(app: KitrApp): DevtoolsHub {
  const hub = app.container.use('devtools')
  useSyncExternalStore(
    hub.subscribe,
    () => hub.version,
    () => 0,
  )
  return hub
}
