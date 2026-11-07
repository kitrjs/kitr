import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

export type FlagValue = boolean | string | number
export type FlagMap = Record<string, FlagValue>

export interface FlagDefinition<T extends FlagValue = FlagValue> {
  /** The value when no provider answers. */
  default: T
  description?: string
}

export type FlagDefinitions = Record<string, FlagDefinition>
export type FlagValues<D extends FlagDefinitions> = { [K in keyof D]: D[K]['default'] }

/** Who is asking: the user, their plan, the request. Providers target on it. */
export interface FlagContext {
  userId?: string
  [key: string]: unknown
}

/**
 * Where answers come from. Mirrors OpenFeature's provider shape, so an OpenFeature client is a
 * one-line adapter, but a plain object or `envFlagsProvider()` also work.
 */
export interface FlagsProvider {
  name: string
  init?(context: FlagContext): Promise<void> | void
  /** `undefined` means "no opinion": the next provider, then the default, answer. */
  resolve(key: string, context: FlagContext): Promise<FlagValue | undefined> | FlagValue | undefined
}

export interface FlagsConfig {
  /** The flags from `app/flags.ts`. */
  definitions?: FlagDefinitions
  /** First provider with an answer wins. */
  providers?: FlagsProvider[]
  /** Seconds a resolved snapshot stays fresh in the browser before `refresh()`. Default 300. */
  ttl?: number
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    flags: FlagsConfig
  }
  interface ContainerBindings {
    flags: Flags<any>
  }
}

export const defineConfig = createDefineConfig<FlagsConfig>()

/** Declare every flag once, in `app/flags.ts`, with its default and a sentence on what it gates. */
export function defineFlags<const D extends FlagDefinitions>(definitions: D): D {
  return definitions
}

export interface Flags<D extends FlagDefinitions = FlagDefinitions> {
  /** The current answer. Synchronous: works from a resolved snapshot (and the defaults before one). */
  value<K extends keyof D & string>(key: K): D[K]['default']
  isEnabled(key: keyof D & string): boolean
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void
  snapshot(): FlagValues<D>
  subscribe(listener: () => void): () => void
  readonly definitions: D
  readonly resolved: boolean
}

export function createFlags<D extends FlagDefinitions>(
  definitions: D,
  config: FlagsConfig = {},
  app?: KitrApp,
): Flags<D> {
  const providers = config.providers ?? []
  const defaults = Object.fromEntries(
    Object.entries(definitions).map(([k, d]) => [k, d.default]),
  ) as FlagValues<D>
  let values: FlagValues<D> = { ...defaults }
  let resolved = false
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const l of listeners) l()
    getDevtools(app ?? ({ container: { has: () => false } } as any))?.log(
      'flags',
      'resolved',
      values,
    )
  }
  const flags: Flags<D> = {
    definitions,
    get resolved() {
      return resolved
    },
    value: (key) => (key in values ? values[key] : defaults[key]) as never,
    isEnabled: (key) => flags.value(key) === true,
    async resolve(context = {}) {
      for (const p of providers) await p.init?.(context)
      const next = { ...defaults } as Record<string, FlagValue>
      await Promise.all(
        Object.keys(definitions).map(async (key) => {
          for (const p of providers) {
            const answer = await p.resolve(key, context)
            if (answer !== undefined) {
              next[key] = coerce(answer, definitions[key]!.default)
              return
            }
          }
        }),
      )
      values = next as FlagValues<D>
      resolved = true
      notify()
      return values
    },
    hydrate(partial) {
      values = { ...defaults, ...partial } as FlagValues<D>
      resolved = true
      notify()
    },
    snapshot: () => ({ ...values }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return flags
}

/** Providers answer with strings from env files; keep the declared type. */
function coerce(value: FlagValue, like: FlagValue): FlagValue {
  if (typeof like === 'boolean' && typeof value === 'string')
    return value === 'true' || value === '1' || value === 'on'
  if (typeof like === 'number' && typeof value === 'string') return Number(value)
  return value
}

/** A fixed map, or a function of the context: `{ newDashboard: true }` or `(ctx) => ...`. */
export function staticFlagsProvider(
  values: Partial<FlagMap> | ((context: FlagContext) => Partial<FlagMap>),
): FlagsProvider {
  return {
    name: 'static',
    resolve: (key, context) => (typeof values === 'function' ? values(context) : values)[key],
  }
}

/** `FLAG_NEW_DASHBOARD=true` answers `newDashboard`. */
export function envFlagsProvider(
  env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {},
  prefix = 'FLAG_',
): FlagsProvider {
  const envKey = (key: string) =>
    prefix +
    key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .toUpperCase()
  return { name: 'env', resolve: (key) => env[envKey(key)] }
}

/** Turn a flag on for a share of users, stable per user id. `percentageFlagsProvider({ beta: 10 })`. */
export function percentageFlagsProvider(shares: Record<string, number>, salt = ''): FlagsProvider {
  return {
    name: 'percentage',
    resolve(key, context) {
      const share = shares[key]
      if (share === undefined) return undefined
      if (!context.userId) return false
      return hash(`${salt}:${key}:${context.userId}`) % 100 < share
    },
  }
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  return (h >>> 0) % 100000
}

/**
 * An OpenFeature client (`@openfeature/web-sdk` or `server-sdk`) as a kitr provider; the typed
 * defaults in `app/flags.ts` pick which `get*Value` to call.
 */
export function openFeatureFlagsProvider(
  client: {
    getBooleanValue(key: string, def: boolean, ctx?: any): boolean | Promise<boolean>
    getStringValue(key: string, def: string, ctx?: any): string | Promise<string>
    getNumberValue(key: string, def: number, ctx?: any): number | Promise<number>
  },
  definitions: FlagDefinitions,
): FlagsProvider {
  return {
    name: 'openfeature',
    async resolve(key, context) {
      const def = definitions[key]?.default
      const ctx = { targetingKey: context.userId, ...context }
      if (typeof def === 'boolean') return client.getBooleanValue(key, def, ctx)
      if (typeof def === 'number') return client.getNumberValue(key, def, ctx)
      if (typeof def === 'string') return client.getStringValue(key, def, ctx)
      return undefined
    },
  }
}

export const FLAGS_SCRIPT_ID = '__kitr_flags__'

/** Read the snapshot a server page embedded, if any. */
export function readEmbeddedFlags(): FlagMap | undefined {
  if (typeof document === 'undefined') return undefined
  const el = document.getElementById(FLAGS_SCRIPT_ID)
  if (!el?.textContent) return undefined
  try {
    return JSON.parse(el.textContent) as FlagMap
  } catch {
    return undefined
  }
}

export function useFlags<D extends FlagDefinitions = FlagDefinitions>(app: KitrApp): Flags<D> {
  return app.container.use('flags') as Flags<D>
}
