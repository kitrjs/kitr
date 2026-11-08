import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  // getToken: () => auth.getToken(), refresh: () => auth.refresh(),
})
