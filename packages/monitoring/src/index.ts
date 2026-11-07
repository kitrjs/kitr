import { createDefineConfig, isKitrError } from '@kitr/core'

/** How serious a report or breadcrumb is, using Sentry's levels. */
export type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/** A step on the way to a possible error, attached to later reports by reporters that keep them. */
export interface Breadcrumb {
  /** A group, such as `import`, `navigation` or `api`. */
  category?: string
  /** What happened. */
  message: string
  /** How notable the step is. */
  level?: Severity
  /** Extra data for the step. */
  data?: Record<string, unknown>
  /** Milliseconds since the epoch; set to `Date.now()` when left out. */
  timestamp?: number
}

/** The signed-in user attached to reports by `setUser`. Any extra fields go to the reporter as-is. */
export interface MonitoringUser {
  /** Your id for the user. */
  id: string
  /** The user's email, if your privacy policy allows sending it. */
  email?: string
  /** A display or login name. */
  username?: string
  [key: string]: unknown
}

/** The optional second argument of `captureException` and `captureMessage`. */
export interface CaptureContext {
  /** Short strings to filter by; merged over the config `tags`. */
  tags?: Record<string, string>
  /** Any data that helps fix it: ids, sizes, the failing input. */
  extra?: Record<string, unknown>
  /** How serious it is. */
  level?: Severity
  /** Where it came from: 'error-boundary' | 'router' | 'server' | 'window' | 'action'. */
  source?: string
}

/** A destination for reports (Sentry, the console, your own endpoint). Only `name` and `captureException` are required. */
export interface Reporter {
  /** Identifies the reporter, such as `sentry`. */
  name: string
  /** Called once when the monitoring service is created. */
  init?(): void | Promise<void>
  /** Send an exception; must not throw or block. */
  captureException(error: unknown, context?: CaptureContext): void
  /** Send a message that is not an exception. */
  captureMessage?(message: string, context?: CaptureContext): void
  /** Attach the user to later reports, or clear it with null. */
  setUser?(user: MonitoringUser | null): void
  /** Record a step for later reports. */
  addBreadcrumb?(crumb: Breadcrumb): void
  /** Set a tag on later reports. */
  setTag?(key: string, value: string): void
  /** Wait for queued reports to be sent, up to the timeout; resolves false when it ran out. */
  flush?(timeoutMs?: number): Promise<boolean>
}

/** The options in `config/monitoring.ts`. */
export interface MonitoringConfig {
  /** Where reports go. The provider falls back to the console reporter in development. */
  reporters?: Reporter[]
  /** Return false to drop an error (expected 4xx, cancelled requests). Default drops kitr errors with status < 500. */
  shouldReport?: (error: unknown, context?: CaptureContext) => boolean
  /** Capture `window.onerror` and unhandled rejections on the client. Default true. */
  globalHandlers?: boolean
  /** Release / environment tags applied to every report. */
  tags?: Record<string, string>
  /** Log to the console as well. Default: development. */
  debug?: boolean
}

/** The service bound as `monitoring`: report errors and messages, and set the user, tags and breadcrumbs, on every reporter. */
export interface Monitoring {
  /** Report an error, unless `shouldReport` drops it. */
  captureException(error: unknown, context?: CaptureContext): void
  /** Report a message. Not filtered by `shouldReport`. */
  captureMessage(message: string, context?: CaptureContext): void
  /** Attach the signed-in user to later reports; null on sign-out. */
  setUser(user: MonitoringUser | null): void
  /** Record a step leading up to a possible error. */
  addBreadcrumb(crumb: Breadcrumb): void
  /** Set a tag on reporters that keep their own scope, such as Sentry. */
  setTag(key: string, value: string): void
  /** Run `fn`, report and rethrow on failure. */
  wrap<T>(fn: () => T, context?: CaptureContext): T
  /** Wait for every reporter to send what it queued, up to the timeout (default 2000 ms). Never throws. */
  flush(timeoutMs?: number): Promise<void>
  /** The reporters in use. */
  readonly reporters: readonly Reporter[]
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    monitoring: MonitoringConfig
  }
  interface ContainerBindings {
    monitoring: Monitoring
  }
}

/** Types `config/monitoring.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<MonitoringConfig>()

/** The default `shouldReport`: drops kitr errors below 500 (client mistakes) and `AbortError`s; reports everything else. */
export function defaultShouldReport(error: unknown): boolean {
  if (isKitrError(error)) return (error.status ?? 500) >= 500
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AbortError')
    return false
  return true
}

/**
 * Create the monitoring service without the provider: for server-only apps, scripts and tests.
 * Unlike the provider it adds no console reporter and no `environment` tag.
 */
