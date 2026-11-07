import { defineConfig } from 'kitr/capacitor'

/** One source for capacitor.config.ts and the app. */
export default defineConfig({
  appId: 'com.example.mobile',
  appName: 'Mobile',
  webDir: 'dist',
  // Live reload on a device: set CAP_SERVER_URL=http://<your-ip>:5173 then `pnpm cap sync`.
  devServerUrl: process.env.CAP_SERVER_URL,
})
