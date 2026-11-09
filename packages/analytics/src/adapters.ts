import type { AnalyticsAdapter, EventProps } from './types'

/**
 * Google Analytics 4 through gtag.js. Loads the script on `init()` (client only), which runs once
 * tracking is enabled (after consent with `@kitr/consent`), and forwards page views, events and
 * user ids. `send_page_view: false` is set on config so the router, not the script, decides what
 * a page view is.
 *
 * Consent Mode v2 is set before the first config: `analytics_storage` is granted, because the
 * adapter only starts once the visitor agreed to analytics, and the three ad signals stay denied
 * unless `ads: true`.
 */
export function googleAnalytics(options: {
  measurementId: string
  debug?: boolean
  /** Grant `ad_storage`, `ad_user_data` and `ad_personalization` too. Default false. */
  ads?: boolean
}): AnalyticsAdapter {
  // gtag.js only reads `arguments` objects from the dataLayer, the way Google's snippet pushes
  // them; an array is silently ignored and nothing is sent.
  function gtag(..._args: unknown[]) {
    const w = globalThis as any
    w.dataLayer = w.dataLayer ?? []
    // biome-ignore lint/complexity/noArguments: gtag.js needs the arguments object itself
    w.dataLayer.push(arguments)
  }
  return {
    name: 'google-analytics',
    init() {
      if (typeof document === 'undefined') return
      if (!document.querySelector(`script[src*="gtag/js?id=${options.measurementId}"]`)) {
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(options.measurementId)}`
        document.head.appendChild(script)
      }
      ;(globalThis as any).gtag = (globalThis as any).gtag ?? gtag
      const ads = options.ads ? 'granted' : 'denied'
      gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: ads,
        ad_user_data: ads,
        ad_personalization: ads,
      })
      gtag('js', new Date())
      gtag('config', options.measurementId, {
        send_page_view: false,
        debug_mode: options.debug ?? undefined,
      })
    },
    page(path, props) {
      gtag('event', 'page_view', {
        page_path: path,
        page_location: props?.url,
        page_title: props?.title,
        ...props,
      })
    },
    track(event, props) {
      gtag('event', event, props ?? {})
    },
    identify(userId, traits) {
      gtag('config', options.measurementId, { user_id: userId, send_page_view: false })
      if (traits) gtag('set', 'user_properties', traits)
    },
    reset() {
      gtag('config', options.measurementId, { user_id: undefined, send_page_view: false })
    },
  }
}

/** Plausible: one script, `page()` becomes a pageview, `track()` a custom event with props. */
export function plausible(options: { domain: string; apiHost?: string }): AnalyticsAdapter {
  const host = (options.apiHost ?? 'https://plausible.io').replace(/\/$/, '')
  const call = (...args: unknown[]) => {
    const w = globalThis as any
    w.plausible =
      w.plausible ??
      ((...a: unknown[]) => {
        w.plausible.q ??= []
        w.plausible.q.push(a)
      })
    w.plausible(...args)
  }
  return {
    name: 'plausible',
    init() {
      if (typeof document === 'undefined') return
      if (document.querySelector('script[data-kitr-plausible]')) return
      const script = document.createElement('script')
      script.defer = true
      script.dataset.domain = options.domain
      script.dataset.kitrPlausible = ''
      script.src = `${host}/js/script.manual.js`
      document.head.appendChild(script)
    },
    page(path, props) {
      call('pageview', { u: props?.url ?? path, props })
    },
    track(event, props) {
      call(event, { props })
    },
  }
}

/** Minimal shape of the posthog-js client; pass `posthog` from `posthog-js` or any compatible object. */
export interface PostHogLike {
  /** Start the client with a project API key and options. */
  init(token: string, config?: Record<string, unknown>): unknown
  /** Send one event, `$pageview` included. */
  capture(event: string, properties?: Record<string, unknown> | null): unknown
  /** Attach later events to a user id. */
  identify(id?: string, properties?: Record<string, unknown>): void
  /** Forget the identified user. */
  reset(): void
}

/** PostHog through its own client (`posthog-js`), with autocapture of page views turned off so the router drives them. */
export function posthog(
  client: PostHogLike,
  options: { apiKey: string; apiHost?: string; config?: Record<string, unknown> },
): AnalyticsAdapter {
  return {
    name: 'posthog',
    init() {
      client.init(options.apiKey, {
        api_host: options.apiHost ?? 'https://us.i.posthog.com',
        capture_pageview: false,
        ...options.config,
      })
    },
    page(path, props) {
      client.capture('$pageview', { $current_url: props?.url ?? path, ...props })
    },
    track(event, props) {
      client.capture(event, props ?? null)
    },
    identify(userId, traits) {
      client.identify(userId, traits)
    },
    reset() {
      client.reset()
    },
  }
}

/** Logs every call. The default in development when no other adapter is configured. */
export function consoleAdapter(options: { prefix?: string } = {}): AnalyticsAdapter {
  const prefix = options.prefix ?? '[analytics]'
  return {
    name: 'console',
    page: (path, props) => console.info(prefix, 'page', path, props ?? ''),
    track: (event, props) => console.info(prefix, 'track', event, props ?? ''),
    identify: (userId, traits) => console.info(prefix, 'identify', userId, traits ?? ''),
    reset: () => console.info(prefix, 'reset'),
  }
}

/** Collects calls in memory. For tests: `expect(adapter.calls).toContainEqual(...)`. */
export function memoryAdapter(): AnalyticsAdapter & {
  calls: Array<{ type: string; args: unknown[] }>
} {
  const calls: Array<{ type: string; args: unknown[] }> = []
  return {
    name: 'memory',
    calls,
    page: (...args) => void calls.push({ type: 'page', args }),
    track: (...args: [string, EventProps?]) => void calls.push({ type: 'track', args }),
    identify: (...args) => void calls.push({ type: 'identify', args }),
    reset: () => void calls.push({ type: 'reset', args: [] }),
  }
}
