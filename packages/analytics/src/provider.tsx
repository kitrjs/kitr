import { defineProvider, getDevtools } from '@kitr/core'
import { lazy, type ReactNode, Suspense } from 'react'
import { consoleAdapter } from './adapters'
import { createAnalytics } from './analytics'
import { devtoolsAdapter } from './devtools-adapter'
import type { AnalyticsConfig } from './types'

const PageViews = lazy(() => import('./react').then((m) => ({ default: m.TrackPageViews })))

/**
 * Binds `analytics` into the container from `config/analytics.ts` and, on the client,
 * tracks route changes. With no adapters configured, development logs to the console
 * and production sends nothing.
 */
export const analyticsProvider = defineProvider({
  name: 'analytics',
  register(app) {
    app.container.singleton('analytics', () => {
      const config = app.config.get('analytics', {} as AnalyticsConfig)
      const adapters = config.adapters?.length
        ? config.adapters
        : app.isDevelopment
          ? [consoleAdapter()]
          : []
      const hub = getDevtools(app)
      const all = hub ? [...adapters, devtoolsAdapter(hub)] : adapters
      return createAnalytics({ debug: app.isDevelopment && !hub, ...config, adapters: all })
    })
  },
  devtools: (app) => import('./devtools').then((m) => m.panels(app)),
  wrap(children, app) {
    const config = app.config.get('analytics', {} as AnalyticsConfig)
    if (config.pageViews === false || typeof window === 'undefined') return children
    return (
      <>
        {children as ReactNode}
        <Suspense fallback={null}>
          <PageViews />
        </Suspense>
      </>
    )
  },
})

export default analyticsProvider
