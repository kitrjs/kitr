import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client.ts',
    'src/server.ts',
    'src/socket-io.ts',
    'src/socket-io-server.ts',
    'src/sse.ts',
    'src/sse-server.ts',
    'src/react.ts',
  ],
  format: ['esm'],
  dts: { resolve: false },
  clean: true,
  platform: 'neutral',
  fixedExtension: false,
  external: [
    'react',
    'partysocket',
    'partysocket/ws',
    'crossws',
    'h3',
    'socket.io',
    'socket.io-client',
    '@kitr/query',
    '@kitr/server',
  ],
})
