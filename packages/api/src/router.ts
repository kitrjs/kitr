import {
  createRouteTable,
  defineRoutes as defineTable,
  type KitrRouter,
  type RouteMap as TableMap,
} from '@kitr/core'
import http from './routes'

export { joinPath } from './routes'

/**
 * A route table with the http extension: what `@kitr/api`'s `defineRoutes` and `createRouter`
 * return. The same table takes `.page` from `@kitr/router/routes` and `.ws` from
 * `@kitr/realtime/routes` when those extensions are listed in `defineRoutes([...])`.
 */
export type Router<R extends TableMap = {}> = KitrRouter<'http', R>

/**
 * Entry point for a server-only `routes.ts`: a table with the http methods.
 *
 *   export const routes = defineRoutes((r) =>
 *     r.group({ prefix: '/api', middleware: [auth()] }, (api) =>
 *       api.resource('projects', ProjectsController)
 *          .get('/me', [UsersController, 'me'], { name: 'me' }),
 *     ),
 *   )
 *   export type AppRoutes = typeof routes.$types
 *
 * For a table that also holds pages or sockets, use `defineRoutes([http, pages], ...)` from `@kitr/kitr/app`.
 */
export function defineRoutes<R extends TableMap>(
  define: (router: Router<{}>) => Router<R> | void,
): Router<R> {
  return defineTable([http], define)
}

/** An empty table with the http methods. */
export function createRouter(): Router<{}> {
  return createRouteTable([http])
}
