import type { KitrApp } from './app'
import type { KitrNode, MaybePromise } from './types'

/**
 * The devtools contract. Core only defines the shape; `@kitr/devtools` renders it.
 * Any provider can contribute by adding a `devtools(app)` method that returns panels.
 * The hub is bound on the client only when devtools is enabled (development by default).
 */
export interface DevtoolsAction {
  /** Unique id, used as the React key and in the command palette. */
  id: string
  /** Button text and command palette label. */
  label: string
  /** Runs when the button or palette entry is chosen. */
  run: (app: KitrApp) => MaybePromise<void>
}

/** A tab in the devtools window, contributed by a provider's `devtools(app)` method or `hub.register()`. */
export interface DevtoolsPanel {
  /** Unique id; registering another panel with the same id replaces this one. */
  id: string
  /** Tab label. */
  label: string
  /** Text or count shown next to the tab label. Re-read on every render. */
  badge?: (app: KitrApp) => string | number | null | undefined
  /** The panel body. Return a React node; devtools re-renders it when the hub changes. */
  render: (app: KitrApp) => KitrNode
  /** Buttons in the panel header and entries in the command palette. */
  actions?: DevtoolsAction[]
}

/** One line in the devtools log, recorded with `hub.log()`. */
export interface DevtoolsEntry {
  /** Increasing id, unique for the page's lifetime. */
  id: number
  /** The channel it was logged under, such as `http`, `analytics` or `logs`. */
  channel: string
  /** `Date.now()` when it was logged. */
  time: number
  /** Severity; the log view colours and filters by it. */
  level: 'debug' | 'info' | 'warn' | 'error'
  /** One-line summary shown in the list. */
  label: string
  /** Anything extra, shown expanded under the line. */
  data?: unknown
}

/** The devtools service bound as `devtools` on the client when devtools is enabled: panels plus a shared event log. */
export interface DevtoolsHub {
  /** Every registered panel, in tab order. */
  readonly panels: DevtoolsPanel[]
  /** Add a panel at runtime (providers normally use the `devtools()` method instead). */
  register(panel: DevtoolsPanel): () => void
  /** Record an event (an HTTP request, an analytics call, a log line) under a channel. */
  log(channel: string, label: string, data?: unknown, level?: DevtoolsEntry['level']): void
  /** Logged entries, oldest first; pass a channel to filter. */
  entries(channel?: string): DevtoolsEntry[]
  /** Empty the log, or one channel of it. */
  clear(channel?: string): void
  /** Notified on new entries, panel changes and `notify()`; the overlay re-renders. */
  subscribe(listener: () => void): () => void
  /** Tell the overlay that something it shows (session, cache) changed. */
  notify(): void
}

/** The hub when devtools are active (`@kitr/devtools` added and enabled, on the client), else null. */
export function getDevtools(app: KitrApp): DevtoolsHub | null {
  return app.container.has('devtools') ? app.container.use('devtools') : null
}
