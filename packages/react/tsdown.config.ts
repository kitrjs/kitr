import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.tsx', 'src/kitr.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
})
