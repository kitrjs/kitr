import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/react.tsx',
    'src/markdown.ts',
    'src/types.ts',
    'src/vite.ts',
    'src/kitr.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'node',
  fixedExtension: false,
})
