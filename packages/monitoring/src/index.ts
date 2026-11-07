import { createDefineConfig, isKitrError } from '@kitr/core'

export type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export interface Breadcrumb {
  category?: string
  message: string
  level?: Severity
  data?: Record<string, unknown>
  timestamp?: number
}

export interface MonitoringUser {
  id: string
  email?: string
  username?: string
  [key: string]: unknown
}

export interface CaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: Severity
  /** Where it came from: 'error-boundary' | 'router' | 'server' | 'window' | 'action'. */
  source?: string
}

/** What every destination implements. */
export interface Reporter {
  name: string
  init?(): void | Promise<void>
  captureException(error: unknown, context?: CaptureContext): void
  captureMessage?(message: string, context?: CaptureContext): void
  setUser?(user: MonitoringUser | null): void
  addBreadcrumb?(crumb: Breadcrumb): void
  setTag?(key: string, value: string): void
  flush?(timeoutMs?: number): Promise<boolean>
}

export interface MonitoringConfig {
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

export interface Monitoring {
  captureException(error: unknown, context?: CaptureContext): void
  captureMessage(message: string, context?: CaptureContext): void
  setUser(user: MonitoringUser | null): void
  addBreadcrumb(crumb: Breadcrumb): void
  setTag(key: string, value: string): void
  /** Run `fn`, report and rethrow on failure. */
  wrap<T>(fn: () => T, context?: CaptureContext): T
  flush(timeoutMs?: number): Promise<void>
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

export const defineConfig = createDefineConfig<MonitoringConfig>()

/** Default filter: kitr errors that are client mistakes (4xx) are not incidents. */
export function defaultShouldReport(error: unknown): boolean {
  if (isKitrError(error)) return (error.status ?? 500) >= 500
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AbortError')
    return false
  return true
}

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

/** Window error and unhandled-rejection handlers. Returns a disposer. */
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
  init?(options: Record<string, unknown>): unknown
  captureException(error: unknown, context?: Record<string, unknown>): unknown
  captureMessage(message: string, context?: Record<string, unknown>): unknown
  setUser(user: Record<string, unknown> | null): void
  addBreadcrumb(crumb: Record<string, unknown>): void
  setTag(key: string, value: string): void
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

/** Prints reports. The default reporter in development. */
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

/** Keeps reports in memory, for tests. */
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
