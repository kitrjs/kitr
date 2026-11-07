import { definePackage } from '@kitr/core/package'
import { desktop } from './index'

/**
 * The desktop platform (Electron) as a package: `kitr add desktop app`. For the Tauri shell,
 * add `kitr/tauri` instead; the two stay separate so each installs only its own toolchain.
 */
export default definePackage({
  name: 'desktop',
  kind: 'platform',
  client: true,
  requires: ['vite', 'router', 'platform', 'storage'],
  platform: { factory: desktop, export: 'desktop', from: 'kitr/desktop', defaultName: 'app' },
  eject: { 'kitr/desktop': 'electron + electron-vite + electron-builder' },
})
