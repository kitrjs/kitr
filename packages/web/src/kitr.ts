import { definePackage } from '@kitr/core/package'
import { web } from './index'

/**
 * The web platform as a package: `kitr add web site --mode ssr`. Its options, scaffold, dev,
 * build and start hooks live on the platform factory; this module tells the CLI it is a
 * platform, what it needs around it, and mounts `kitr css:types`.
 */
export default definePackage({
  name: 'web',
  kind: 'platform',
  client: true,
  requires: ['vite', 'router'],
  platform: { factory: web, export: 'web', from: 'kitr/web', defaultName: 'site' },
  commands: () => import('./commands'),
  eject: { 'kitr/web': 'vite + @tanstack/react-start + vite-plugin-pwa' },
})
