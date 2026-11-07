import type { AnalyticsAdapter, AnalyticsConfig, EventMap, EventProps } from './types'

type Call = { type: 'page' | 'track' | 'identify' | 'reset'; args: unknown[] }

/**
 * The analytics service bound as `analytics` in the container and returned by `useAnalytics()`.
 * Every call goes to each adapter, or waits in a queue until `enable()`.
 */
export interface Analytics<E extends EventMap = EventMap> {
  /** Record a page view. The provider calls it on every route change unless `pageViews` is false. */
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  /** Record an event from the app's event map, with its props. */
  track<K extends keyof E & string>(event: K, ...props: E[K] extends undefined ? [] : [E[K]]): void
  /** Record any event by name. Accepts names outside the event map. */
  track(event: string, props?: EventProps): void
  /** Attach later events to a user id, after sign-in. `globalProps` are not added. */
  identify(userId: string, traits?: EventProps): void
  /** Forget the identified user, on sign-out. */
  reset(): void
  /** Load each adapter's script, then send the queued calls and start sending. Call after consent. */
  enable(): Promise<void>
  /** Stop sending and empty the queue. Later calls queue again (up to 100) until the next `enable()`. */
  disable(): void
  /** True once `enable()` has finished and until `disable()`. */
  readonly enabled: boolean
  /** Add an adapter at runtime (after a consent choice, or lazily). */
  use(adapter: AnalyticsAdapter): void
  /** Every adapter in use, in the order calls reach them. */
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
