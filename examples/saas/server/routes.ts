import { defineRoutes } from 'kitr/app'
import { sessionMiddleware } from 'kitr/auth/server'
import api from 'kitr/api/routes'
import { auth } from '#server/auth'
import AuthController from '#server/controllers/auth_controller'
import HealthController from '#server/controllers/health_controller'
import ProjectsController from '#server/controllers/projects_controller'

/** Resolves the session cookie and answers 401 without one. */
const requireSession = sessionMiddleware(auth)

/** Endpoints of this app, served by `createServer({ routes })` in server/main.ts. */
export const routes = defineRoutes([api], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .get('/auth/session', [AuthController, 'session'], { name: 'auth.session' })
      .post('/auth/sign-in', [AuthController, 'signIn'], { name: 'auth.signIn' })
      .post('/auth/sign-up', [AuthController, 'signUp'], { name: 'auth.signUp' })
      .post('/auth/sign-out', [AuthController, 'signOut'], { name: 'auth.signOut' })
      .post('/auth/sign-out-all', [AuthController, 'signOutAll'], { name: 'auth.signOutAll' })
      .post('/auth/verify-email/request', [AuthController, 'requestVerification'], { name: 'auth.requestVerification' })
      .post('/auth/verify-email', [AuthController, 'verifyEmail'], { name: 'auth.verifyEmail' })
      .post('/auth/password/forgot', [AuthController, 'requestPasswordReset'], { name: 'auth.requestPasswordReset' })
      .post('/auth/password/reset', [AuthController, 'resetPassword'], { name: 'auth.resetPassword' })
      .resource('projects', ProjectsController, { middleware: [requireSession] }),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
