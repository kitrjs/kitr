import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import { type CookieItem, defineCookie } from '@kitr/storage'

/** A consent category. `necessary` is always granted; the others are whatever `config.categories` lists. */
export type ConsentCategory =
  | 'necessary'
  | 'analytics'
  | 'marketing'
  | 'preferences'
  | (string & {})

/** What a visitor agreed to, stored as JSON in the consent cookie. */
export interface ConsentRecord {
  /** Categories the visitor agreed to. `necessary` is always in. */
  granted: ConsentCategory[]
  /** ISO time of the choice; undefined until they chose. */
  decidedAt?: string
  /** Bump `config.version` to ask everyone again. */
  version: number
}

/** Options for `config/consent.ts`: the categories offered, the version, the cookie and what to gate. */
export interface ConsentConfig {
  /** What the banner offers. Default `['analytics', 'marketing']`. */
  categories?: ConsentCategory[]
  /** Re-ask when this changes. Default 1. */
  version?: number
  /** Cookie name. Default `consent`. */
  cookie?: string
  /** Days the choice is kept. Default 365. */
  maxAge?: number
  /** Which category analytics waits for. Default `analytics`; false never gates it. */
  analytics?: ConsentCategory | false
  /** Which category error monitoring waits for. Default: none (monitoring runs; set `'analytics'` to gate it). */
  monitoring?: ConsentCategory | false
}

/** The consent service bound as `consent` in the container. Reads and writes the visitor's choice. */
export interface Consent {
  /** The record, with `decidedAt` unset while the banner should show. */
  get(): ConsentRecord
  /** Has the visitor decided (for this version)? */
  decided(): boolean
  /** Whether a category is granted for the current version. Always true for `necessary`. */
  has(category: ConsentCategory): boolean
  /** Grant exactly these categories (plus `necessary`). */
  grant(categories: ConsentCategory[]): void
  /** Grant every configured category. */
  acceptAll(): void
  /** Decline everything but `necessary`. */
  rejectAll(): void
  /** Forget the choice so the banner shows again. */
  reset(): void
  /** Call `listener` after every change to the choice. Returns the unsubscribe function. */
  subscribe(listener: (record: ConsentRecord) => void): () => void
  /** The categories from config, in order. */
  readonly categories: ConsentCategory[]
  /** The storage cookie that holds the record; `cookie.get(request.headers)` reads it on the server. */
  readonly cookie: CookieItem<ConsentRecord>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    consent: ConsentConfig
  }
  interface ContainerBindings {
    consent: Consent
  }
}

/** Types the default export of `config/consent.ts`. */
export const defineConfig = createDefineConfig<ConsentConfig>()

/**
 * Build a consent service backed by a cookie. The provider calls it with the app (for devtools
 * logging); tests and server code can call it without one.
 */
export function createConsent(config: ConsentConfig = {}, app?: KitrApp): Consent {
  const categories = config.categories ?? ['analytics', 'marketing']
  const version = config.version ?? 1
  const empty: ConsentRecord = { granted: ['necessary'], version }
  const cookie = defineCookie<ConsentRecord>(config.cookie ?? 'consent', {
    default: empty,
    maxAge: (config.maxAge ?? 365) * 86_400,
    sameSite: 'lax',
  })
  const listeners = new Set<(record: ConsentRecord) => void>()
  const load = (): ConsentRecord => {
    const r = cookie.get()
    return r && r.version === version && Array.isArray(r.granted) ? r : empty
  }
  // One snapshot per change so useSyncExternalStore sees a stable object between writes.
  let current = load()
  const read = () => current
  const write = (granted: ConsentCategory[]) => {
    const record: ConsentRecord = {
      granted: [...new Set(['necessary', ...granted.filter((c) => categories.includes(c))])],
      decidedAt: new Date().toISOString(),
      version,
    }
    current = record
    cookie.set(record)
    if (app) getDevtools(app)?.log('consent', 'decided', record)
    for (const l of listeners) l(record)
  }
  return {
    categories,
    cookie,
    get: read,
    decided: () => read().decidedAt !== undefined,
    has: (category) => category === 'necessary' || read().granted.includes(category),
    grant: write,
    acceptAll: () => write(categories),
    rejectAll: () => write([]),
    reset() {
      current = empty
      cookie.remove()
      for (const l of listeners) l(empty)
    },
    subscribe(listener) {
      listeners.add(listener)
      // The cookie also fires for our own writes; only a change made elsewhere (another tab,
      // another instance) is news, or every listener would hear each choice twice.
      const off = cookie.subscribe?.(() => {
        const next = load()
        if (JSON.stringify(next) === JSON.stringify(current)) return
        current = next
        listener(current)
      })
      return () => {
        listeners.delete(listener)
        off?.()
      }
    },
  }
}

/** The consent service from an app's container. Not a hook; components use `useConsent()` from `@kitr/consent/react`. */
export function useConsent(app: KitrApp): Consent {
  return app.container.use('consent')
}
