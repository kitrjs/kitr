import { defineConfig } from 'kitr/electron'

export default defineConfig({
  window: { width: 1200, height: 800, minWidth: 800, minHeight: 600, title: 'Desktop' },
  devtools: true,
})
