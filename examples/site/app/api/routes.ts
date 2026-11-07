import { cors, defineRoutes } from 'kitr/api'
import HealthController from '#app/controllers/health_controller'
import NewsletterController from '#app/controllers/newsletter_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/newsletter', [NewsletterController, 'subscribe'], { name: 'newsletter.subscribe' }),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
