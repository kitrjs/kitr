import type { KitrApp } from './app'
import type { KitrNode, MaybePromise } from './types'

/**
 * The devtools contract. Core only defines the shape; `@kitr/devtools` renders it.
 * Any provider can contribute by adding a `devtools(app)` method that returns panels.
 * Nothing here runs in production: the hub is only bound in development on the client.
 */
export interface DevtoolsAction {
  id: string
  label: string
  run: (app: KitrApp) => MaybePromise<void>
}

export interface DevtoolsPanel {
  id: string
  label: string
  /** Text or count shown next to the tab label. Re-read on every render. */
  badge?: (app: KitrApp) => string | number | null | undefined
  /** The panel body. Return a React node; devtools re-renders it when the hub changes. */
  render: (app: KitrApp) => KitrNode
  /** Buttons in the panel header and entries in the command palette. */
  actions?: DevtoolsAction[]
}

export interface DevtoolsEntry {
  id: number
  channel: string
  time: number
  level: 'debug' | 'info' | 'warn' | 'error'
  label: string
  data?: unknown
}

export interface DevtoolsHub {
  readonly panels: DevtoolsPanel[]
  /** Add a panel at runtime (providers normally use the `devtools()` method instead). */
  register(panel: DevtoolsPanel): () => void
  /** Record an event (an HTTP request, an analytics call, a log line) under a channel. */
  log(channel: string, label: string, data?: unknown, level?: DevtoolsEntry['level']): void
  entries(channel?: string): DevtoolsEntry[]
  clear(channel?: string): void
  /** Notified on new entries, panel changes and `notify()`; the overlay re-renders. */
  subscribe(listener: () => void): () => void
  /** Tell the overlay that something it shows (session, cache) changed. */
  notify(): void
}

/** The hub when devtools are active (development, client, `@kitr/devtools` added), else null. */
export function getDevtools(app: KitrApp): DevtoolsHub | null {
  return app.container.has('devtools') ? app.container.use('devtools') : null
}
