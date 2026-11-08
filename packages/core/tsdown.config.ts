import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/package.ts', 'src/request.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
})
