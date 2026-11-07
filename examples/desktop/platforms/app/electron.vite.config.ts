import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

/** Main and preload only. The renderer is the kitr client build in dist/app/client. */
export default defineConfig({
  main: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'main.ts' }, outDir: '../../dist/app/electron/main' },
  },
  preload: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'preload.ts' }, outDir: '../../dist/app/electron/preload' },
  },
})
