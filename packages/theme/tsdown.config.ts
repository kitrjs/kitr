import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/provider.tsx', 'src/server.ts'],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'sonner',
    'clsx',
    'class-variance-authority',
    '@kitr/core',
  ],
})
