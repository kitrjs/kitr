import { defineConfig } from 'kitr/pwa'

/** Read by `kitrPwa()` in vite.config.ts (the manifest) and by the app (hooks). */
export default defineConfig({
  name: 'Mobile',
  shortName: 'Mobile',
  description: 'Mobile',
  themeColor: '#0f172a',
  backgroundColor: '#ffffff',
  display: 'standalone',
  // 'prompt' (default) lets useServiceWorker() show an "update available" banner; 'autoUpdate' reloads.
  registerType: 'prompt',
})
