import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client.ts',
    'src/provider.ts',
    'src/tauri.ts',
    'src/electron.ts',
    'src/electron-main.ts',
    'src/electron-preload.ts',
  ],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: [
    'react',
    'electron',
    '@tauri-apps/api',
    '@tauri-apps/api/core',
    '@tauri-apps/api/event',
    '@tauri-apps/api/app',
    '@tauri-apps/plugin-store',
    '@tauri-apps/plugin-opener',
    '@tauri-apps/plugin-process',
    '@kitr/core',
    '@kitr/platform',
    '@kitr/storage',
  ],
})
