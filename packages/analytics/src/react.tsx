import { useApp } from '@kitr/react'
import type { AnyRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { Analytics } from './analytics'
import type { EventMap } from './types'

/** The analytics instance from the container. */
export function useAnalytics<E extends EventMap = EventMap>(): Analytics<E> {
  return useApp().container.use('analytics') as Analytics<E>
}

/**
 * Sends a `page()` on every resolved navigation. Mounted by the provider when
 * `pageViews` is not false; render it yourself if you build the tree by hand.
 */
export function TrackPageViews() {
  const app = useApp()
  const analytics = useAnalytics()
  // The router comes from the container (bound by createKitrRouter), so this works in any
  // tree and never renders differently on the server. Effects only run in the browser.
  useEffect(() => {
    if (!app.container.has('router')) return
    const router = app.container.use('router') as AnyRouter
    const send = (pathname: string, href: string) =>
      analytics.page(pathname, { url: href, title: document.title })
    send(router.state.location.pathname, window.location.href)
    return router.subscribe('onResolved', ({ toLocation, pathChanged }) => {
      if (pathChanged) send(toLocation.pathname, window.location.origin + toLocation.href)
    })
  }, [app, analytics])
  return null
}
