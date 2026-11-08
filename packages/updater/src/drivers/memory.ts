import type { UpdateInfo, UpdaterDriver } from '../index'

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
