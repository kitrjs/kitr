import { defineConfig } from '@kitr/theme'

export default defineConfig({
  default: 'system',
  // Window chrome / <meta name="theme-color"> per theme.
  colors: { light: '#ffffff', dark: '#0a0a0a' },
  // Any shadcn-compatible registry for `kitr ui add`. Default: kitr's.
  // registry: 'https://raw.githubusercontent.com/kitrjs/kitr/main/registry/dist',
  componentsDir: 'app/components/ui',
})
