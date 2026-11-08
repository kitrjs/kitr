import { defineRoutes } from '@kitr/kitr/app'
import router from '@kitr/router/routes'
import { head, RootDocument } from './document'

/**
 * Every page of the app, in one place. `kitr make:page <path>` appends to this chain; `.group`
 * nests paths, `.layout` wraps pages in a component without a path segment.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/about', { lazy: () => import('./pages/about') }),
)

export type AppRoutes = typeof routes.$types
