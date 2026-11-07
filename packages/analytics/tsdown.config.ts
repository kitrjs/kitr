import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/provider.tsx', 'src/react.tsx', 'src/kitr.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
})
