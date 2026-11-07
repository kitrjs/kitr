import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/kitr.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'node',
  fixedExtension: false,
})
