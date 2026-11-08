import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

/** Main and preload only. The renderer is the kitr client build in dist/app/client. */
export default defineConfig({
  main: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'main.ts' },
      outDir: '../../dist/app/electron/main',
      rollupOptions: { output: { entryFileNames: 'index.js' } },
    },
  },
  preload: {
    root: __dirname,
    // A sandboxed preload can only require electron, so kitr is bundled into it.
    plugins: [externalizeDepsPlugin({ exclude: ['kitr', '@kitr/desktop'] })],
    // A sandboxed preload script cannot be an ES module, so it is built as CommonJS.
    build: {
      lib: { entry: 'preload.ts' },
      outDir: '../../dist/app/electron/preload',
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.js' } },
    },
  },
})
