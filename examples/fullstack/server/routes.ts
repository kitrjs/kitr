import { defineRoutes } from 'kitr/app'
import api from 'kitr/api/routes'
import realtime from 'kitr/realtime/routes'
import HealthController from '#server/controllers/health_controller'
import { exampleChannel } from '#app/channels/example'

/**
 * Endpoints and sockets of this app. `kitr add` keeps the extension list current; `createServer({ routes })`
 * in server/main.ts serves it.
 */
export const routes = defineRoutes([api, realtime], (root) =>
  root.group('/api', (r) =>
    r.get('/health', [HealthController, 'show'], { name: 'health' }),
    // r.resource('projects', () => import('#server/controllers/projects_controller'))
  )
    .ws('/api/ws', { channels: [exampleChannel] /* , authorize: (request) => ... */ }),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types