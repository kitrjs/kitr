import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/provider.tsx', 'src/ui.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
})
