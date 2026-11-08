import { defineConfig } from '@kitr/http'

/** Same-origin API; the bearer token is attached by the auth provider once signed in. */
export default defineConfig({
  baseUrl: '/api',
})
