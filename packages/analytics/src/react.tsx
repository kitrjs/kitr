import { useApp } from '@kitr/react'
import { useRouter } from '@tanstack/react-router'
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
  const router = useRouter()
  const analytics = useAnalytics()
  useEffect(() => {
    const send = (pathname: string, href: string) =>
      analytics.page(pathname, { url: href, title: document.title })
    send(router.state.location.pathname, window.location.href)
    return router.subscribe('onResolved', ({ toLocation, pathChanged }) => {
      if (pathChanged) send(toLocation.pathname, window.location.origin + toLocation.href)
    })
  }, [router, analytics])
  return null
}
