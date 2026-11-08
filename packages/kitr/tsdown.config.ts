import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/app.ts', 'src/env.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  external: [/^@kitr\//],
})
