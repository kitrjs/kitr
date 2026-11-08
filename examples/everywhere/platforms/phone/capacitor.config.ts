import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Written by kitr from `phone: mobile({...})` in kitrrc.ts. Native projects live next to this file;
 * `kitr dev phone` sets `server.url` for live reload, `kitr build phone` syncs the built bundle.
 */
const config: CapacitorConfig = {
  appId: 'com.example.everywhere',
  appName: 'Everywhere',
  webDir: '../../dist/phone/client',
  ios: { path: 'ios' },
  android: { path: 'android' },
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } } : {}),
  
}

export default config
