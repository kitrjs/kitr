import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/provider.ts'],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: [
    'react',
    '@capacitor/core',
    '@capacitor/app',
    '@capacitor/preferences',
    '@kitr/platform',
    '@kitr/storage',
  ],
})
