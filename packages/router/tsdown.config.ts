import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/kitr.ts', 'src/routes.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
})
