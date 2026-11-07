/**
 * Capabilities and drivers. A capability package (storage, files, notifications...) defines one
 * API and asks the registry for the driver that fits where the app is running. Platform
 * providers register their native drivers in `register()`, before any capability boots.
 *
 *   declare module '@kitr/core' { interface DriverTypes { storage: StorageDriver } }
 *   app.drivers.register('storage', preferencesDriver, { platform: 'mobile' })
 *   const driver = app.drivers.resolve('storage') ?? webDriver
 */

// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface DriverTypes {}

export type DriverKey = keyof DriverTypes | (string & {})
export type DriverOf<K> = K extends keyof DriverTypes ? DriverTypes[K] : unknown

export interface DriverRegistration<T = unknown> {
  driver: T
  /** Which platform supplied it, for devtools and `kitr doctor`. */
  platform?: string
  /** Higher wins. Platform drivers default to 10, web fallbacks to 0. */
  priority: number
}

export class DriverRegistry {
  private entries = new Map<string, DriverRegistration[]>()

  register<K extends DriverKey>(
    capability: K,
    driver: DriverOf<K>,
    options: { platform?: string; priority?: number } = {},
  ): this {
    const list = this.entries.get(capability) ?? []
    list.push({ driver, platform: options.platform, priority: options.priority ?? 10 })
    list.sort((a, b) => b.priority - a.priority)
    this.entries.set(capability, list)
    return this
  }

  /** The best driver for a capability, or undefined when no platform supplied one. */
  resolve<K extends DriverKey>(capability: K): DriverOf<K> | undefined {
    return this.entries.get(capability)?.[0]?.driver as DriverOf<K> | undefined
  }

  /** Who supplied the active driver, for devtools. */
  describe(capability: DriverKey): DriverRegistration | undefined {
    return this.entries.get(capability)?.[0]
  }

  has(capability: DriverKey): boolean {
    return (this.entries.get(capability)?.length ?? 0) > 0
  }

  capabilities(): string[] {
    return [...this.entries.keys()]
  }
}
