import { definePackage } from '@kitr/core/package'
import { tauri } from './index'

/**
 * The Tauri platform as a package: `kitr add tauri app`. For a bundled Chromium, add
 * `kitr/desktop` (Electron) instead; the two stay separate so each installs only its own toolchain.
 */
export default definePackage({
  name: 'tauri',
  kind: 'platform',
  client: true,
  requires: ['vite', 'router', 'platform', 'storage'],
  platform: { factory: tauri, export: 'tauri', from: 'kitr/tauri', defaultName: 'app' },
  eject: { 'kitr/tauri': '@tauri-apps/api + @tauri-apps/plugin-store' },
})
