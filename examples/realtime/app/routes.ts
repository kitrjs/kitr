import { defineRoutes } from 'kitr/app'
import router from 'kitr/router/routes'
import { ssrRoute } from 'kitr/seo'
import { head, RootDocument } from './document'

const rooms = ['general', 'random', 'help']

/** Every page of the app. `kitr make:page <path>` appends to the chain. */
export const routes = defineRoutes([router], (r) =>
  r.root({ head, component: RootDocument }).page('/', {
    validateSearch: (search: Record<string, unknown>) => ({
      room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'general',
    }),
    // The socket only exists in the browser, so this page renders on the client.
    ...ssrRoute(false),
    lazy: () => import('./pages/chat'),
  }),
)

export type AppRoutes = typeof routes.$types
