import { createContext, useContext, useEffect } from 'react'

/**
 * Who answers the back button. Handlers register last-in-first-out: an open menu or dialog
 * registers one while it shows, so Android back (and a desktop window's back key) closes it
 * before the stack pops a page. A handler returns `true` when it consumed the press.
 */
export type BackHandler = () => boolean | undefined

/** The handlers that answer the back button, newest first. */
export interface BackRegistry {
  push(handler: BackHandler): () => void
  /** Run the handlers newest first; true when one consumed the press. */
  run(): boolean
  readonly size: number
}

/** A new registry; `<StackOutlet>` makes one per stack and `useBackHandler()` registers into the nearest. */
export function createBackRegistry(): BackRegistry {
  const handlers: BackHandler[] = []
  return {
    push(handler) {
      handlers.push(handler)
      return () => {
        const i = handlers.lastIndexOf(handler)
        if (i >= 0) handlers.splice(i, 1)
      }
    },
    run() {
      for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i]!() === true) return true
      return false
    },
    get size() {
      return handlers.length
    },
  }
}

/** One registry for the app: `<StackOutlet>` reads it, and so does `useBackHandler()` outside any stack. */
export const defaultBackRegistry = createBackRegistry()

export const BackRegistryContext = createContext<BackRegistry>(defaultBackRegistry)

/**
 * Answer the back button while this component is mounted: a dialog closes itself, a form asks
 * before leaving. Return `true` to stop the stack from popping. The newest handler runs first.
 */
export function useBackHandler(handler: BackHandler, enabled = true) {
  const registry = useContext(BackRegistryContext)
  useEffect(() => {
    if (!enabled) return
    return registry.push(handler)
  }, [registry, handler, enabled])
}
