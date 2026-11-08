import type { KitrApp } from './app'
import type { KitrNode, MaybePromise } from './types'

/**
 * The devtools contract. Core only defines the shape; `@kitr/devtools` renders it.
 * Any provider can contribute by adding a `devtools(app)` method that returns panels.
 * The hub is bound on the client only when devtools is enabled (development by default).
 */
/** Severity of a devtools entry; the log view colours and filters by it. */
export type DevtoolsLevel = 'debug' | 'info' | 'warn' | 'error'

/** Colour intent for a badge or status chip: `ok` green, `warn` amber, `error` red, `muted` grey, `info` blue. */
export type DevtoolsTone = 'ok' | 'warn' | 'error' | 'muted' | 'info'

/** An entry in a panel's ⋯ menu and the command palette: a label, an optional hint and a `run` function. */
export interface DevtoolsAction {
  /** Unique id, used as the React key and in the command palette. */
  id: string
  /** Button text and command palette label. */
  label: string
  /** Short secondary text shown next to the label in menus and the command palette. */
  hint?: string
  /** An icon for the button and palette entry. Typed `unknown` so core does not depend on an icon library; `@kitr/devtools` narrows it. */
  icon?: unknown
  /** Destructive: shown in the error colour in menus and the palette. */
  danger?: boolean
  /** Return false to hide the action for now. Re-read on every render. */
  when?: (app: KitrApp) => boolean
  /** Runs when the button or palette entry is chosen. A returned string is logged as the result. */
  run: (app: KitrApp) => MaybePromise<void | string>
}

/** A tab in the devtools window, contributed by a provider's `devtools(app)` method or `hub.register()`. */
export interface DevtoolsPanel {
  /** Unique id; registering another panel with the same id replaces this one. */
  id: string
  /** Tab label. */
  label: string
  /** The tab icon. Typed `unknown` so core does not depend on React or an icon library; `@kitr/devtools` accepts a hugeicons element or any React node. */
  icon?: unknown
  /** Where the tab sits: `app`, `data`, `platform`, then `custom` (the default), each in registration order. */
  group?: 'app' | 'data' | 'platform' | 'custom'
  /** Text or count shown next to the tab label, optionally with a tone. Re-read on every render. */
  badge?: (
    app: KitrApp,
  ) => string | number | null | undefined | { value: string | number; tone?: DevtoolsTone }
  /** The panel body. Return a React node; devtools re-renders it when the hub changes. */
  render: (app: KitrApp) => KitrNode
  /** Buttons in the panel header and entries in the command palette. */
  actions?: DevtoolsAction[]
}

/** One line in the devtools log, recorded with `hub.log()` or `hub.mark()`. */
export interface DevtoolsEntry {
  /** Increasing id, unique for the page's lifetime. */
  id: number
  /** The channel it was logged under, such as `http`, `analytics` or `logs`. */
  channel: string
  /** `Date.now()` when it was logged; for a collapsed burst, when the last repeat arrived. */
  time: number
  /** Severity; the log view colours and filters by it. */
  level: DevtoolsLevel
  /** One-line summary shown in the list. */
  label: string
  /** Anything extra, shown expanded under the line. */
  data?: unknown
  /** `mark` for a divider added with `hub.mark()`; absent for ordinary entries. */
  kind?: 'mark'
  /** How many identical entries arrived in a burst and were collapsed into this one. Default 1. */
  count?: number
}

/** The devtools service bound as `devtools` on the client when devtools is enabled: panels plus a shared event log. */
export interface DevtoolsHub {
  /** Every registered panel, in tab order (group, then registration order). */
  readonly panels: DevtoolsPanel[]
  /** Bumps on every change (entry, panel, `notify()`); what a store hook reads to know when to re-render. */
  readonly version: number
  /** Add a panel at runtime (providers normally use the `devtools()` method instead). */
  register(panel: DevtoolsPanel): () => void
  /** Record an event (an HTTP request, an analytics call, a log line) under a channel. */
  log(channel: string, label: string, data?: unknown, level?: DevtoolsLevel): void
  /** Add a divider to the log, such as "navigated /orders". Recorded as an `info` entry on the `devtools` channel. */
  mark(label: string): void
  /** Logged entries, oldest first; pass a channel to filter. Treat the result as read-only: without a channel it is a cached view shared until the next write. */
  entries(channel?: string): DevtoolsEntry[]
  /** Every channel logged to so far, in first-seen order. */
  channels(): string[]
  /** Entries currently kept per level, cheap enough to read on every render for badges. */
  counts(): Record<DevtoolsLevel, number>
  /** Empty the log, or one channel of it. */
  clear(channel?: string): void
  /** Notified (without arguments) on new entries, panel changes and `notify()`; the overlay re-renders. */
  subscribe(listener: () => void): () => void
  /** Tell the overlay that something it shows (session, cache) changed. */
  notify(): void
}

/** The hub when devtools are active (`@kitr/devtools` added and enabled, on the client), else null. */
export function getDevtools(app: KitrApp): DevtoolsHub | null {
  return app.container.has('devtools') ? app.container.use('devtools') : null
}

/**
 * The parts of `@kitr/devtools/ui`, as a provider's `devtools(app, ui)` receives them. Empty here;
 * `@kitr/devtools` fills it in, so `const { Badge } = ui` is typed wherever its types are loaded.
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled by module augmentation in @kitr/devtools
export interface DevtoolsUi {}
