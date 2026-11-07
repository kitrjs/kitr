import { cors, defineRoutes } from 'kitr/api'
import AuthController from '#server/controllers/auth_controller'
import HealthController from '#server/controllers/health_controller'
import ProjectsController from '#server/controllers/projects_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/auth/sign-in', [AuthController, 'signIn'], { name: 'auth.signIn' })
      .post('/auth/sign-out', [AuthController, 'signOut'], { name: 'auth.signOut' })
      .get('/auth/me', [AuthController, 'me'], { name: 'auth.me' })
      .resource('projects', ProjectsController),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
