import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/kitr.ts', 'src/commands.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'node',
  fixedExtension: false,
})
