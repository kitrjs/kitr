import { defineRoutes } from 'kitr/app'
import type { Session } from 'kitr/auth'
import { requireAuth } from 'kitr/router'
import router from 'kitr/router/routes'
import { ssrRoute } from 'kitr/seo'
import { parseTableSearch } from 'kitr/table'
import type { User } from '#app/abilities'
import { projectsQuery } from '#app/features/projects/queries'
import { head, RootDocument } from './document'

/**
 * Every page of the app. Route options (loaders, guards, search params) live here; the components
 * live in app/pages and load on first visit. `kitr make:page <path>` appends to the chain.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/sign-in', {
      validateSearch: (search: Record<string, unknown>) => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
      }),
      lazy: () => import('./pages/sign-in'),
    })
    // Pathless layout: everything under it needs a session. The guard runs on the client only
    // (the token lives in localStorage), so the layout opts out of SSR.
    .layout(
      '_app',
      {
        ...ssrRoute(false),
        beforeLoad: async ({ context, location }) => {
          // Read the live session from the container: the router copies its context object,
          // so a value captured at creation time would be stale after sign-in.
          await context.app.boot()
          const session = context.app.container.use('auth').session as Session<User>
          return requireAuth()({ context: { session }, location })
        },
        lazy: () => import('./pages/app-layout'),
      },
      (app) =>
        app
          .page('/', {
            loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options({})),
            lazy: () => import('./pages/overview'),
          })
          .page('/projects', {
            validateSearch: parseTableSearch,
            loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options({})),
            lazy: () => import('./pages/projects'),
          }),
    ),
)

export type AppRoutes = typeof routes.$types
