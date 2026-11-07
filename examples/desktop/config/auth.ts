import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

// Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}).
const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) })
    if (!res.ok) throw new Error('Invalid credentials')
    return (await res.json()) as { token: string; refreshToken?: string }
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
