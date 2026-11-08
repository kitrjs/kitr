import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import realtime from '@kitr/realtime/routes'
import { chatChannel } from '#app/channels/chat'
import HealthController from '#server/controllers/health-controller'
import MessagesController from '#server/controllers/messages-controller'

/** Endpoints and the chat socket, served by `createServer({ routes })` in server/main.ts. */
export const routes = defineRoutes([api, realtime], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('messages', MessagesController, { only: ['index', 'store'] })
      // WebSocket upgrades on /api/ws, next to the REST routes.
      .ws('/ws', {
        channels: [chatChannel],
        // authorize: (request) => verify(request.headers.get('authorization')),
      }),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
