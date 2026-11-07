import { cors, defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api.get('/health', [HealthController, 'show'], { name: 'health' }),
    // api.resource('projects', () => import('#server/controllers/projects_controller'))
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
