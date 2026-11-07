import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts', 'src/devtools.tsx', 'src/provider.ts', 'src/kitr.ts'],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: ['react', 'react/jsx-runtime', '@kitr/react'],
})
