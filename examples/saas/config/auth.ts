import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { api } from '#app/api/client'

/**
 * Tokens come from this app's own API (server/controllers/auth_controller.ts).
 * Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}) when you have a real identity provider.
 */
const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(api.auth.me.url(), { headers: { authorization: 'Bearer ' + token } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: (credentials) => api.auth.signIn({ body: credentials }),
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
