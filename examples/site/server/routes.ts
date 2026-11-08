import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import HealthController from '#server/controllers/health-controller'
import NewsletterController from '#server/controllers/newsletter-controller'

/** Endpoints of this app, served by `createServer({ routes })` in server/main.ts. */
export const routes = defineRoutes([api], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/newsletter', [NewsletterController, 'subscribe'], { name: 'newsletter.subscribe' }),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
