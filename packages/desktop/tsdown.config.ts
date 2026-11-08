import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client.ts',
    'src/provider.ts',
    'src/main.ts',
    'src/preload.ts',
    'src/kitr.ts',
  ],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: [
    'react',
    'electron',
    'electron-updater',
    '@kitr/core',
    '@kitr/core/package',
    '@kitr/platform',
    '@kitr/storage',
  ],
})
