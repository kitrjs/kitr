import { kitr } from 'kitr/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/main.ts' } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/preload.ts' } },
  },
  renderer: {
    // The kitr app as-is: same routes, providers and config as the web build.
    root: '.',
    plugins: [kitr()],
    build: { rollupOptions: { input: 'index.html' } },
  },
})
