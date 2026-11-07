import { defineConfig } from 'kitr/devtools'

/** Development only. The kitr() Vite plugin drops the provider from production builds. */
export default defineConfig({
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
