import { defineProvider, getDevtools } from '@kitr/core'
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { consoleAdapter } from './adapters'
import { createAnalytics } from './analytics'
import { devtoolsAdapter } from './devtools-adapter'
import type { AnalyticsConfig } from './types'

const PageViews = lazy(() => import('./react').then((m) => ({ default: m.TrackPageViews })))

/** Loads the tracker after hydration, so no Suspense boundary exists while React matches server markup. */
function AfterMount() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  ) : null
}

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
      // With @kitr/consent installed (and gating analytics), start disabled whatever the order of
      // providers: consent enables tracking once the visitor agrees, so no tracker script loads
      // before that.
      const consent = app.providers.some((p) => p.name === 'consent')
        ? app.config.has('consent')
          ? (app.config.get('consent') as { analytics?: unknown })
          : {}
        : undefined
      const gated = consent !== undefined && consent.analytics !== false
      return createAnalytics({
        // The default console adapter already prints every call: debug would print it twice.
        debug: app.isDevelopment && !hub && !!config.adapters?.length,
        ...config,
        ...(gated ? { enabled: false } : {}),
        adapters: all,
      })
    })
  },
  devtools: (app, ui) => import('./devtools').then((m) => m.panels(app, ui)),
  wrap(children, app) {
    const config = app.config.get('analytics', {} as AnalyticsConfig)
    if (config.pageViews === false) return children
    // Always the same tree on the server and the client; the tracker itself waits for mount.
    return (
      <>
        {children as ReactNode}
        <AfterMount />
      </>
    )
  },
})

export default analyticsProvider
