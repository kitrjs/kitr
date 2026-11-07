import {
  createDefineConfig,
  type DevtoolsEntry,
  type DevtoolsHub,
  type DevtoolsPanel,
} from '@kitr/core'

export type { DevtoolsAction, DevtoolsEntry, DevtoolsHub, DevtoolsPanel } from '@kitr/core'
export { getDevtools } from '@kitr/core'

export interface DevtoolsConfig {
  /** Default: development on the client. Set false to disable without removing the package. */
  enabled?: boolean
  /** Where the trigger button sits. Default `bottom-left`. */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  /** Keyboard shortcut, as `key` with ctrl/cmd+shift. Default `k`. */
  shortcutKey?: string
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

export const defineConfig = createDefineConfig<DevtoolsConfig>()

/** Identity helper with types, for `devtools()` methods on providers. */
export function definePanel(panel: DevtoolsPanel): DevtoolsPanel {
  return panel
}

/** The event bus and panel registry behind the overlay. One per app, development only. */
export function createDevtoolsHub(options: { maxEntries?: number } = {}): DevtoolsHub {
  const max = options.maxEntries ?? 500
  const panels: DevtoolsPanel[] = []
  const entries: DevtoolsEntry[] = []
  const listeners = new Set<() => void>()
  let id = 0
  let scheduled = false
  const notify = () => {
    // Coalesce bursts (a dozen log lines in one tick) into one re-render.
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      for (const l of listeners) l()
    })
  }
  return {
    panels,
    register(panel) {
      const i = panels.findIndex((p) => p.id === panel.id)
      if (i >= 0) panels.splice(i, 1, panel)
      else panels.push(panel)
      notify()
      return () => {
        const j = panels.indexOf(panel)
        if (j >= 0) panels.splice(j, 1)
        notify()
      }
    },
    log(channel, label, data, level = 'info') {
      entries.push({ id: ++id, channel, time: Date.now(), level, label, data })
      const perChannel = entries.filter((e) => e.channel === channel)
      if (perChannel.length > max) {
        const drop = perChannel[0]!
        entries.splice(entries.indexOf(drop), 1)
      }
      notify()
    },
    entries: (channel) => (channel ? entries.filter((e) => e.channel === channel) : [...entries]),
    clear(channel) {
      if (!channel) entries.length = 0
      else
        for (let i = entries.length - 1; i >= 0; i--)
          if (entries[i]!.channel === channel) entries.splice(i, 1)
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
