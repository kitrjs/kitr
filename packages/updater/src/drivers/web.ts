import type { UpdateInfo, UpdaterDriver } from '../index'

/**
 * Service-worker driver: an update is "available" when a new worker is waiting; applying tells it
 * to skip waiting and reloads. `version` is the running build; the update is reported as `<version>+`.
 */
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
