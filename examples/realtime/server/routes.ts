import { defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import MessagesController from '#server/controllers/messages_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('messages', MessagesController, { only: ['index', 'store'] }),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
