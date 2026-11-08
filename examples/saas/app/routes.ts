import { defineRoutes } from '@kitr/kitr/app'
import { ensureSession } from '@kitr/auth'
import { requireAuth } from '@kitr/router'
import router from '@kitr/router/routes'
import { parseTableSearch } from '@kitr/table'
import { projectsQuery } from '#app/queries/projects'
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
    .page('/forgot-password', { lazy: () => import('./pages/forgot-password') })
    .page('/reset-password', {
      validateSearch: (search: Record<string, unknown>) => ({
        token: typeof search.token === 'string' ? search.token : '',
      }),
      lazy: () => import('./pages/reset-password'),
    })
    .page('/verify-email', {
      validateSearch: (search: Record<string, unknown>) => ({
        token: typeof search.token === 'string' ? search.token : '',
      }),
      lazy: () => import('./pages/verify-email'),
    })
    // Pathless layout: everything under it needs a session, and renders on the server with it.
    // `ensureSession` loads the session first: from the request while rendering on the server,
    // from the cookie-backed /api/auth/session (cached) in the browser.
    .layout(
      '_app',
      {
        beforeLoad: async (ctx) => {
          await ensureSession(ctx)
          // The guard redirects when signed out. Its result is dropped on purpose: it holds
          // functions, and the route context of a server-rendered page must be serializable.
          await requireAuth()(ctx)
        },
        lazy: () => import('./layouts/app'),
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
