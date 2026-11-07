import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.tsx', 'src/provider.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
})
