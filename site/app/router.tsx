import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({
    routeTree,
    app,
    defaultPreload: 'intent',
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) => {
        // Hash or search changes (the /packages filters, in-page anchors) don't get a transition.
        if (!pathChanged) return false
        const from = fromLocation?.state.__TSR_index ?? 0
        const to = toLocation.state.__TSR_index ?? 0
        return [to < from ? 'back' : 'forward']
      },
    },
    // Keeps the router's scroll-to-top instant even though CSS smooth-scrolls in-page jumps.
    scrollRestorationBehavior: 'instant',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
