import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: ['vite', 'vite-plugin-pwa'],
})
