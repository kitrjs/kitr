import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/kitr.ts', 'src/types.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
})
