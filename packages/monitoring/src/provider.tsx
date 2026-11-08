import { defineProvider, getDevtools } from '@kitr/core'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  consoleReporter,
  createMonitoring,
  devtoolsReporter,
  installGlobalHandlers,
  type Monitoring,
  type MonitoringConfig,
} from './index'

/** Props of `MonitoringErrorBoundary`. */
export interface ErrorBoundaryProps {
  /** The service to report render errors to. */
  monitoring: Monitoring
  /** Shown instead of the children after an error; a function gets the error and `reset`. Left out, the boundary rethrows. */
  fallback?: ReactNode | ((error: unknown, reset: () => void) => ReactNode)
  /** What the boundary guards. */
  children: ReactNode
}

/**
 * Errors already reported. React retries a failed render once (and StrictMode renders twice), which
 * throws a fresh error object each time, so errors are also keyed by name and message until the current task yields.
 */
const reportedByBoundary = new WeakSet<object>()
const recentKeys = new Set<string>()
function seen(error: unknown): boolean {
  if (error && typeof error === 'object') {
    if (reportedByBoundary.has(error)) return true
    reportedByBoundary.add(error)
  }
  const key =
    error instanceof Error ? `${error.name}:${error.message}` : `${typeof error}:${String(error)}`
  if (recentKeys.has(key)) return true
  recentKeys.add(key)
  queueMicrotask(() => recentKeys.delete(key))
  return false
}

/** Reports render errors, then shows `fallback` (or nothing, so the router's error component takes over). */
export class MonitoringErrorBoundary extends Component<ErrorBoundaryProps, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  private report(error: unknown, componentStack?: string | null) {
    if (seen(error)) return
    this.props.monitoring.captureException(error, {
      source: 'error-boundary',
      extra: componentStack ? { componentStack } : undefined,
    })
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.report(error, info.componentStack)
  }
  reset = () => this.setState({ error: null })
  render() {
    if (this.state.error === null) return this.props.children
    const { fallback } = this.props
    if (typeof fallback === 'function') return fallback(this.state.error, this.reset)
    if (fallback !== undefined) return fallback
    // Rethrowing means this boundary never commits, so componentDidCatch won't run: report here.
    this.report(this.state.error)
    throw this.state.error
  }
}

/**
 * Binds `monitoring` from `config/monitoring.ts`, installs window handlers on the client,
 * and wraps the tree in an error boundary that reports before TanStack Router's error
 * component renders.
 */
export const monitoringProvider = defineProvider({
  name: 'monitoring',
  register(app) {
    app.container.singleton('monitoring', () => {
      const config = app.config.get('monitoring', {} as MonitoringConfig)
      const hub = getDevtools(app)
      const base = config.reporters?.length
        ? config.reporters
        : app.isDevelopment
          ? [consoleReporter()]
          : []
      const reporters = hub ? [...base, devtoolsReporter(hub)] : base
      return createMonitoring({
        // The default console reporter already prints every report: debug would print it twice.
        debug: app.isDevelopment && !!config.reporters?.length,
        ...config,
        reporters,
        tags: { environment: app.mode, ...config.tags },
      })
    })
  },
  devtools: () => import('./devtools').then((m) => m.panels()),
  boot(app) {
    const config = app.config.get('monitoring', {} as MonitoringConfig)
    if (config.globalHandlers !== false && app.isClient)
      installGlobalHandlers(app.container.use('monitoring'))
  },
  wrap(children, app) {
    return (
      <MonitoringErrorBoundary monitoring={app.container.use('monitoring')}>
        {children as ReactNode}
      </MonitoringErrorBoundary>
    )
  },
})

export default monitoringProvider
