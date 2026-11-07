import type { CapacitorConfig } from '@capacitor/cli'
import app from './config/capacitor'

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: app.webDir ?? 'dist',
  ...(app.devServerUrl ? { server: { url: app.devServerUrl, cleartext: true } } : {}),
  ...app.extra,
}

export default config
