import { defineConfig } from '@kitr/storage'

export default defineConfig({
  // Prefixes every storage key and cookie name so several apps on one origin never collide.
  prefix: 'everywhere:',
  cookie: { path: '/', sameSite: 'lax', secure: import.meta.env?.PROD ?? false },
})
