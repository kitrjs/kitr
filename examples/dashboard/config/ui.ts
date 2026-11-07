import { defineConfig } from 'kitr/ui'

export default defineConfig({
  theme: { default: 'system' },
  toaster: { position: 'bottom-right' },
  // Any shadcn-compatible registry. Default: kitr's.
  // registry: 'https://raw.githubusercontent.com/kitrjs/kitr/main/registry/dist',
  componentsDir: 'app/components/ui',
})
