import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/drei.ts', 'src/kitr.ts', 'src/commands.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
})
