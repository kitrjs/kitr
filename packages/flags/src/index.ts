import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'

/** A flag's value: on/off, a number such as a limit, or a string such as a variant name. */
export type FlagValue = boolean | string | number
/** Flag values by key, untyped: what providers and embedded snapshots carry. */
export type FlagMap = Record<string, FlagValue>

/** One flag in `defineFlags()`: its default, whose type fixes the flag's type, and what it gates. */
export interface FlagDefinition<T extends FlagValue = FlagValue> {
  /** The value when no provider answers. */
  default: T
  /** A sentence on what the flag gates, for the people who flip it. */
  description?: string
}

/** Every flag by key, as `defineFlags()` takes and returns them. */
export type FlagDefinitions = Record<string, FlagDefinition>
/** The resolved value of every flag in `D`, typed by each default. */
export type FlagValues<D extends FlagDefinitions> = { [K in keyof D]: D[K]['default'] }

/** Who is asking: the user, their plan, the request. Providers target on it. */
export interface FlagContext {
  /** Stable id of the user; percentage rollouts and OpenFeature's `targetingKey` use it. */
  userId?: string
  [key: string]: unknown
}

/**
 * Where answers come from. Mirrors OpenFeature's provider shape, so an OpenFeature client is a
 * one-line adapter, but a plain object or `envFlagsProvider()` also work.
 */
export interface FlagsProvider {
  /** Shown in warnings when the provider fails. */
  name: string
  /** Runs once per `resolve()`, before any key. A throw skips this provider for that resolve. */
  init?(context: FlagContext): Promise<void> | void
  /** `undefined` means "no opinion": the next provider, then the default, answer. */
  resolve(key: string, context: FlagContext): Promise<FlagValue | undefined> | FlagValue | undefined
}