export function createMonitoring(config: MonitoringConfig = {}): Monitoring {
  const reporters = [...(config.reporters ?? [])]
  const shouldReport = config.shouldReport ?? defaultShouldReport
  const debug = config.debug ?? false
  const each = (fn: (r: Reporter) => unknown) => {
    for (const r of reporters) {
      try {
        const out = fn(r)
        if (out instanceof Promise) out.catch(() => {})
      } catch {}
    }
  }
  const withTags = (context?: CaptureContext): CaptureContext | undefined =>
    config.tags ? { ...context, tags: { ...config.tags, ...context?.tags } } : context
  for (const r of reporters) {
    try {
      void r.init?.()
    } catch {}
  }
  const monitoring: Monitoring = {
    captureException(error, context) {
      if (!shouldReport(error, context)) return
      if (debug) console.error('[monitoring]', context?.source ?? '', error)
      each((r) => r.captureException(error, withTags(context)))
    },
    captureMessage(message, context) {
      if (debug) console.info('[monitoring]', message)
      each((r) => r.captureMessage?.(message, withTags(context)))
    },
    setUser: (user) => each((r) => r.setUser?.(user)),
    addBreadcrumb: (crumb) => each((r) => r.addBreadcrumb?.({ timestamp: Date.now(), ...crumb })),
    setTag: (key, value) => each((r) => r.setTag?.(key, value)),
    wrap<T>(fn: () => T, context?: CaptureContext): T {
      try {
        const out = fn()
        if (out instanceof Promise) {
          return out.catch((e: unknown) => {
            monitoring.captureException(e, context)
            throw e
          }) as T
        }
        return out
      } catch (e) {
        monitoring.captureException(e, context)
        throw e
      }
    },
    async flush(timeoutMs = 2000) {
      await Promise.all(reporters.map((r) => r.flush?.(timeoutMs).catch(() => false)))
    },
    get reporters() {
      return reporters
    },
  }
  return monitoring
}

/** Report uncaught errors and unhandled rejections in the browser (`source: 'window'`). Returns a function that removes the handlers. */
export function installGlobalHandlers(monitoring: Monitoring): () => void {
  if (typeof window === 'undefined') return () => {}
  const onError = (e: ErrorEvent) =>
    monitoring.captureException(e.error ?? e.message, { source: 'window' })
  const onRejection = (e: PromiseRejectionEvent) =>
    monitoring.captureException(e.reason, { source: 'window' })
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/** The subset of `@sentry/react` / `@sentry/browser` / `@sentry/node` these reporters call. */
export interface SentryLike {
  /** `Sentry.init`, called with the reporter's options. */
  init?(options: Record<string, unknown>): unknown
  /** `Sentry.captureException`. */
  captureException(error: unknown, context?: Record<string, unknown>): unknown
  /** `Sentry.captureMessage`. */
  captureMessage(message: string, context?: Record<string, unknown>): unknown
  /** `Sentry.setUser`. */
  setUser(user: Record<string, unknown> | null): void
  /** `Sentry.addBreadcrumb`. */
  addBreadcrumb(crumb: Record<string, unknown>): void
  /** `Sentry.setTag`. */
  setTag(key: string, value: string): void
  /** `Sentry.flush`. */
  flush?(timeout?: number): Promise<boolean>
}

/**
 * Sentry reporter. Pass the SDK module so the right one (react, browser, node) is bundled
 * for the environment: `sentry(Sentry, { dsn })`.
 */
export function sentry(
  Sentry: SentryLike,
  options: {
    dsn: string
    environment?: string
    release?: string
    tracesSampleRate?: number
    [key: string]: unknown
  },
): Reporter {
  return {
    name: 'sentry',
    init: () => {
      Sentry.init?.(options)
    },
    captureException: (error, context) =>
      Sentry.captureException(error, {
        tags: context?.tags,
        extra: context?.extra,
        level: context?.level,
      }),
    captureMessage: (message, context) =>
      Sentry.captureMessage(message, {
        tags: context?.tags,
        extra: context?.extra,
        level: context?.level ?? 'info',
      }),
    setUser: (user) => Sentry.setUser(user),
    addBreadcrumb: (crumb) => Sentry.addBreadcrumb({ ...crumb }),
    setTag: (k, v) => Sentry.setTag(k, v),
    flush: (t) => Sentry.flush?.(t) ?? Promise.resolve(true),
  }
}

/** Mirrors reports into the kitr devtools (channel "errors"). Added automatically in development. */
export function devtoolsReporter(hub: {
  log(
    channel: string,
    label: string,
    data?: unknown,
    level?: 'debug' | 'info' | 'warn' | 'error',
  ): void
}): Reporter {
  return {
    name: 'devtools',
    captureException: (error, context) =>
      hub.log(
        'errors',
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        { error, ...context },
        'error',
      ),
    captureMessage: (message, context) =>
      hub.log('errors', message, context, context?.level === 'warning' ? 'warn' : 'info'),
    addBreadcrumb: (crumb) =>
      hub.log(
        'breadcrumbs',
        `${crumb.category ?? 'crumb'}: ${crumb.message ?? ''}`,
        crumb.data,
        'debug',
      ),
    setUser: (user) =>
      hub.log(
        'errors',
        user ? `user ${user.id ?? ''}` : 'user cleared',
        user ?? undefined,
        'debug',
      ),
  }
}

/** Prints exceptions and messages to the console; ignores breadcrumbs and users. The provider's default in development. */
export function consoleReporter(): Reporter {
  return {
    name: 'console',
    captureException: (error, context) =>
      console.error('[monitoring]', context?.source ?? 'error', error, context?.extra ?? ''),
    captureMessage: (message, context) =>
      console.info('[monitoring]', message, context?.extra ?? ''),
    addBreadcrumb: () => {},
  }
}

/** Keeps exceptions, message texts and the last user in arrays, for tests. Ignores breadcrumbs and tags. */
export function memoryReporter(): Reporter & {
  exceptions: Array<{ error: unknown; context?: CaptureContext }>
  messages: string[]
  user: MonitoringUser | null
} {
  const store = {
    name: 'memory',
    exceptions: [] as Array<{ error: unknown; context?: CaptureContext }>,
    messages: [] as string[],
    user: null as MonitoringUser | null,
    captureException: (error: unknown, context?: CaptureContext) =>
      void store.exceptions.push({ error, context }),
    captureMessage: (message: string) => void store.messages.push(message),
    setUser: (user: MonitoringUser | null) => {
      store.user = user
    },
  }
  return store
}
