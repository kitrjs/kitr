import { defineConfig } from 'kitr/secure-storage'

export default defineConfig({
  // OS vault on mobile/desktop; AES-GCM in the browser. true refuses the browser fallback.
  requireSecure: false,
})
