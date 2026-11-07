import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/provider.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: ['vite', 'vite-plugin-pwa', 'srvx', 'srvx/static', 'crossws/server/node', 'react'],
})
