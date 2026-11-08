import { defineConfig, sessionAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { api } from '#app/api/client'

/**
 * The session is an HttpOnly cookie the API sets (server/controllers/auth_controller.ts), so there
 * is no token to keep: this adapter asks `GET /api/auth/session` in the browser and reads the
 * request's own session while a page renders on the server. Swap for betterAuthAdapter(createAuthClient())
 * or a customAdapter({...}) if you move to another identity provider.
 */
const adapter = sessionAdapter<User>({
  abilities,
  fetchSession: () => api.auth.session(),
  signIn: (credentials) => api.auth.signIn({ body: credentials }),
  signOut: () => api.auth.signOut(),
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
