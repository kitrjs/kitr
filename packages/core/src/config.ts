/**
 * Packages declare their config by augmenting this interface, and apps write
 * one typed file per package in `config/<name>.ts` using the package's `defineConfig`.
 *
 *   declare module '@kitr/core' { interface ConfigRegistry { query: QueryConfig } }
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface ConfigRegistry {}

export type ConfigKey = keyof ConfigRegistry | (string & {})
export type ConfigOf<K> = K extends keyof ConfigRegistry ? ConfigRegistry[K] : unknown

export class ConfigStore {
  private values = new Map<string, unknown>()

  set<K extends ConfigKey>(key: K, value: ConfigOf<K>): this {
    this.values.set(key, value)
    return this
  }

  has(key: ConfigKey): boolean {
    return this.values.has(key)
  }

  /** Returns the config for a package, or the fallback. Throws without either. */
  get<K extends ConfigKey>(key: K, fallback?: ConfigOf<K>): ConfigOf<K> {
    if (this.values.has(key)) return this.values.get(key) as ConfigOf<K>
    if (fallback !== undefined) return fallback
    throw new Error(
      `[kitr] Missing config "${key}". Create config/${key}.ts or pass it to createApp().`,
    )
  }

  entries(): [string, unknown][] {
    return [...this.values.entries()]
  }
}

/** Identity helper so each package can export a typed `defineConfig`. */
export function createDefineConfig<T>() {
  return <const C extends T>(config: C): C => config
}
