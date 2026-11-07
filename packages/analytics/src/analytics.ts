import type { AnalyticsAdapter, AnalyticsConfig, EventMap, EventProps } from './types'

type Call = { type: 'page' | 'track' | 'identify' | 'reset'; args: unknown[] }

export interface Analytics<E extends EventMap = EventMap> {
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  track<K extends keyof E & string>(event: K, ...props: E[K] extends undefined ? [] : [E[K]]): void
  track(event: string, props?: EventProps): void
  identify(userId: string, traits?: EventProps): void
  reset(): void
  /** Flush the queue and start sending. Call after consent. */
  enable(): Promise<void>
  /** Stop sending; calls are dropped (not queued) once disabled after being enabled. */
  disable(): void
  readonly enabled: boolean
  /** Add an adapter at runtime (after a consent choice, or lazily). */
  use(adapter: AnalyticsAdapter): void
  readonly adapters: readonly AnalyticsAdapter[]
}

/**
 * One API over any number of destinations. Calls made before `enable()` queue (up to 100)
 * so a consent banner can gate everything, and every adapter call is wrapped so a blocked
 * script never breaks the app.
 */
export function createAnalytics<E extends EventMap = EventMap>(
  config: AnalyticsConfig<E> = {},
): Analytics<E> {
  const adapters: AnalyticsAdapter[] = [...(config.adapters ?? [])]
  const queue: Call[] = []
  let enabled = false
  const initialised = new Set<AnalyticsAdapter>()
  const debug = config.debug ?? false

  const safe = (adapter: AnalyticsAdapter, fn: () => unknown) => {
    try {
      const r = fn()
      if (r instanceof Promise)
        r.catch((e) => debug && console.warn(`[analytics] ${adapter.name}`, e))
    } catch (e) {
      if (debug) console.warn(`[analytics] ${adapter.name}`, e)
    }
  }
  const initAdapter = async (adapter: AnalyticsAdapter) => {
    if (initialised.has(adapter)) return
    initialised.add(adapter)
    if (typeof window === 'undefined') return
    await Promise.resolve(safe(adapter, () => adapter.init?.()))
  }
  const dispatch = (call: Call) => {
    if (!enabled) {
      if (queue.length < 100) queue.push(call)
      return
    }
    if (debug) console.info('[analytics]', call.type, ...call.args)
    for (const adapter of adapters) {
      const fn = (adapter as any)[call.type] as ((...a: unknown[]) => unknown) | undefined
      if (fn) safe(adapter, () => fn.apply(adapter, call.args))
    }
  }
  const withGlobals = (props?: EventProps) =>
    config.globalProps ? { ...config.globalProps, ...props } : props

  const analytics: Analytics<E> = {
    page: (path, props) => dispatch({ type: 'page', args: [path, withGlobals(props)] }),
    track: ((event: string, props?: EventProps) =>
      dispatch({ type: 'track', args: [event, withGlobals(props)] })) as Analytics<E>['track'],
    identify: (userId, traits) => dispatch({ type: 'identify', args: [userId, traits] }),
    reset: () => dispatch({ type: 'reset', args: [] }),
    async enable() {
      if (enabled) return
      for (const adapter of adapters) await initAdapter(adapter)
      enabled = true
      for (const call of queue.splice(0)) dispatch(call)
    },
    disable() {
      enabled = false
      queue.length = 0
    },
    get enabled() {
      return enabled
    },
    use(adapter) {
      adapters.push(adapter)
      if (enabled) void initAdapter(adapter)
    },
    get adapters() {
      return adapters
    },
  }
  if (config.enabled !== false) void analytics.enable()
  return analytics
}

/** Identity helper that fixes the event map type: `const analytics = createAnalytics<AppEvents>(...)`. */
export function defineEvents<E extends EventMap>() {
  return <C extends AnalyticsConfig<E>>(config: C) => config as C & { events?: E }
}
