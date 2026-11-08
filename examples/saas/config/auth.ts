import { defineConfig, sessionAdapter } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'

/**
 * The session is an HttpOnly cookie the API sets (server/controllers/auth-controller.ts), so there
 * is no token to keep: this adapter asks `GET /api/auth/session` in the browser and reads the
 * request's own session while a page renders on the server. Swap for betterAuthAdapter(createAuthClient())
 * or a customAdapter({...}) if you move to another identity provider.
 *
 * config/ is loaded by the browser bundle and by the plain-Node API server alike, so the typed client
 * (a Vite module) is imported when the adapter first runs, never while the server boots.
 */
const client = () => import('#app/api/client').then((m) => m.api)

const adapter = sessionAdapter<User>({
  abilities,
  fetchSession: async () => (await client()).auth.session(),
  signIn: async (credentials) => (await client()).auth.signIn({ body: credentials }),
  signOut: async () => (await client()).auth.signOut(),
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
