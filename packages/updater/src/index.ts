import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

/**
 * One check/apply flow for new versions. On the web the driver watches the service worker
 * (`updatefound` → `waiting`) and applies by telling it to skip waiting and reloading. Desktop
 * packages register the Tauri or Electron updater; mobile ones report the store version or a
 * live-update bundle.
 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'

export interface UpdateInfo {
  version: string
  notes?: string
  date?: string
  /** Bytes, when the driver knows. */
  size?: number
}

export interface UpdaterDriver {
  name: string
  /** Look for a newer version. Resolves to the update or null when current. */
  check(): Promise<UpdateInfo | null>
  /** Download (when needed) and install. Usually restarts or reloads the app. */
  apply(onProgress?: (fraction: number) => void): Promise<void>
  /** Called by drivers that learn about updates on their own (service worker, background download). */
  onAvailable?(listener: (info: UpdateInfo) => void): () => void
  /** Current app version, when known. */
  currentVersion?(): Promise<string>
}

export interface UpdaterConfig {
  driver?: UpdaterDriver
  /** Re-check every N milliseconds while the app is open. Default: none (check at boot only). */
  interval?: number
  /** Check as soon as the app boots. Default true. */
  checkOnBoot?: boolean
  /** Apply as soon as an update is ready, without asking. Default false. */
  auto?: boolean
}

export interface UpdaterState {
  status: UpdateStatus
  update: UpdateInfo | null
  progress: number
  error: Error | null
  currentVersion: string | null
}

export interface Updater {
  readonly driver: UpdaterDriver
  readonly state: UpdaterState
  check(): Promise<UpdateInfo | null>
  apply(): Promise<void>
  /** Hide the prompt until the next update. */
  dismiss(): void
  subscribe(listener: () => void): () => void
  /** Stop the interval and listeners. */
  stop(): void
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    updater: UpdaterConfig
  }
  interface ContainerBindings {
    updater: Updater
  }
  interface DriverTypes {
    updater: UpdaterDriver
  }
}

export const defineConfig = createDefineConfig<UpdaterConfig>()

/** Service-worker driver: an update is "available" when a new worker is waiting; applying reloads. */
export function createServiceWorkerUpdaterDriver(
  options: { version?: string } = {},
): UpdaterDriver {
  const sw = () => (typeof navigator === 'undefined' ? undefined : navigator.serviceWorker)
  let waiting: ServiceWorker | null = null
  const listeners = new Set<(info: UpdateInfo) => void>()
  const announce = () => {
    const info = { version: options.version ? `${options.version}+` : 'new' }
    for (const l of listeners) l(info)
  }
  const watch = (reg: ServiceWorkerRegistration) => {
    if (reg.waiting) {
      waiting = reg.waiting
      announce()
    }
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && sw()?.controller) {
          waiting = installing
          announce()
        }
      })
    })
  }
  let watched = false
  const ensure = async () => {
    const api = sw()
    if (!api || watched) return
    watched = true
    const reg = await api.getRegistration()
    if (reg) watch(reg)
  }
  return {
    name: 'service-worker',
    async check() {
      const api = sw()
      if (!api) return null
      await ensure()
      const reg = await api.getRegistration()
      if (!reg) return null
      await reg.update()
      return reg.waiting ? { version: options.version ? `${options.version}+` : 'new' } : null
    },
    async apply() {
      const api = sw()
      if (!api) return
      const reg = await api.getRegistration()
      const target = waiting ?? reg?.waiting
      if (!target) return
      await new Promise<void>((resolve) => {
        api.addEventListener('controllerchange', () => resolve(), { once: true })
        target.postMessage({ type: 'SKIP_WAITING' })
        setTimeout(resolve, 2000)
      })
      location.reload()
    },
    onAvailable(listener) {
      listeners.add(listener)
      void ensure()
      return () => {
        listeners.delete(listener)
      }
    },
    currentVersion: async () => options.version ?? '0.0.0',
  }
}

/** For tests and the server: set `next` to simulate an available update. */
export function createMemoryUpdaterDriver(
  options: { version?: string; next?: UpdateInfo | null } = {},
) {
  const listeners = new Set<(info: UpdateInfo) => void>()
  const driver = {
    name: 'memory',
    next: options.next ?? null,
    applied: [] as UpdateInfo[],
    check: async () => driver.next,
    apply: async (onProgress?: (f: number) => void) => {
      onProgress?.(0.5)
      onProgress?.(1)
      if (driver.next) driver.applied.push(driver.next)
      driver.next = null
    },
    onAvailable(listener: (info: UpdateInfo) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    announce(info: UpdateInfo) {
      driver.next = info
      for (const l of listeners) l(info)
    },
    currentVersion: async () => options.version ?? '1.0.0',
  }
  return driver satisfies UpdaterDriver
}

export function createUpdater(config: UpdaterConfig = {}, app?: KitrApp): Updater {
  const driver =
    config.driver ??
    app?.drivers.resolve('updater') ??
    (typeof window === 'undefined'
      ? createMemoryUpdaterDriver()
      : createServiceWorkerUpdaterDriver())
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('updater', label, data)
  const listeners = new Set<() => void>()
  let state: UpdaterState = {
    status: 'idle',
    update: null,
    progress: 0,
    error: null,
    currentVersion: null,
  }
  const set = (patch: Partial<UpdaterState>) => {
    state = { ...state, ...patch }
    for (const l of listeners) l()
  }
  let dismissed: string | null = null
  const stops: Array<() => void> = []

  const updater: Updater = {
    driver,
    get state() {
      return state
    },
    async check() {
      set({ status: 'checking', error: null })
      try {
        const update = await driver.check()
        if (update && update.version !== dismissed) {
          set({ status: 'available', update })
          log('available', update)
          if (config.auto) await updater.apply()
        } else set({ status: 'up-to-date', update: null })
        return update
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        log('check failed', error)
        return null
      }
    },
    async apply() {
      if (!state.update) return
      set({ status: 'downloading', progress: 0 })
      try {
        await driver.apply((fraction) => set({ progress: fraction }))
        set({ status: 'ready', progress: 1 })
        log('applied', state.update)
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        log('apply failed', error)
      }
    },
    dismiss() {
      dismissed = state.update?.version ?? null
      set({ status: 'up-to-date', update: null })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    stop() {
      for (const stop of stops.splice(0)) stop()
    },
  }

  driver.currentVersion?.().then((v) => set({ currentVersion: v }))
  if (driver.onAvailable)
    stops.push(
      driver.onAvailable((update) => {
        if (update.version === dismissed) return
        set({ status: 'available', update })
        log('available', update)
        if (config.auto) void updater.apply()
      }),
    )
  if (config.interval && config.interval > 0) {
    const timer = setInterval(() => void updater.check(), config.interval)
    stops.push(() => clearInterval(timer))
  }
  return updater
}

export function useUpdater(app: KitrApp): Updater {
  return app.container.use('updater')
}
