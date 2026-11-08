import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts', 'src/provider.ts', 'src/kitr.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
})
