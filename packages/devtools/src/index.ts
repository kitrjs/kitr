import {
  createDefineConfig,
  type DevtoolsEntry,
  type DevtoolsHub,
  type DevtoolsLevel,
  type DevtoolsPanel,
} from '@kitr/core'

export type {
  DevtoolsAction,
  DevtoolsEntry,
  DevtoolsHub,
  DevtoolsLevel,
  DevtoolsPanel,
  DevtoolsTone,
} from '@kitr/core'
export { getDevtools } from '@kitr/core'

/** Options for `config/devtools.ts`: whether the overlay is on, how it is opened, where it sits and how much it keeps. */
export interface DevtoolsConfig {
  /**
   * Show the overlay. Default: in development only. Set `true` to ship it in production too,
   * or `false` to turn it off without removing the package.
   */
  enabled?: boolean
  /**
   * The trigger button. `auto` shows it; `hover` shows it only
   * while the pointer is near its corner; `hidden` removes it (use the shortcut, gesture or URL flag).
   * Default `auto`.
   */
  trigger?: 'auto' | 'hover' | 'hidden'
  /** Where the trigger button starts; it can be dragged afterwards. Default `bottom-left`. */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  /** Which edge the window docks to on desktop. Default `bottom`. */
  dock?: 'bottom' | 'right'
  /** Colour scheme. `auto` follows `data-theme` on `<html>` when set, else the system. Default `auto`. */
  theme?: 'auto' | 'light' | 'dark'
  /**
   * Keyboard shortcut that toggles the overlay. A single string is the key with Ctrl/Cmd+Shift
   * (`'k'`). An array is the full combination, where `'Meta'` means Ctrl or Cmd
   * (`['Meta', 'Shift', 'K']`). Default `'k'`.
   */
  shortcut?: string | string[]
  /** Open with a three-finger long press on touch screens. Default true. */
  touchGesture?: boolean
  /** Query parameter that opens the overlay even when the trigger is hidden, or `false` to disable. Default `'kitr-devtools'`. */
  urlFlag?: string | false
  /** Entries kept per channel. Default 500. */
  maxEntries?: number
  /** Open on first load. Default false. */
  openByDefault?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    devtools: DevtoolsConfig
  }
}

/** Types the default export of `config/devtools.ts`. */
export const defineConfig = createDefineConfig<DevtoolsConfig>()

/** Returns the panel unchanged, typed as a `DevtoolsPanel`. Use it in the module a provider's `devtools()` method imports. */
export function definePanel(panel: DevtoolsPanel): DevtoolsPanel {
  return panel
}

const GROUP_ORDER = { app: 0, data: 1, platform: 2, custom: 3 } as const

/** Entries logged within this many ms of an identical previous one are folded into it. */
const BURST_MS = 50

/** Deep equality for log payloads, which are JSON-like; anything unserialisable counts as different. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === undefined && b === undefined) return true
  if (a === undefined || b === undefined) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** One channel's entries. `head` marks the first live slot so dropping the oldest never shifts the array on every write. */
interface Ring {
  items: DevtoolsEntry[]
  head: number
}

/**
 * The event bus and panel registry behind the overlay. The provider binds one per app in development;
 * create your own in tests to assert on what code logs. Keeps `maxEntries` (default 500) per channel
 * and folds bursts of identical entries (same channel, level, label and data within 50ms) into one with a `count`.
 */
export function createDevtoolsHub(options: { maxEntries?: number } = {}): DevtoolsHub {
  const max = Math.max(1, options.maxEntries ?? 500)
  const panels: DevtoolsPanel[] = []
  const order = new Map<string, number>()
  const rings = new Map<string, Ring>()
  const totals: Record<DevtoolsLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 }
  const listeners = new Set<() => void>()
  let id = 0
  let seq = 0
  let version = 0
  let merged: DevtoolsEntry[] | null = null
  let scheduled = false

  const flush = () => {
    scheduled = false
    for (const l of [...listeners]) l()
  }
  const notify = () => {
    version++
    // Coalesce bursts (a query cache storm, a dozen log lines) into one re-render per frame.
    if (scheduled) return
    scheduled = true
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush)
    else queueMicrotask(flush)
  }
  const sortPanels = () =>
    panels.sort(
      (a, b) =>
        GROUP_ORDER[a.group ?? 'custom'] - GROUP_ORDER[b.group ?? 'custom'] ||
        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    )
  const live = (r: Ring) => (r.head === 0 ? r.items : r.items.slice(r.head))
  const push = (
    channel: string,
    label: string,
    data: unknown,
    level: DevtoolsLevel,
    kind?: 'mark',
  ) => {
    let ring = rings.get(channel)
    if (!ring) {
      ring = { items: [], head: 0 }
      rings.set(channel, ring)
    }
    const prev = ring.items[ring.items.length - 1]
    const now = Date.now()
    if (
      !kind &&
      prev &&
      ring.items.length > ring.head &&
      !prev.kind &&
      prev.label === label &&
      prev.level === level &&
      now - prev.time <= BURST_MS &&
      sameData(prev.data, data)
    ) {
      prev.count = (prev.count ?? 1) + 1
      prev.time = now
    } else {
      const entry: DevtoolsEntry = { id: ++id, channel, time: now, level, label, data }
      if (kind) entry.kind = kind
      ring.items.push(entry)
      totals[level]++
      if (ring.items.length - ring.head > max) {
        totals[ring.items[ring.head]!.level]--
        ring.head++
        // Compact once the dead prefix outgrows the live window, so cost stays amortised O(1).
        if (ring.head > max) {
          ring.items.splice(0, ring.head)
          ring.head = 0
        }
      }
    }
    merged = null
    notify()
  }

  return {
    panels,
    get version() {
      return version
    },
    register(panel) {
      if (!order.has(panel.id)) order.set(panel.id, seq++)
      const i = panels.findIndex((p) => p.id === panel.id)
      if (i >= 0) panels.splice(i, 1, panel)
      else panels.push(panel)
      sortPanels()
      notify()
      return () => {
        const j = panels.indexOf(panel)
        if (j >= 0) panels.splice(j, 1)
        notify()
      }
    },
    log: (channel, label, data, level = 'info') => push(channel, label, data, level),
    mark: (label) => push('devtools', label, undefined, 'info', 'mark'),
    entries(channel) {
      if (channel !== undefined) {
        const ring = rings.get(channel)
        return ring ? ring.items.slice(ring.head) : []
      }
      if (!merged) {
        merged = []
        for (const r of rings.values()) for (const e of live(r)) merged.push(e)
        merged.sort((a, b) => a.id - b.id)
      }
      return merged
    },
    channels: () => [...rings.keys()],
    counts: () => ({ ...totals }),
    clear(channel) {
      for (const [name, ring] of rings) {
        if (channel !== undefined && name !== channel) continue
        for (let i = ring.head; i < ring.items.length; i++) totals[ring.items[i]!.level]--
        ring.items = []
        ring.head = 0
      }
      merged = null
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify,
  }
}
