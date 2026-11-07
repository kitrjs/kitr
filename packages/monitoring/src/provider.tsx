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

export interface ErrorBoundaryProps {
  monitoring: Monitoring
  fallback?: ReactNode | ((error: unknown, reset: () => void) => ReactNode)
  children: ReactNode
}

/** Reports render errors, then shows `fallback` (or nothing, so the router's error component takes over). */
export class MonitoringErrorBoundary extends Component<ErrorBoundaryProps, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.monitoring.captureException(error, {
      source: 'error-boundary',
      extra: { componentStack: info.componentStack },
    })
  }
  reset = () => this.setState({ error: null })
  render() {
    if (this.state.error === null) return this.props.children
    const { fallback } = this.props
    if (typeof fallback === 'function') return fallback(this.state.error, this.reset)
    if (fallback !== undefined) return fallback
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
        debug: app.isDevelopment,
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
