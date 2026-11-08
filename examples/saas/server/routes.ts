import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import AuthController from '#server/controllers/auth-controller'
import HealthController from '#server/controllers/health-controller'
import ProjectsController from '#server/controllers/projects-controller'

/** Endpoints of this app, served by `createServer({ routes })` in server/main.ts. */
export const routes = defineRoutes([api], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/auth/sign-in', [AuthController, 'signIn'], { name: 'auth.signIn' })
      .post('/auth/sign-out', [AuthController, 'signOut'], { name: 'auth.signOut' })
      .get('/auth/me', [AuthController, 'me'], { name: 'auth.me' })
      .resource('projects', ProjectsController),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