/** The options in `config/flags.ts`. */
export interface FlagsConfig {
  /** The flags from `app/flags.ts`. */
  definitions?: FlagDefinitions
  /** First provider with an answer wins. */
  providers?: FlagsProvider[]
  /**
   * Seconds a resolved snapshot stays fresh in the browser. After that the client resolves again,
   * with the context of its last `resolve()`, so a flag turned off reaches open tabs. Default: never.
   */
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

/** Type the default export of `config/flags.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<FlagsConfig>()

/** Declare every flag once, in `app/flags.ts`, with its default and a sentence on what it gates. */
export function defineFlags<const D extends FlagDefinitions>(definitions: D): D {
  return definitions
}

/** The flags service bound as `flags`: a typed snapshot of every flag, and the means to resolve it. */
export interface Flags<D extends FlagDefinitions = FlagDefinitions> {
  /** The current answer. Synchronous: works from a resolved snapshot (and the defaults before one). */
  value<K extends keyof D & string>(key: K): D[K]['default']
  /** True only when the flag's current value is exactly `true`. */
  isEnabled(key: keyof D & string): boolean
  /** Every flag, resolved for `context`. Server: once per request. Client: once per session, then cached. */
  resolve(context?: FlagContext): Promise<FlagValues<D>>
  /** Load a snapshot the server resolved (what `<FlagsScript>` carries), skipping any resolution. */
  hydrate(values: Partial<FlagValues<D>>): void
  /** Every current value, as one frozen object that stays the same until the next change. */
  snapshot(): FlagValues<D>
  /** Call `listener` after each resolve or hydrate that updates the snapshot; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  /** The definitions passed in. */
  readonly definitions: D
  /** Whether the snapshot came from a resolve or hydrate rather than the defaults. */
  readonly resolved: boolean
}

/** Options for `createFlags()` beyond the config. */
export interface CreateFlagsOptions {
  /**
   * Whether `resolve()` updates the snapshot that `value()`, `isEnabled()` and the React hooks
   * read. Default: everywhere but the server's root app, which serves every user at once (the
   * provider binds one instance per request there, and those keep their snapshot).
   */
  keepSnapshot?: boolean
}

/** Build a flags service from definitions and a config: what the provider binds, and what tests call directly. */
export function createFlags<D extends FlagDefinitions>(
  definitions: D,
  config: FlagsConfig = {},
  app?: KitrApp,
  options: CreateFlagsOptions = {},
): Flags<D> {
  const providers = config.providers ?? []
  const defaults = Object.fromEntries(
    Object.entries(definitions).map(([k, d]) => [k, d.default]),
  ) as FlagValues<D>
  let values: FlagValues<D> = Object.freeze({ ...defaults }) as FlagValues<D>
  let resolved = false
  const listeners = new Set<() => void>()
  // One server process answers many users at once: a per-request resolution must never become
  // the shared snapshot that `value()` reads, or one user's targeting would leak to another.
  const shared = options.keepSnapshot ?? !app?.isServer
  // In the browser, a snapshot older than `ttl` seconds is resolved again for the same context.
  const ttl = shared && app?.isClient && config.ttl && config.ttl > 0 ? config.ttl * 1000 : 0
  let lastContext: FlagContext = {}
  let refresh: ReturnType<typeof setTimeout> | undefined
  const scheduleRefresh = () => {
    if (!ttl) return
    if (refresh) clearTimeout(refresh)
    refresh = setTimeout(() => void flags.resolve(lastContext).catch(() => {}), ttl)
  }
  const notify = () => {
    scheduleRefresh()
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
      if (shared) lastContext = context
      // A provider that is down (or throws) is skipped: the next one, then the default, answers.
      const ready = new Set<FlagsProvider>()
      for (const p of providers) {
        try {
          await p.init?.(context)
          ready.add(p)
        } catch (error) {
          warn(`provider "${p.name}" failed to start`, error)
        }
      }
      const next = { ...defaults } as Record<string, FlagValue>
      await Promise.all(
        Object.keys(definitions).map(async (key) => {
          for (const p of providers) {
            if (!ready.has(p)) continue
            let answer: FlagValue | undefined
            try {
              answer = await p.resolve(key, context)
            } catch (error) {
              warn(`provider "${p.name}" failed on "${key}"`, error)
              continue
            }
            const value =
              answer === undefined ? undefined : coerce(answer, definitions[key]!.default)
            if (value !== undefined) {
              next[key] = value
              return
            }
          }
        }),
      )
      if (!shared) return next as FlagValues<D>
      values = Object.freeze(next) as FlagValues<D>
      resolved = true
      notify()
      return { ...values }
    },
    hydrate(partial) {
      // Embedded JSON is input: keep declared keys only, in their declared types.
      const clean: Record<string, FlagValue> = {}
      for (const [key, raw] of Object.entries(partial ?? {})) {
        if (!(key in definitions) || raw === undefined || raw === null) continue
        const value = coerce(raw as FlagValue, definitions[key]!.default)
        if (value !== undefined) clean[key] = value
      }
      values = Object.freeze({ ...defaults, ...clean }) as FlagValues<D>
      resolved = true
      notify()
    },
    // The same object until the next resolve or hydrate: useSyncExternalStore needs a stable snapshot.
    snapshot: () => values,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return flags
}

function warn(message: string, error: unknown) {
  console.warn(`[@kitr/flags] ${message}:`, error)
}

/**
 * Providers answer with strings from env files; keep the declared type. An answer that can't be
 * read as that type (`FLAG_PAGE_SIZE=lots`) is no answer, so the next provider or the default wins.
 */
function coerce(value: FlagValue, like: FlagValue): FlagValue | undefined {
  if (typeof like === 'boolean') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    const text = String(value).trim().toLowerCase()
    if (['true', '1', 'on', 'yes'].includes(text)) return true
    if (['false', '0', 'off', 'no', ''].includes(text)) return false
    return undefined
  }
  if (typeof like === 'number') {
    if (typeof value === 'boolean') return undefined
    const n =
      typeof value === 'number' ? value : String(value).trim() === '' ? Number.NaN : Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  if (typeof like === 'string') return typeof value === 'object' ? undefined : String(value)
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

/** Answer from environment variables: `FLAG_NEW_DASHBOARD=true` answers `newDashboard` and `new-dashboard`. Reads `process.env` unless given a map. */
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

/** The id of the JSON script tag that carries the server's snapshot to the browser. */
export const FLAGS_SCRIPT_ID = '__kitr_flags__'

/** Read the snapshot a server page embedded, if any. `undefined` on the server, without the tag, or when its JSON is broken. */
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

/** The app's flags service, from the container, outside React. */
export function useFlags<D extends FlagDefinitions = FlagDefinitions>(app: KitrApp): Flags<D> {
  return app.container.use('flags') as Flags<D>
}
